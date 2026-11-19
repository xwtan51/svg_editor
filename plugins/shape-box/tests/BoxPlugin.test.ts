import { PluginOptions } from "@svgframe/kernel";
import { ExtensionRegistry, PluginCandidate, PluginInstaller } from "@svgframe/kernel/host";
import { describe, expect, it } from "vitest";
import manifest from "../package.json" with { type: "json" };
import { BoxAttributeHandler } from "../src/BoxAttributeHandler.js";
import BoxPlugin from "../src/BoxPlugin.js";
import { BoxProvider } from "../src/BoxProvider.js";
import { BoxTypeLabel } from "../src/BoxTypeLabel.js";
import { BoxTestbed } from "./doubles/BoxTestbed.js";
import { FakeGroup } from "./doubles/FakeGroup.js";
import { FakeRect } from "./doubles/FakeRect.js";
import { FakeShapesPlugin } from "./doubles/FakeShapesPlugin.js";
import { FakeText } from "./doubles/FakeText.js";

/**
 * The plugin as the composition root installs it: its own `package.json` as
 * the manifest, through the real installer (design §3.3, §8.3), after the
 * shape types it builds on (design §2.1.5).
 */
describe("BoxPlugin", () => {
  /** A registry where `shapes` (when given) were installed first, then the outcome of installing box. */
  function installBox(shapes: PluginCandidate | null) {
    const registry = new ExtensionRegistry();
    const installer = new PluginInstaller(registry);
    if (shapes !== null) {
      expect(installer.install(shapes).succeeded()).toBe(true);
    }
    return { registry, outcome: installer.install(BoxTestbed.box()) };
  }

  it("declares exactly one shape, one attribute handler and one tree decorator", () => {
    expect(manifest.contributes).toEqual({
      shapes: ["box"],
      attributes: ["box-attributes"],
      decorators: ["box-type-label"],
    });
  });

  it("installs with its own manifest after rect, text and g: what it registers matches what it declares", () => {
    const { registry, outcome } = installBox(FakeShapesPlugin.candidate());
    expect(outcome.succeeded()).toBe(true);
    expect(registry.shapes().typeNames()).toEqual(["rect", "text", "g", "box"]);
    expect(registry.shapes().lookup("box")).toBeInstanceOf(BoxProvider);
    expect(registry.attributeHandlers().map((handler) => handler.constructor)).toEqual([BoxAttributeHandler]);
    expect(registry.treeDecorators().map((decorator) => decorator.constructor)).toEqual([BoxTypeLabel]);
    expect(registry.commands().commandTypes()).toEqual([]);
    expect(registry.documentListeners()).toEqual([]);
  });

  it("needs only rect and text, not g", () => {
    const { registry, outcome } = installBox(FakeShapesPlugin.candidate([FakeRect, FakeText]));
    expect(outcome.succeeded()).toBe(true);
    expect(registry.shapes().has("box")).toBe(true);
  });

  const failures: ReadonlyArray<readonly [string, PluginCandidate | null]> = [
    ["no shape plugin at all", null],
    ["text and g but no rect", FakeShapesPlugin.candidate([FakeText, FakeGroup])],
    ["rect and g but no text", FakeShapesPlugin.candidate([FakeRect, FakeGroup])],
  ];

  it.each(failures)("%s: fails to activate and leaves nothing registered", (_name, shapes) => {
    const { registry, outcome } = installBox(shapes);
    const before = shapes === null ? [] : registry.shapes().typeNames();
    expect(outcome.succeeded()).toBe(false);
    expect(outcome.message()).toBe("plugin failed to activate: @svgframe/plugin-shape-box (requires shape types: rect, text)");
    expect(registry.shapes().has("box")).toBe(false);
    expect(registry.shapes().typeNames()).toEqual(before);
    expect(registry.attributeHandlers()).toEqual([]);
    expect(registry.treeDecorators()).toEqual([]);
  });

  it("can be installed once the missing types are there", () => {
    const registry = new ExtensionRegistry();
    const installer = new PluginInstaller(registry);
    expect(installer.install(BoxTestbed.box()).succeeded()).toBe(false);
    expect(installer.install(FakeShapesPlugin.candidate()).succeeded()).toBe(true);
    expect(installer.install(BoxTestbed.box()).succeeded()).toBe(true);
    expect(registry.shapes().typeNames()).toEqual(["rect", "text", "g", "box"]);
  });

  it("each installation registers its own objects", () => {
    const first = installBox(FakeShapesPlugin.candidate()).registry;
    const second = installBox(FakeShapesPlugin.candidate()).registry;
    expect(first.shapes().lookup("box")).not.toBe(second.shapes().lookup("box"));
    expect(first.attributeHandlers()[0]).not.toBe(second.attributeHandlers()[0]);
  });

  it("the candidate the testbed uses is the package's own entry and manifest", () => {
    const candidate = new PluginCandidate(manifest.name, BoxPlugin, manifest, PluginOptions.EMPTY);
    expect(candidate.label()).toBe("@svgframe/plugin-shape-box");
    expect(BoxTestbed.box().pluginClass()).toBe(BoxPlugin);
    expect(BoxTestbed.box().manifestJson()).toBe(manifest);
  });
});
