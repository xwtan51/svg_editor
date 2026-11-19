import { PluginOptions, SvgDocument } from "@svgframe/kernel";
import type { TreeRowView } from "@svgframe/kernel";
import { PluginCandidate } from "@svgframe/kernel/host";
import { describe, expect, it } from "vitest";
import manifest from "../package.json" with { type: "json" };
import { ModifiedStar } from "../src/ModifiedStar.js";
import TreeStarPlugin from "../src/TreeStarPlugin.js";
import { StarTestbed } from "./doubles/StarTestbed.js";

/**
 * The plugin as the composition root installs it: its own `package.json` as
 * the manifest, through the real installer (design §3.1, §3.3, §8.4).
 */
describe("TreeStarPlugin", () => {
  it("declares exactly one tree decorator, modified-star", () => {
    expect(manifest.contributes).toEqual({ decorators: ["modified-star"] });
  });

  it("installs with its own manifest: one ModifiedStar, registered as the tag and subscribed as the listener", () => {
    const registry = StarTestbed.install(StarTestbed.star());
    const [decorator] = registry.treeDecorators();
    const [listener] = registry.documentListeners();
    expect(registry.treeDecorators()).toHaveLength(1);
    expect(registry.documentListeners()).toHaveLength(1);
    expect(decorator).toBeInstanceOf(ModifiedStar);
    expect(listener).toBe(decorator);
    expect(registry.commands().commandTypes()).toEqual([]);
    expect(registry.shapes().typeNames()).toEqual([]);
    expect(registry.attributeHandlers()).toEqual([]);
  });

  it("is registered after the tags installed before it", () => {
    const registry = StarTestbed.install(StarTestbed.boxTag(), StarTestbed.star());
    expect(registry.treeDecorators().map((decorator) => decorator.name)).toEqual(["fake-box-tag", "modified-star"]);
  });

  it("two installations (two editors) each have their own ModifiedStar: a save point in one does not reach the other (TR-088)", () => {
    const first = StarTestbed.install(StarTestbed.star());
    const second = StarTestbed.install(StarTestbed.star());
    const [one] = first.treeDecorators();
    const [two] = second.treeDecorators();
    expect(one).not.toBe(two);
    const doc = StarTestbed.document([StarTestbed.rect("r1")]);
    const root: TreeRowView = { isDocumentRoot: () => true, shape: () => null, document: () => doc };
    first.documentListeners().forEach((listener) => listener.documentSaved(new SvgDocument(), "a.svg"));
    expect(one?.tagFor(root)).toBe("*");
    expect(two?.tagFor(root)).toBeNull();
    second.documentListeners().forEach((listener) => listener.documentSaved(doc, "b.svg"));
    expect(two?.tagFor(root)).toBeNull();
    expect(one?.tagFor(root)).toBe("*");
  });

  it("the candidate the testbed uses is the package's own entry and manifest", () => {
    const candidate = new PluginCandidate(manifest.name, TreeStarPlugin, manifest, PluginOptions.EMPTY);
    expect(candidate.label()).toBe("@svgframe/plugin-tree-star");
    expect(StarTestbed.star().pluginClass()).toBe(TreeStarPlugin);
    expect(StarTestbed.star().manifestJson()).toBe(manifest);
  });
});
