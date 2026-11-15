import { describe, expect, it } from "vitest";
import { CommandCategory } from "../../src/commands/CommandCategory.js";
import { CommandRegistry } from "../../src/commands/CommandRegistry.js";
import { EditorError } from "../../src/model/EditorError.js";
import { FakeCommandType } from "../doubles/FakeCommandType.js";

/** Name dispatch #2 with test doubles only (design §2.2.1): no command is built in. */
describe("CommandRegistry (kernel contract)", () => {
  it("starts empty: every name is an unknown command", () => {
    const registry = new CommandRegistry();
    expect(registry.commandTypes()).toEqual([]);
    for (const name of ["help", "create", "init"]) {
      expect(() => registry.lookup(name)).toThrow(new EditorError(`unknown command: ${name}`));
    }
  });

  it("keeps registration order and looks types up by exact name (R4)", () => {
    const registry = new CommandRegistry();
    const beta = new FakeCommandType("beta", CommandCategory.EDIT);
    const alpha = new FakeCommandType("alpha");
    registry.register(beta);
    registry.register(alpha);
    expect(registry.commandTypes()).toEqual([beta, alpha]);
    expect(registry.lookup("alpha")).toBe(alpha);
    expect(() => registry.lookup("Alpha")).toThrow(new EditorError("unknown command: Alpha"));
  });

  it("registering a name twice is a programming error", () => {
    const registry = new CommandRegistry();
    registry.register(new FakeCommandType("alpha"));
    expect(() => registry.register(new FakeCommandType("alpha"))).toThrow("command already registered: alpha");
  });
});
