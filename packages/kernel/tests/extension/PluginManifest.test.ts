import { describe, expect, it } from "vitest";
import { ContributionCategory } from "../../src/extension/ContributionCategory.js";
import { PluginManifest } from "../../src/extension/PluginManifest.js";
import { EditorError } from "../../src/model/EditorError.js";

/** `contributes` parsing, strict (design §3.3.2, N11). */
describe("PluginManifest", () => {
  it("reads the name and the four categories in the order written", () => {
    const manifest = PluginManifest.parse({
      name: "@test/x",
      version: "0.1.0",
      type: "module",
      contributes: { shapes: ["box", "star"], commands: ["stats"], decorators: ["d"], attributes: ["a"] },
    });
    expect(manifest.name()).toBe("@test/x");
    expect(manifest.names(ContributionCategory.SHAPES)).toEqual(["box", "star"]);
    expect(manifest.names(ContributionCategory.COMMANDS)).toEqual(["stats"]);
    expect(manifest.names(ContributionCategory.DECORATORS)).toEqual(["d"]);
    expect(manifest.names(ContributionCategory.ATTRIBUTES)).toEqual(["a"]);
  });

  it("treats a missing contributes and missing categories as empty", () => {
    const manifest = PluginManifest.parse({ name: "p" });
    for (const category of ContributionCategory.all()) {
      expect(manifest.names(category)).toEqual([]);
    }
    expect(PluginManifest.parse({ name: "p", contributes: { commands: [] } }).names(ContributionCategory.SHAPES)).toEqual([]);
  });

  it.each([
    ["not an object", [], "manifest must be a JSON object"],
    ["null", null, "manifest must be a JSON object"],
    ["no name", { contributes: {} }, "name must be a non-empty string"],
    ["empty name", { name: "" }, "name must be a non-empty string"],
    ["name not a string", { name: 3 }, "name must be a non-empty string"],
    ["contributes an array", { name: "p", contributes: [] }, "contributes must be an object"],
    ["contributes null", { name: "p", contributes: null }, "contributes must be an object"],
    ["misspelt key", { name: "p", contributes: { shape: ["box"] } }, "unknown contributes key: shape"],
    ["names not an array", { name: "p", contributes: { shapes: "box" } }, "contributes.shapes must be an array of non-empty strings"],
    ["empty name in list", { name: "p", contributes: { commands: [""] } }, "contributes.commands must be an array of non-empty strings"],
    ["non-string in list", { name: "p", contributes: { commands: [1] } }, "contributes.commands must be an array of non-empty strings"],
    ["duplicate in list", { name: "p", contributes: { shapes: ["a", "b", "a"] } }, "duplicate name in contributes.shapes: a"],
  ])("rejects %s", (_case, json, reason) => {
    expect(() => PluginManifest.parse(json)).toThrow(new EditorError(reason));
  });
});
