import { describe, expect, it } from "vitest";
import type { ArgList } from "../../../src/commands/ArgList.js";
import { CommandCategory } from "../../../src/commands/CommandCategory.js";
import type { CommandContext } from "../../../src/commands/CommandContext.js";
import { CommandParser } from "../../../src/commands/CommandParser.js";
import { CommandResult } from "../../../src/commands/CommandResult.js";
import { DocumentCommand } from "../../../src/commands/DocumentCommand.js";
import { HelpCommand } from "../../../src/commands/HelpCommand.js";
import { HistoryCommand } from "../../../src/commands/HistoryCommand.js";
import { CommandRunner } from "./CommandRunner.js";
import { TestContext } from "./TestContext.js";

/*
 * The registered command set is still growing (init / read / save / undo …
 * are added elsewhere), so nothing here pins the full list: the assertions
 * are derived from `registry().commandTypes()`.
 */

const CATEGORY_ORDER = [CommandCategory.DOCUMENT, CommandCategory.EDIT, CommandCategory.DISPLAY, CommandCategory.HISTORY];

class HistoryStub extends HistoryCommand {
  static readonly commandName = "zz-history-stub";
  static readonly usage = "zz-history-stub";
  static readonly summary = "history stub";

  static parse(): HistoryStub {
    return new HistoryStub();
  }

  execute(_context: CommandContext): CommandResult {
    return CommandResult.empty();
  }
}

class DocumentStub extends DocumentCommand {
  static readonly commandName = "zz-document-stub";
  static readonly usage = "zz-document-stub <file>";
  static readonly summary = "document stub";

  static parse(_args: ArgList): DocumentStub {
    return new DocumentStub();
  }

  execute(_context: CommandContext): CommandResult {
    return CommandResult.empty();
  }
}

/** Runs `help` the way the Invoker would, in `context`. */
function help(context: TestContext, line = "help"): string[] {
  return new CommandParser(context.registry()).resolve(line).parse().execute(context).lines();
}

function isHeading(line: string): boolean {
  return !line.startsWith(" ");
}

describe("help", () => {
  it("lists the usage and summary of every registered command", () => {
    const context = new TestContext(CommandRunner.spec6().document());
    const output = help(context);
    for (const type of context.registry().commandTypes()) {
      expect(output.filter((line) => line.startsWith(`  ${type.usage} `))).toHaveLength(1);
      expect(output.find((line) => line.startsWith(`  ${type.usage} `))?.endsWith(type.summary)).toBe(true);
    }
    expect(output.filter((line) => !isHeading(line))).toHaveLength(context.registry().commandTypes().length);
  });

  it("lists tree, show and help themselves", () => {
    const output = help(new TestContext(CommandRunner.spec6().document()));
    for (const usage of ["tree [id]", "show <id>", "help"]) {
      expect(output.some((line) => line.startsWith(`  ${usage} `))).toBe(true);
    }
  });

  it("each command is under its category's heading; headings follow §3 order, once each (V7)", () => {
    const context = new TestContext(CommandRunner.spec6().document());
    const output = help(context);
    const headings = output.filter(isHeading);
    const expected = CATEGORY_ORDER.filter((category) =>
      context.registry().commandTypes().some((type) => type.category === category),
    ).map((category) => `${category.title()}:`);
    expect(headings).toEqual(expected);
    for (const type of context.registry().commandTypes()) {
      const index = output.findIndex((line) => line.startsWith(`  ${type.usage} `));
      const heading = output.slice(0, index).filter(isHeading).pop();
      expect(heading).toBe(`${type.category.title()}:`);
    }
  });

  it("orders groups by category, not by registration order", () => {
    const context = new TestContext(null);
    context.registry().register(HistoryStub);
    context.registry().register(DocumentStub);
    const headings = help(context).filter(isHeading);
    expect(headings).toEqual(CATEGORY_ORDER.map((category) => `${category.title()}:`));
    expect(help(context)[1]).toMatch(/^ {2}zz-document-stub <file> +document stub$/);
  });

  it("aligns every summary in one column: widest usage + 2", () => {
    const context = new TestContext(null);
    const types = context.registry().commandTypes();
    const column = 2 + Math.max(...types.map((type) => type.usage.length)) + 2;
    for (const type of types) {
      const line = help(context).find((l) => l.startsWith(`  ${type.usage} `));
      expect(line?.indexOf(type.summary, 2 + type.usage.length)).toBe(column);
    }
  });

  it("runs without a document (R11)", () => {
    expect(HelpCommand.requiresDocument).toBe(false);
    const context = new TestContext(null);
    expect(context.hasDocument()).toBe(false);
    expect(help(context).length).toBeGreaterThan(0);
    expect(context.hasDocument()).toBe(false);
  });

  it("rejects any argument (R9)", () => {
    CommandRunner.spec6().expectRejected("help x", "usage: help");
    CommandRunner.spec6().expectRejected("help tree", "usage: help");
  });
});
