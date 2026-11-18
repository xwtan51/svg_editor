import { CommandCategory } from "@svgframe/kernel";
import { ExtensionRegistry, PluginInstaller } from "@svgframe/kernel/host";
import { describe, expect, it } from "vitest";
import manifest from "../package.json" with { type: "json" };
import { StatsCommand } from "../src/StatsCommand.js";
import { TestEditor } from "./doubles/TestEditor.js";

/**
 * The plugin as the composition root installs it: its own `package.json` as
 * the manifest, through the real installer (design §3.3.1, §8.1). The real
 * `help` lives in the built-in commands plugin, which a plugin test may not
 * import (L3); the `help` line itself is covered by the assembly contract test.
 */
describe("StatsPlugin", () => {
  it("declares exactly the command stats", () => {
    expect(manifest.contributes).toEqual({ commands: ["stats"] });
  });

  it("installs with its own manifest: what it registers matches what it declares", () => {
    const registry = new ExtensionRegistry();
    const outcome = new PluginInstaller(registry).install(TestEditor.stats());
    expect(outcome.succeeded()).toBe(true);
    expect(registry.commands().commandTypes()).toEqual([StatsCommand]);
  });

  it("registers stats after the commands installed before it, in the Display group of help", () => {
    const types = TestEditor.create().session().commands().commandTypes();
    expect(types.map((type) => type.commandName)).toEqual(["add", "barrier", "undo", "redo", "stats"]);
    const stats = types[types.length - 1];
    expect(stats?.category).toBe(CommandCategory.DISPLAY);
    expect(stats?.usage).toBe("stats");
    expect(stats?.summary).toBe("count the shapes of the document by type");
    expect(stats?.requiresDocument).toBe(true);
  });

  it("each editor gets its own registration", () => {
    const a = TestEditor.create().withDocument();
    const b = TestEditor.create();
    expect(a.run("stats")).toEqual(["(total 0, containers 0)"]);
    expect(b.run("stats")).toEqual(["error: no document. use 'init' or 'read' first"]);
  });
});
