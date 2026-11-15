import { describe, expect, it } from "vitest";
import builtinCommandsManifest from "@svgframe/plugin-builtin-commands/package.json" with { type: "json" };
import builtinShapesManifest from "@svgframe/plugin-builtin-shapes/package.json" with { type: "json" };
import BuiltinCommandsPlugin from "@svgframe/plugin-builtin-commands";
import BuiltinShapesPlugin from "@svgframe/plugin-builtin-shapes";
import { PluginOptions } from "../../../packages/kernel/src/extension/PluginOptions.js";
import { CompositionRoot } from "../../../src/assembly/CompositionRoot.js";

/** Way A's table (design §4.2): built-ins first, shapes before commands; no optional plugin yet. */
describe("CompositionRoot", () => {
  it("lists the two built-in plugins, shapes first, with their package names as labels", () => {
    const builtins = new CompositionRoot().builtins();
    expect(builtins.map((candidate) => candidate.label())).toEqual([
      "@svgframe/plugin-builtin-shapes",
      "@svgframe/plugin-builtin-commands",
    ]);
    expect(builtins.map((candidate) => candidate.pluginClass())).toEqual([BuiltinShapesPlugin, BuiltinCommandsPlugin]);
  });

  it("hands over the plugins' own package.json as manifests, and no options", () => {
    const [shapes, commands] = new CompositionRoot().builtins();
    expect(shapes?.manifestJson()).toBe(builtinShapesManifest);
    expect(commands?.manifestJson()).toBe(builtinCommandsManifest);
    expect(shapes?.options()).toBe(PluginOptions.EMPTY);
    expect(commands?.options()).toBe(PluginOptions.EMPTY);
  });

  it("the labels are the manifests' names", () => {
    for (const candidate of new CompositionRoot().builtins()) {
      expect((candidate.manifestJson() as { name: string }).name).toBe(candidate.label());
    }
  });

  it("has no optional plugin in S6", () => {
    expect(new CompositionRoot().optional()).toEqual([]);
  });
});
