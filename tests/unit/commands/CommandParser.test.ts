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
  // These tests pin each group of §3 rather than the full list, so that adding
  // a command only touches its own group.
  const EDIT_COMMANDS = ["create", "delete", "move", "scale", "set", "group", "ungroup", "addto", "front", "back"];
  const DISPLAY_COMMANDS = ["tree", "show", "help"];
  const DOCUMENT_COMMANDS = ["init", "read", "save", "canvas"];
  const HISTORY_COMMANDS = ["undo", "redo"];
  const GROUPS: Array<[CommandCategory, string[]]> = [
    [CommandCategory.EDIT, EDIT_COMMANDS],
    [CommandCategory.DISPLAY, DISPLAY_COMMANDS],
    [CommandCategory.DOCUMENT, DOCUMENT_COMMANDS],
    [CommandCategory.HISTORY, HISTORY_COMMANDS],
  ];

  it("registers the commands of §3 group by group, in order, and lists added types after them", () => {
    const names = registry().commandTypes().map((t) => t.commandName);
    for (const [, group] of GROUPS) {
      expect(names.filter((name) => group.includes(name))).toEqual(group);
    }
    expect(names.indexOf("tree")).toBeGreaterThan(names.indexOf("back"));
    expect(names.slice(-3)).toEqual(["echo", "start", "back-stub"]);
  });

  it("each group has the category of spec §3; only init, read and help need no document (R11)", () => {
    const types = new CommandRegistry().commandTypes();
    for (const [category, group] of GROUPS) {
      expect(types.filter((t) => t.category === category).map((t) => t.commandName)).toEqual(group);
    }
    for (const type of types) {
      expect(type.requiresDocument, type.commandName).toBe(!["init", "read", "help"].includes(type.commandName));
    }
  });

  it("every usage starts with the command name", () => {
    for (const type of new CommandRegistry().commandTypes()) {
      expect(type.usage === type.commandName || type.usage.startsWith(`${type.commandName} `)).toBe(true);
    }
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
