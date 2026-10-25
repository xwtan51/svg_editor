import { describe, expect, it } from "vitest";
import type { ArgList } from "../../../src/commands/ArgList.js";
import { CommandCategory } from "../../../src/commands/CommandCategory.js";
import type { CommandContext } from "../../../src/commands/CommandContext.js";
import { CommandParser } from "../../../src/commands/CommandParser.js";
import { CommandRegistry } from "../../../src/commands/CommandRegistry.js";
import { CommandResult } from "../../../src/commands/CommandResult.js";
import { DocumentCommand } from "../../../src/commands/DocumentCommand.js";
import { History } from "../../../src/commands/History.js";
import { HistoryCommand } from "../../../src/commands/HistoryCommand.js";
import { QueryCommand } from "../../../src/commands/QueryCommand.js";
import { EditorError } from "../../../src/model/EditorError.js";

/** A query command type that echoes its arguments. */
class EchoCommand extends QueryCommand {
  static readonly commandName = "echo";
  static readonly usage = "echo <a> <b>";
  static readonly summary = "echo two words";

  static parse(args: ArgList): EchoCommand {
    args.expectCount(2);
    return new EchoCommand(args.nextRaw(), args.nextRaw());
  }

  constructor(
    private readonly a: string,
    private readonly b: string,
  ) {
    super();
  }

  execute(_context: CommandContext): CommandResult {
    return CommandResult.of(`${this.a}|${this.b}`);
  }
}

class StartCommand extends DocumentCommand {
  static readonly commandName = "start";
  static readonly usage = "start";
  static readonly summary = "a document command without a document";
  static override readonly requiresDocument = false;

  static parse(args: ArgList): StartCommand {
    args.expectEnd();
    return new StartCommand();
  }

  execute(_context: CommandContext): CommandResult {
    return CommandResult.empty();
  }
}

class BackCommandStub extends HistoryCommand {
  static readonly commandName = "back-stub";
  static readonly usage = "back-stub";
  static readonly summary = "history command";

  static parse(): BackCommandStub {
    return new BackCommandStub();
  }

  execute(_context: CommandContext): CommandResult {
    return CommandResult.empty();
  }
}

function registry(): CommandRegistry {
  const result = new CommandRegistry();
  result.register(EchoCommand);
  result.register(StartCommand);
  result.register(BackCommandStub);
  return result;
}

function errorOf(action: () => unknown): string {
  try {
    action();
  } catch (error) {
    expect(error).toBeInstanceOf(EditorError);
    return (error as Error).message;
  }
  throw new Error("no error");
}

describe("CommandParser", () => {
  const parser = new CommandParser(registry());

  it("resolves the command type by name and passes the remaining tokens", () => {
    const line = parser.resolve('  echo  "a b" c ');
    expect(line.type()).toBe(EchoCommand);
    expect(line.args().remaining()).toBe(2);
    expect(line.parse().execute(undefined as never).lines()).toEqual(["a b|c"]);
  });

  it("does not parse the arguments itself", () => {
    const line = parser.resolve("echo only-one");
    expect(errorOf(() => line.parse())).toBe("usage: echo <a> <b>");
  });

  it("reports an unknown command; names are case-sensitive (R4)", () => {
    expect(errorOf(() => parser.resolve("hexagon 1 2"))).toBe("unknown command: hexagon");
    expect(errorOf(() => parser.resolve("Echo a b"))).toBe("unknown command: Echo");
  });

  it("reports an unterminated quote before an unknown command (R10)", () => {
    expect(errorOf(() => parser.resolve('nosuch "x'))).toBe("unterminated quote");
  });

  it("exposes requiresDocument of the static side before parsing (R10)", () => {
    expect(parser.resolve("echo a b").type().requiresDocument).toBe(true);
    expect(parser.resolve("start").type().requiresDocument).toBe(false);
  });

  it("rejects a blank line as a programming error", () => {
    expect(() => parser.resolve("   ")).toThrow(Error);
    expect(() => parser.resolve("   ")).not.toThrow(EditorError);
  });
});

describe("CommandRegistry", () => {
  it("lists the types in registration order", () => {
    expect(registry().commandTypes().map((t) => t.commandName)).toEqual(["echo", "start", "back-stub"]);
  });

  it("rejects a second registration of the same name", () => {
    const r = registry();
    expect(() => r.register(EchoCommand)).toThrow("command already registered: echo");
  });

  it("each abstract kind gives its category to its subclasses", () => {
    expect(EchoCommand.category).toBe(CommandCategory.DISPLAY);
    expect(StartCommand.category).toBe(CommandCategory.DOCUMENT);
    expect(BackCommandStub.category).toBe(CommandCategory.HISTORY);
  });
});

describe("recordIn of the command kinds", () => {
  it("document commands set an io barrier; query and history commands do nothing", () => {
    const history = new History();
    new EchoCommand("a", "b").recordIn(history);
    new BackCommandStub().recordIn(history);
    expect(history.isLocked()).toBe(false);
    new StartCommand().recordIn(history);
    expect(history.isLocked()).toBe(true);
  });
});
