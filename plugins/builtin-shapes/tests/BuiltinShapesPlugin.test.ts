import { PluginOptions, StaticShapeProvider } from "@svgframe/kernel";
import { ExtensionRegistry, PluginCandidate, PluginInstaller } from "@svgframe/kernel/host";
import { describe, expect, it } from "vitest";
import manifest from "../package.json" with { type: "json" };
import BuiltinShapesPlugin from "../src/BuiltinShapesPlugin.js";

/** The six built-in shape types as a plugin (design §2.1.1), installed on their own. */
describe("BuiltinShapesPlugin", () => {
  const PHASE_1_ORDER = ["rect", "circle", "ellipse", "line", "text", "g"];

  function installed(): ExtensionRegistry {
    const registry = new ExtensionRegistry();
    const candidate = new PluginCandidate(manifest.name, BuiltinShapesPlugin, manifest, PluginOptions.EMPTY);
    const outcome = new PluginInstaller(registry).install(candidate);
    expect(outcome.succeeded()).toBe(true);
    return registry;
  }

  it("declares the six Phase 1 shapes, written in registration order", () => {
    expect(manifest.contributes.shapes).toEqual(PHASE_1_ORDER);
  });

  it("registers exactly what it declares, in the Phase 1 order, needing no other plugin", () => {
    expect(installed().shapes().typeNames()).toEqual(PHASE_1_ORDER);
  });

  it("each type is a static provider whose shapes carry the type name as their tag", () => {
    const shapes = installed().shapes();
    for (const name of PHASE_1_ORDER) {
      const provider = shapes.lookup(name);
      expect(provider).toBeInstanceOf(StaticShapeProvider);
      const shape = shapes.build(name, "x", new Map());
      expect(shape.tagName()).toBe(name);
      expect(shape.kindName()).toBe(name);
      expect(provider.claimedIds("x")).toEqual(["x"]);
      expect(provider.creationDetail(shape)).toBe("");
    }
  });

  it("only g is a container", () => {
    const shapes = installed().shapes();
    expect(PHASE_1_ORDER.filter((name) => shapes.build(name, "x", new Map()).asContainer() !== null)).toEqual(["g"]);
  });
});
