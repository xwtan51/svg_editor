import { realpathSync } from "node:fs";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { EditorError } from "../../../packages/kernel/src/model/EditorError.js";
import { PluginConfig } from "../../../src/loader/PluginConfig.js";
import { PluginConfigEntry } from "../../../src/loader/PluginConfigEntry.js";
import { TempWorkspace } from "../../support/TempWorkspace.js";

/** Strict parsing of plugin configurations (design §4.4, decision X29). */
const FILE = "/configs/plugins.config.json";
const parse = (text: string) => PluginConfig.parse(text, FILE);
const json = (value: unknown) => JSON.stringify(value);

describe("PluginConfig", () => {
  it("a valid configuration: entries in array order, module strings as written, defaults for enabled and options", () => {
    const config = parse(
      json({
        plugins: [
          { module: "@svgframe/plugin-shape-box" },
          { module: "./plugins/tree-star", enabled: true },
          { module: "@x/diamond", options: { fill: "#f5a623", nested: { list: [1, 2] } } },
          { module: "@x/export-png", enabled: false },
        ],
      }),
    );
    expect(config.file()).toBe(FILE);
    expect(config.entries().map((entry) => entry.module())).toEqual([
      "@svgframe/plugin-shape-box",
      "./plugins/tree-star",
      "@x/diamond",
      "@x/export-png",
    ]);
    expect(config.entries().map((entry) => entry.isEnabled())).toEqual([true, true, true, false]);
    expect(config.entries()[0]?.options().isEmpty()).toBe(true);
    expect(config.entries()[2]?.options().string("fill", "")).toBe("#f5a623");
    expect(config.entries()[2]?.options().get("nested")).toEqual({ list: [1, 2] });
  });

  it("an empty plugin list is valid", () => {
    expect(parse('{ "plugins": [] }').entries()).toEqual([]);
  });

  it("options are a frozen deep copy", () => {
    const options = { nested: { list: [1] } };
    const text = json({ plugins: [{ module: "m", options }] });
    const nested = parse(text).entries()[0]?.options().get("nested") as { list: number[] };
    expect(Object.isFrozen(nested)).toBe(true);
    expect(Object.isFrozen(nested.list)).toBe(true);
  });

  it.each([
    ["a syntax error", '{ "plugins": [ }'],
    ["an empty file", ""],
    ["a second top-level key", json({ plugins: [], extra: 1 })],
    ["no plugins key", json({ plugin: [] })],
    ["an empty top-level object", "{}"],
    ["a top level that is an array", json([{ module: "m" }])],
    ["a top level that is null", "null"],
    ["a top level that is a string", json("plugins")],
    ["plugins not an array", json({ plugins: { module: "m" } })],
    ["plugins null", json({ plugins: null })],
    ["an entry that is not an object", json({ plugins: ["m"] })],
    ["an entry that is null", json({ plugins: [null] })],
    ["an entry that is an array", json({ plugins: [["m"]] })],
    ["an entry without module", json({ plugins: [{ enabled: true }] })],
    ["module an empty string", json({ plugins: [{ module: "" }] })],
    ["module not a string", json({ plugins: [{ module: 1 }] })],
    ["an entry with an unknown key", json({ plugins: [{ module: "m", option: {} }] })],
    ["enabled not a boolean", json({ plugins: [{ module: "m", enabled: "false" }] })],
    ["enabled null", json({ plugins: [{ module: "m", enabled: null }] })],
    ["options an array", json({ plugins: [{ module: "m", options: [] }] })],
    ["options null", json({ plugins: [{ module: "m", options: null }] })],
    ["options a string", json({ plugins: [{ module: "m", options: "fill" }] })],
  ])("invalid plugin config: %s", (_case, text) => {
    expect(() => parse(text)).toThrow(new EditorError("invalid plugin config"));
  });

  it("one bad entry makes the whole configuration unusable, wherever it is", () => {
    const good = { module: "@x/good" };
    for (const plugins of [
      [{ module: "" }, good, good],
      [good, { module: "m", enabled: 0 }, good],
      [good, good, { module: "m", extra: true }],
      [good, { module: "m", enabled: false, options: [] }],
    ]) {
      expect(() => parse(json({ plugins }))).toThrow(new EditorError("invalid plugin config"));
    }
  });

  it("the failure is an EditorError (a user error), without the error: prefix", () => {
    try {
      parse("[");
      expect.unreachable();
    } catch (error) {
      expect(error).toBeInstanceOf(EditorError);
      expect((error as Error).message).toBe("invalid plugin config");
    }
  });
});

describe("PluginConfig.read", () => {
  let workspace: TempWorkspace;
  let cwd: string;

  beforeEach(() => {
    workspace = new TempWorkspace();
    cwd = process.cwd();
  });

  afterEach(() => {
    process.chdir(cwd);
    workspace.remove();
  });

  it("reads and parses the file; file() is its absolute path", () => {
    const location = workspace.writeConfig([{ module: "./a" }]);
    const config = PluginConfig.read(location);
    expect(config.file()).toBe(location);
    expect(config.entries().map((entry) => entry.module())).toEqual(["./a"]);
  });

  it("a relative path is relative to the current directory", () => {
    workspace.writeConfig([{ module: "./a" }], "sub/my.json");
    process.chdir(workspace.root);
    const config = PluginConfig.read("sub/my.json");
    expect(realpathSync(config.file())).toBe(realpathSync(workspace.path("sub", "my.json")));
  });

  it("a missing file: cannot read plugin config: <path as given>", () => {
    process.chdir(workspace.root);
    expect(() => PluginConfig.read("nope/plugins.json")).toThrow(new EditorError("cannot read plugin config: nope/plugins.json"));
    expect(() => PluginConfig.read(join(workspace.root, "x.json"))).toThrow(
      new EditorError(`cannot read plugin config: ${join(workspace.root, "x.json")}`),
    );
  });

  it("a directory cannot be read as a configuration", () => {
    expect(() => PluginConfig.read(workspace.root)).toThrow(new EditorError(`cannot read plugin config: ${workspace.root}`));
  });

  it("a readable but malformed file: invalid plugin config", () => {
    const location = workspace.writeText("bad.json", '{ "plugins": [ { "module": "" } ] }');
    expect(() => PluginConfig.read(location)).toThrow(new EditorError("invalid plugin config"));
  });
});

describe("PluginConfigEntry", () => {
  it("parses one entry; null for a malformed one", () => {
    const entry = PluginConfigEntry.parse({ module: "m", enabled: false, options: { a: 1 } });
    expect(entry?.module()).toBe("m");
    expect(entry?.isEnabled()).toBe(false);
    expect(entry?.options().number("a", 0)).toBe(1);
    expect(PluginConfigEntry.parse({ module: "m", enabled: 1 })).toBeNull();
  });
});
