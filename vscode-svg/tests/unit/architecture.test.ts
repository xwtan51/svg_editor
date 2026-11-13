/**
 * Structure rules for src/ (Phase 1 conventions plus the A.1 layering):
 * - one exported class per file, file name = class name, named exports only
 *   (extension.ts is the entry module required by VSCode — exempt, like cli/main.ts);
 * - src/core/ never imports `vscode` in any form;
 * - VscodeResourceKindReader imports `vscode` for types only.
 *
 * Simple text scanning after removing comments — enough for this small tree.
 */
import { readdirSync, readFileSync } from "node:fs";
import { basename, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const SRC = fileURLToPath(new URL("../../src/", import.meta.url));
const ENTRY = "extension.ts";

function sources(dir: string): string[] {
  return readdirSync(join(SRC, dir), { recursive: true, encoding: "utf8" })
    .filter((f) => f.endsWith(".ts"))
    .map((f) => join(dir, f));
}

function code(relative: string): string {
  return readFileSync(join(SRC, relative), "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "");
}

const vscodeImport = /(?:from|import|require\()\s*["']vscode["']/;
const runtimeVscodeImport = /^\s*import\s+(?!type\b)[^;]*["']vscode["']/m;

describe("architecture", () => {
  const all = sources("");

  it("scans the expected files", () => {
    expect(all.map((f) => basename(f)).sort()).toEqual([
      "Badge.ts", "FileTypeMask.ts", "ResourceKind.ts", "ResourcePath.ts", "SchemeFilter.ts",
      "SvgBadgeRule.ts", "SvgFileDecorationProvider.ts", "SvgResourceWatcher.ts",
      "VscodeResourceKindReader.ts", "extension.ts",
    ]);
  });

  it("one exported class per file, named after the file; no default export", () => {
    for (const file of all.filter((f) => basename(f) !== ENTRY)) {
      const text = code(file);
      const exported = [...text.matchAll(/^export\s+(?:abstract\s+)?(class|interface|function|const|let|type|enum)\s+(\w+)/gm)];
      expect(exported.map((m) => `${m[1]} ${m[2]}`), file).toEqual([`class ${basename(file, ".ts")}`]);
      expect(text, file).not.toMatch(/export\s+default/);
    }
  });

  it("the entry module exports only activate and deactivate", () => {
    const exported = [...code(ENTRY).matchAll(/^export\s+(?:async\s+)?(\w+)\s+(\w+)/gm)].map((m) => m[2]);
    expect(exported).toEqual(["activate", "deactivate"]);
  });

  it("src/core does not depend on vscode", () => {
    const core = sources("core");
    expect(core.length).toBeGreaterThan(0);
    for (const file of core) {
      expect(code(file), file).not.toMatch(vscodeImport);
    }
  });

  it("the type adapter imports vscode for types only", () => {
    const text = code(join("host", "VscodeResourceKindReader.ts"));
    expect(text).toMatch(vscodeImport);
    expect(text).not.toMatch(runtimeVscodeImport);
  });

  it("the detectors themselves work", () => {
    expect('import { window } from "vscode";').toMatch(runtimeVscodeImport);
    expect('import type { Uri } from "vscode";').not.toMatch(runtimeVscodeImport);
    expect('const v = require("vscode");').toMatch(vscodeImport);
  });
});
