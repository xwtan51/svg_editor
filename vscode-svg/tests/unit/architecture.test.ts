/**
 * Structure rules for src/ (Phase 1 conventions plus the A.1 layering):
 * - one exported class per file, file name = class name, named exports only
 *   (extension.ts is the entry module required by VSCode — exempt, like cli/main.ts);
 * - src/core/ never imports `vscode` in any form;
 * - VscodeResourceKindReader imports `vscode` for types only;
 * - nothing under src/ imports a Node built-in module, and the type library stays
 *   at ES2022, so the bundle runs on the Node 18 of VSCode 1.85's extension host (VA10).
 *
 * Simple text scanning after removing comments — enough for this small tree.
 */
import { readdirSync, readFileSync } from "node:fs";
import { builtinModules } from "node:module";
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

const importSpecifier = /(?:\bfrom|\bimport|\brequire\()\s*["']([^"']+)["']/g;
const vscodeImport = /(?:from|import|require\()\s*["']vscode["']/;
const runtimeVscodeImport = /^\s*import\s+(?!type\b)[^;]*["']vscode["']/m;

describe("architecture", () => {
  const all = sources("");

  it("scans the expected files", () => {
    expect(all.filter((f) => f.startsWith("core")).map((f) => basename(f)).sort()).toEqual([
      // A.1 file badge
      "Badge.ts", "FileTypeMask.ts", "ResourceKind.ts", "ResourcePath.ts", "SchemeFilter.ts", "SvgBadgeRule.ts",
      // A.2 outline
      "OpenElement.ts", "OutlineNode.ts", "OutlineRole.ts", "OutlineTreeBuilder.ts", "SourceSpan.ts",
      "SvgOutline.ts", "SvgOutlineParser.ts",
      "XmlAttributeDecoder.ts", "XmlEndTag.ts", "XmlStartTag.ts", "XmlSyntaxError.ts", "XmlTokenizer.ts",
    ].sort());
    expect(all.filter((f) => f.startsWith("host")).map((f) => basename(f)).sort()).toEqual([
      "SvgFileDecorationProvider.ts", "SvgResourceWatcher.ts", "VscodeResourceKindReader.ts",
    ].sort());
    expect(all.filter((f) => !f.startsWith("core") && !f.startsWith("host"))).toEqual([ENTRY]);
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

  it("VA10: src/ imports no Node built-in module (the extension host may be Node 18)", () => {
    const builtins = new Set(builtinModules);
    for (const file of all) {
      for (const [, specifier] of code(file).matchAll(importSpecifier)) {
        expect(specifier!.startsWith("node:") || builtins.has(specifier!), `${file}: ${specifier}`).toBe(false);
      }
    }
  });

  it("VA10: type-checks against the ES2022 library, which Node 18 implements in full", () => {
    const tsconfig = readFileSync(new URL("../../tsconfig.json", import.meta.url), "utf8");
    expect(tsconfig).toMatch(/"lib":\s*\["ES2022"\]/);
  });

  it("the detectors themselves work", () => {
    expect([...'import { a } from "node:fs"; import "./x.js"; require("path");'.matchAll(importSpecifier)].map((m) => m[1]))
      .toEqual(["node:fs", "./x.js", "path"]);
    expect('import { window } from "vscode";').toMatch(runtimeVscodeImport);
    expect('import type { Uri } from "vscode";').not.toMatch(runtimeVscodeImport);
    expect('const v = require("vscode");').toMatch(vscodeImport);
  });
});
