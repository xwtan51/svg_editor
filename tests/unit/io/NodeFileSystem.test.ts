import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { NodeFileSystem } from "../../../src/io/NodeFileSystem.js";
import { EditorError } from "../../../src/model/EditorError.js";

describe("NodeFileSystem", () => {
  let dir: string;
  const fs = new NodeFileSystem();

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "svg-editor-fs-"));
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it("writes UTF-8 text and reads it back", () => {
    const path = join(dir, "a.svg");
    fs.writeText(path, "<svg>中文</svg>\n");
    expect(readFileSync(path, "utf8")).toBe("<svg>中文</svg>\n");
    expect(fs.readText(path)).toBe("<svg>中文</svg>\n");
  });

  it("overwrites an existing file without asking (F19)", () => {
    const path = join(dir, "a.svg");
    writeFileSync(path, "old content that is longer");
    fs.writeText(path, "new");
    expect(fs.readText(path)).toBe("new");
  });

  it("reports a missing file as cannot read file: <path>", () => {
    const path = join(dir, "missing.svg");
    expect(() => fs.readText(path)).toThrow(EditorError);
    expect(() => fs.readText(path)).toThrow(`cannot read file: ${path}`);
  });

  it("reports a directory as cannot read file", () => {
    expect(() => fs.readText(dir)).toThrow(`cannot read file: ${dir}`);
  });

  it("reports a missing parent directory as cannot write file: <path>", () => {
    const path = join(dir, "no-such-dir", "a.svg");
    expect(() => fs.writeText(path, "x")).toThrow(EditorError);
    expect(() => fs.writeText(path, "x")).toThrow(`cannot write file: ${path}`);
  });
});
