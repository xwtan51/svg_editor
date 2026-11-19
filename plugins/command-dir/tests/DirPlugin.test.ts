import { CommandCategory } from "@svgframe/kernel";
import { ExtensionRegistry, PluginInstaller } from "@svgframe/kernel/host";
import { describe, expect, it } from "vitest";
import manifest from "../package.json" with { type: "json" };
import { DirCommandType } from "../src/DirCommandType.js";
import { FakeDirectoryLister } from "./doubles/FakeDirectoryLister.js";
import { FakeWorkingDirectory } from "./doubles/FakeWorkingDirectory.js";
import { TestEditor } from "./doubles/TestEditor.js";

/**
 * The plugin as the composition root installs it: its own `package.json` as
 * the manifest, through the real installer (design §3.3.1, §8.2). It registers
 * an instance of `DirCommandType` (design §2.2.1, G11). The `help` line itself
 * is covered by the assembly contract test and the `cli-2` session (G36).
 */
describe("DirPlugin", () => {
  function installed(): ExtensionRegistry {
    const registry = new ExtensionRegistry();
    const outcome = new PluginInstaller(registry).install(TestEditor.dir());
    expect(outcome.succeeded()).toBe(true);
    return registry;
  }

  it("declares exactly the command dir", () => {
    expect(manifest.contributes).toEqual({ commands: ["dir"] });
  });

  it("installs with its own manifest and registers one DirCommandType instance", () => {
    const types = installed().commands().commandTypes();
    expect(types).toHaveLength(1);
    const dir = types[0];
    expect(dir).toBeInstanceOf(DirCommandType);
    expect(dir?.commandName).toBe("dir");
    expect(dir?.usage).toBe("dir");
    expect(dir?.summary).toBe("list the files and directories of the working directory");
    expect(dir?.requiresDocument).toBe(false);
    expect(dir?.category).toBe(CommandCategory.DISPLAY);
  });

  it("comes after the commands installed before it, in the Display group of help", () => {
    const editor = TestEditor.create(FakeDirectoryLister.listing([]), new FakeWorkingDirectory("/"));
    const types = editor.session().commands().commandTypes();
    expect(types.map((type) => type.commandName)).toEqual(["add", "barrier", "undo", "redo", "dir"]);
    expect(types.at(-1)?.category).toBe(CommandCategory.DISPLAY);
  });

  it("each plugin instance holds its own command object", () => {
    const first = installed().commands().lookup("dir");
    const second = installed().commands().lookup("dir");
    expect(first).toBeInstanceOf(DirCommandType);
    expect(second).toBeInstanceOf(DirCommandType);
    expect(first).not.toBe(second);
  });
});
