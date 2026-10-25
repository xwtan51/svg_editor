/**
 * Architecture rules of doc/README.md §3 (D1–D8, P1–P5, plus the rule that only
 * ChildList may call Shape.attachTo / detach), checked by scanning src/.
 *
 * Every rule is a function `(files) => violations` so that the bottom of this
 * file can feed it synthetic sources and prove that it really detects a breach.
 *
 * Method and its limits (regular expressions, not a TypeScript parser):
 * - Comments are removed first, so rule words inside comments never count.
 *   Code-pattern rules additionally blank out string and template-literal
 *   contents (including `${…}` expressions inside templates — code hidden there
 *   is not seen). Regular-expression literals are not recognised: a regex
 *   containing a quote or `//` can confuse the comment / string stripper.
 * - Imports are found in `import … from`, `export … from`, `import "x"`,
 *   `import("x")` and `require("x")` with literal specifiers; computed
 *   specifiers are not seen. An import counts as type-only when written
 *   `import type` / `export type`, or when every braced specifier has `type`.
 * - Module = first directory under src/. Directories without .ts files (empty
 *   or missing) contribute no files, so their rules pass; see the "is scanned" tests.
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const SRC_DIR = fileURLToPath(new URL("../../src/", import.meta.url));

/** The process entry script: the only file exempt from P5. */
const ENTRY_SCRIPT = "cli/main.ts";

interface SourceFile {
  /** Relative to src/, POSIX separators, e.g. "model/Shape.ts". */
  path: string;
  /** First directory under src/, e.g. "model". */
  module: string;
  /** Comments removed; strings kept (import specifiers live in strings). */
  code: string;
  /** Comments removed and string contents blanked (for code patterns). */
  bare: string;
}

interface ImportRef {
  from: SourceFile;
  specifier: string;
  typeOnly: boolean;
  /** Target path relative to src/ (".ts"), or null for package / node: imports. */
  target: string | null;
}

// ---------------------------------------------------------------- scanning

function stripSource(text: string): { code: string; bare: string } {
  let code = "";
  let bare = "";
  let i = 0;
  while (i < text.length) {
    const c = text.charAt(i);
    const next = text.charAt(i + 1);
    if (c === "/" && next === "/") {
      while (i < text.length && text.charAt(i) !== "\n") i++;
      continue;
    }
    if (c === "/" && next === "*") {
      const end = text.indexOf("*/", i + 2);
      const stop = end < 0 ? text.length : end + 2;
      const newlines = text.slice(i, stop).replace(/[^\n]/g, "");
      code += newlines;
      bare += newlines;
      i = stop;
      continue;
    }
    if (c === '"' || c === "'" || c === "`") {
      let j = i + 1;
      while (j < text.length && text.charAt(j) !== c) {
        j += text.charAt(j) === "\\" ? 2 : 1;
      }
      const literal = text.slice(i, j + 1);
      code += literal;
      bare += c + literal.slice(1, -1).replace(/[^\n]/g, " ") + c;
      i = j + 1;
      continue;
    }
    code += c;
    bare += c;
    i++;
  }
  return { code, bare };
}

function analyze(path: string, text: string): SourceFile {
  const module = path.includes("/") ? (path.split("/")[0] ?? "") : "(src root)";
  return { path, module, ...stripSource(text) };
}

function listTypeScript(dir: string): string[] {
  let entries: string[];
  try {
    entries = readdirSync(dir);
  } catch {
    return [];
  }
  return entries.flatMap((name) => {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) return listTypeScript(full);
    return name.endsWith(".ts") && !name.endsWith(".d.ts") ? [full] : [];
  });
}

function loadSources(): SourceFile[] {
  return listTypeScript(SRC_DIR).map((full) =>
    analyze(relative(SRC_DIR, full).split(sep).join("/"), readFileSync(full, "utf8")),
  );
}

function resolveTarget(from: SourceFile, specifier: string): string | null {
  if (!specifier.startsWith(".")) return null;
  const absolute = resolve(SRC_DIR, dirname(from.path), specifier);
  return relative(SRC_DIR, absolute).split(sep).join("/").replace(/\.js$/, ".ts");
}

function moduleOfPath(path: string): string {
  if (path.startsWith("..")) return "(outside src)";
  return path.includes("/") ? (path.split("/")[0] ?? "") : "(src root)";
}

function isTypeOnlyClause(clause: string): boolean {
  const braced = /^\{([^}]*)\}$/.exec(clause.trim());
  if (braced === null) return false;
  const specifiers = (braced[1] ?? "").split(",").map((s) => s.trim()).filter((s) => s.length > 0);
  return specifiers.length > 0 && specifiers.every((s) => s.startsWith("type "));
}

function importsOf(file: SourceFile): ImportRef[] {
  const refs: ImportRef[] = [];
  const add = (specifier: string, typeOnly: boolean) =>
    refs.push({ from: file, specifier, typeOnly, target: resolveTarget(file, specifier) });
  for (const m of file.code.matchAll(/\b(?:import|export)\s+(type\s+)?([^;'"`()=]*?)\s*from\s*(["'])([^"']+)\3/g)) {
    add(m[4] ?? "", m[1] !== undefined || isTypeOnlyClause(m[2] ?? ""));
  }
  for (const m of file.code.matchAll(/\bimport\s*(["'])([^"']+)\1/g)) add(m[2] ?? "", false);
  for (const m of file.code.matchAll(/\b(?:import|require)\s*\(\s*(["'])([^"']+)\1\s*\)/g)) add(m[2] ?? "", false);
  return refs;
}

function allImports(files: SourceFile[]): ImportRef[] {
  return files.flatMap(importsOf);
}

function baseName(path: string): string {
  return (path.split("/").pop() ?? "").replace(/\.ts$/, "");
}

/** Class name → direct superclass name, over all given files. */
function superclasses(files: SourceFile[]): Map<string, string> {
  const result = new Map<string, string>();
  for (const file of files) {
    for (const m of file.bare.matchAll(/\bclass\s+(\w+)(?:\s*<[^>{]*>)?\s+extends\s+(\w+)/g)) {
      result.set(m[1] ?? "", m[2] ?? "");
    }
  }
  return result;
}

/** All (transitive) subclasses of any of `roots`, excluding the roots themselves. */
function descendantsOf(roots: string | readonly string[], files: SourceFile[]): Set<string> {
  const rootSet = new Set(typeof roots === "string" ? [roots] : roots);
  const parents = superclasses(files);
  const result = new Set<string>();
  let grew = true;
  while (grew) {
    grew = false;
    for (const [child, parent] of parents) {
      if ((rootSet.has(parent) || result.has(parent)) && !result.has(child) && !rootSet.has(child)) {
        result.add(child);
        grew = true;
      }
    }
  }
  return result;
}

const describeImport = (ref: ImportRef) => `${ref.from.path} imports "${ref.specifier}"`;

// ---------------------------------------------------------------- D: module dependencies

/** §3.1: which modules each module may import (D1–D4, D6, D7). */
const ALLOWED_DEPENDENCIES: Readonly<Record<string, readonly string[]>> = {
  model: [],
  io: ["model"],
  view: ["model"],
  commands: ["model", "view", "io"],
  app: ["commands", "model", "io"],
  cli: ["app"],
};

/** D5: the only io files commands may import. */
const IO_ALLOWED_FOR_COMMANDS = ["io/FileSystem.ts", "io/SvgSerializer.ts", "io/SvgImporter.ts"];

function unknownModuleViolations(files: SourceFile[]): string[] {
  return files
    .filter((file) => !(file.module in ALLOWED_DEPENDENCIES))
    .map((file) => `${file.path} is outside the modules of §1.1`);
}

function moduleDependencyViolations(files: SourceFile[], module: string): string[] {
  const allowed = ALLOWED_DEPENDENCIES[module] ?? [];
  return allImports(files)
    .filter((ref) => ref.from.module === module && ref.target !== null)
    .filter((ref) => {
      const targetModule = moduleOfPath(ref.target ?? "");
      return targetModule !== module && !allowed.includes(targetModule);
    })
    .map((ref) => `${describeImport(ref)} (module ${moduleOfPath(ref.target ?? "")})`);
}

function commandsIoViolations(files: SourceFile[]): string[] {
  return allImports(files)
    .filter((ref) => ref.from.module === "commands" && ref.target !== null)
    .filter((ref) => moduleOfPath(ref.target ?? "") === "io" && !IO_ALLOWED_FOR_COMMANDS.includes(ref.target ?? ""))
    .map(describeImport);
}

function moduleCycleViolations(files: SourceFile[]): string[] {
  const edges = new Map<string, Set<string>>();
  for (const ref of allImports(files)) {
    if (ref.target === null) continue;
    const to = moduleOfPath(ref.target);
    if (to === ref.from.module) continue;
    const targets = edges.get(ref.from.module) ?? new Set<string>();
    targets.add(to);
    edges.set(ref.from.module, targets);
  }
  const cycles: string[] = [];
  const done = new Set<string>();
  const visit = (node: string, stack: string[]) => {
    if (stack.includes(node)) {
      cycles.push([...stack.slice(stack.indexOf(node)), node].join(" -> "));
      return;
    }
    if (done.has(node)) return;
    for (const next of edges.get(node) ?? []) visit(next, [...stack, node]);
    done.add(node);
  };
  for (const node of edges.keys()) visit(node, []);
  return cycles;
}

// ---------------------------------------------------------------- P1: IO isolation

const RESTRICTED_IMPORTS: ReadonlyArray<{ what: RegExp; allowedIn: (path: string) => boolean }> = [
  { what: /^(node:)?fs(\/promises)?$/, allowedIn: (path) => path === "io/NodeFileSystem.ts" },
  { what: /^@xmldom\/xmldom(\/.*)?$/, allowedIn: (path) => path === "io/XmlDomAdapter.ts" },
  { what: /^(node:)?readline(\/promises)?$/, allowedIn: (path) => path.startsWith("cli/") },
];

const RESTRICTED_CODE: ReadonlyArray<{ name: string; what: RegExp; allowedIn: (path: string) => boolean }> = [
  { name: "console.*", what: /\bconsole\s*\./, allowedIn: (path) => path.startsWith("cli/") },
  { name: "process.std*", what: /\bprocess\s*\.\s*std(in|out|err)\b/, allowedIn: (path) => path.startsWith("cli/") },
];

function ioIsolationViolations(files: SourceFile[]): string[] {
  const byImport = allImports(files)
    .filter((ref) => RESTRICTED_IMPORTS.some((rule) => rule.what.test(ref.specifier) && !rule.allowedIn(ref.from.path)))
    .map(describeImport);
  const byCode = files.flatMap((file) =>
    RESTRICTED_CODE.filter((rule) => rule.what.test(file.bare) && !rule.allowedIn(file.path)).map(
      (rule) => `${file.path} uses ${rule.name}`,
    ),
  );
  return [...byImport, ...byCode];
}

// ---------------------------------------------------------------- P2: name dispatch

const NAME_DISPATCH_FILES = ["model/ShapeFactory.ts", "commands/CommandRegistry.ts"];

function typeRegistryViolations(files: SourceFile[]): string[] {
  return files
    .filter((file) => !NAME_DISPATCH_FILES.includes(file.path))
    .filter((file) => /\b(?:Readonly)?Map\s*<\s*string\s*,\s*(?:ShapeType|CommandType)\s*>/.test(file.bare))
    .map((file) => `${file.path} declares a Map<string, ShapeType | CommandType>`);
}

/** The comma-separated type arguments of the `<…>` that starts at `open`. */
function typeArgumentsAt(text: string, open: number): string[] {
  const args: string[] = [];
  let depth = 0;
  let current = "";
  for (let i = open; i < text.length; i++) {
    const c = text.charAt(i);
    if (c === "=" && text.charAt(i + 1) === ">") {
      current += "=>";
      i++;
      continue;
    }
    if ("<([{".includes(c)) {
      depth++;
      if (depth === 1) continue;
    } else if (">)]}".includes(c)) {
      depth--;
      if (depth === 0) {
        args.push(current.trim());
        return args;
      }
    } else if (c === "," && depth === 1) {
      args.push(current.trim());
      current = "";
      continue;
    }
    current += c;
  }
  return args;
}

/** Type aliases / interfaces declared in this file that denote functions. */
function localFunctionTypes(file: SourceFile): Set<string> {
  const names = new Set<string>();
  for (const m of file.bare.matchAll(/\btype\s+(\w+)(?:\s*<[^=]*>)?\s*=\s*([^;]+);/g)) {
    if (/=>|\bFunction\b/.test(m[2] ?? "")) names.add(m[1] ?? "");
  }
  for (const m of file.bare.matchAll(/\binterface\s+(\w+)[^{]*\{\s*(?:<[^>]*>\s*)?\(/g)) names.add(m[1] ?? "");
  return names;
}

/**
 * P2, implementation lookup by name: no Map (or Record) whose value type is a
 * function, outside the two dispatch files. Detects value types that contain
 * `=>`, mention `Function`, or name a function type alias / call-signature
 * interface declared in the same file (the stage-A `Map<string, StyleRule>`).
 *
 * NOT detected: a Map without type arguments whose type is inferred
 * (`new Map([["fill", parseColor]])`); function types imported from another
 * file; object-literal dispatch tables without a `Record<…>` annotation;
 * index signatures (`{ [name: string]: Fn }`); arrays searched by name
 * (`Array<[string, Fn]>`). Maps of strategy *objects* (classes) are allowed by design.
 */
function functionMapViolations(files: SourceFile[]): string[] {
  const violations: string[] = [];
  for (const file of files) {
    if (NAME_DISPATCH_FILES.includes(file.path)) continue;
    const aliases = localFunctionTypes(file);
    for (const m of file.bare.matchAll(/\b(?:(?:Readonly|Weak)?Map|Record)\s*</g)) {
      const value = typeArgumentsAt(file.bare, (m.index ?? 0) + m[0].length - 1)[1] ?? "";
      const namesAlias = [...aliases].some((alias) => new RegExp(`\\b${alias}\\b`).test(value));
      if (/=>|\bFunction\b/.test(value) || namesAlias) {
        violations.push(`${file.path}: ${m[0]}…, ${value}> maps names to functions`);
      }
    }
  }
  return violations;
}

// ---------------------------------------------------------------- P3: no type switches

const BUILT_IN_SHAPE_CLASSES = ["LeafShape", "Rect", "Circle", "Ellipse", "Line", "Text", "Group"];
const BUILT_IN_TYPE_NAMES = ["rect", "circle", "ellipse", "line", "text", "g"];

function switchViolations(files: SourceFile[]): string[] {
  return files.filter((file) => /\bswitch\s*\(/.test(file.bare)).map((file) => `${file.path} uses switch`);
}

function instanceofViolations(files: SourceFile[]): string[] {
  // Seeded with the built-ins so that `class Box extends Group` counts even when Group.ts is not scanned.
  const classes = new Set([...BUILT_IN_SHAPE_CLASSES, ...descendantsOf(["Shape", ...BUILT_IN_SHAPE_CLASSES], files)]);
  return files.flatMap((file) =>
    [...file.bare.matchAll(/\binstanceof\s+(\w+)/g)]
      .filter((m) => classes.has(m[1] ?? ""))
      .map((m) => `${file.path} uses instanceof ${m[1]}`),
  );
}

/**
 * Comparisons against a shape type-name literal (`tag === "rect"`), the
 * if-else-chain form of a type switch. Type names are the built-ins plus every
 * `static … typeName … = "x"` found in src/. Heuristic: an attribute that shares
 * a type name (`text`) must be compared through a named constant. Command-name
 * literals are not checked.
 */
function typeNameComparisonViolations(files: SourceFile[]): string[] {
  const names = new Set(BUILT_IN_TYPE_NAMES);
  for (const file of files) {
    for (const m of file.code.matchAll(/\bstatic\s+(?:readonly\s+)?typeName\b[^=]*=\s*["']([^"']+)["']/g)) {
      names.add(m[1] ?? "");
    }
  }
  const alternatives = [...names].map((n) => n.replace(/[.*+?^${}()|[\]\\-]/g, "\\$&")).join("|");
  // No backreference: the pattern is used twice in one regex.
  const literal = `(?:"(?:${alternatives})"|'(?:${alternatives})')`;
  const comparison = new RegExp(`(?:[!=]==?\\s*${literal})|(?:${literal}\\s*[!=]==?)`);
  return files.filter((file) => comparison.test(file.code)).map((file) => `${file.path} compares against a type name`);
}

// ---------------------------------------------------------------- P4: import direction in the shape hierarchy

/** A class file must not import its own subclasses at run time (README: Shape, LeafShape; also Group). */
function subclassImportViolations(files: SourceFile[]): string[] {
  const modelFiles = files.filter((file) => file.module === "model");
  return allImports(modelFiles)
    .filter((ref) => !ref.typeOnly && ref.target !== null)
    .filter((ref) => descendantsOf(baseName(ref.from.path), modelFiles).has(baseName(ref.target ?? "")))
    .map((ref) => `${describeImport(ref)} at run time (subclass)`);
}

function concreteShapeFactoryViolations(files: SourceFile[]): string[] {
  const shapeClasses = descendantsOf("Shape", files.filter((file) => file.module === "model"));
  return allImports(files)
    .filter((ref) => shapeClasses.has(baseName(ref.from.path)) && baseName(ref.target ?? "") === "ShapeFactory")
    .map(describeImport);
}

// ---------------------------------------------------------------- P5: one export per file

/**
 * Named exports only: `export default` is rejected in every form (class,
 * interface, expression, `export { X as default }`), because the importer could
 * pick any local name and the "file name = class name" link would be lost.
 */
function oneExportViolations(files: SourceFile[]): string[] {
  const violations: string[] = [];
  for (const file of files) {
    if (file.path === ENTRY_SCRIPT) continue;
    if (/\bexport\s+default\b|\bas\s+default\b/.test(file.bare)) {
      violations.push(`${file.path} uses a default export; export the class by name`);
      continue;
    }
    const exports = [...file.bare.matchAll(/^\s*export\b/gm)].length;
    const declared = /^\s*export\s+(?:abstract\s+)?(?:class|interface)\s+(\w+)/m.exec(file.bare);
    if (exports !== 1 || declared === null) {
      violations.push(`${file.path} has ${exports} export statement(s); expected exactly one class or interface`);
    } else if (declared[1] !== baseName(file.path)) {
      violations.push(`${file.path} exports ${declared[1]}; the file name must equal it`);
    }
  }
  return violations;
}

// ---------------------------------------------------------------- parent pointer ownership

/**
 * Shape.attachTo / detach must be public (TypeScript has no package scope), but
 * only ChildList may call them. NOT detected: bracket access (`s["detach"]()`),
 * destructuring or aliasing the method, calls inside template-literal `${…}`.
 */
function parentPointerViolations(files: SourceFile[]): string[] {
  return files
    .filter((file) => file.path !== "model/ChildList.ts")
    .flatMap((file) =>
      [...file.bare.matchAll(/\.\s*(attachTo|detach)\s*\(/g)].map((m) => `${file.path} calls .${m[1]}(`),
    );
}

// ---------------------------------------------------------------- the rules applied to src/

const sources = loadSources();

describe("architecture (README §3) applied to src/", () => {
  it("scans the source tree", () => {
    const paths = sources.map((file) => file.path);
    expect(paths).toContain("model/Shape.ts");
    expect(paths).toContain(ENTRY_SCRIPT);
  });

  it("every file belongs to a module of §1.1", () => {
    expect(unknownModuleViolations(sources)).toEqual([]);
  });

  it("D1: model depends on no other module", () => {
    expect(moduleDependencyViolations(sources, "model")).toEqual([]);
  });

  it("D2: io depends only on model", () => {
    expect(moduleDependencyViolations(sources, "io")).toEqual([]);
  });

  it("D3: view depends only on model", () => {
    expect(moduleDependencyViolations(sources, "view")).toEqual([]);
  });

  it("D4: commands depends only on model, view, io", () => {
    expect(moduleDependencyViolations(sources, "commands")).toEqual([]);
  });

  it("D5: commands uses only FileSystem, SvgSerializer, SvgImporter from io", () => {
    expect(commandsIoViolations(sources)).toEqual([]);
  });

  it("D6: app depends only on commands, model, io", () => {
    expect(moduleDependencyViolations(sources, "app")).toEqual([]);
  });

  it("D7: cli depends only on app", () => {
    expect(moduleDependencyViolations(sources, "cli")).toEqual([]);
  });

  it("D8: module dependencies are acyclic", () => {
    expect(moduleCycleViolations(sources)).toEqual([]);
  });

  it("P1: node:fs, @xmldom/xmldom, node:readline, console, process.std* only where allowed", () => {
    expect(ioIsolationViolations(sources)).toEqual([]);
  });

  it("P2: Map<string, ShapeType | CommandType> only in ShapeFactory / CommandRegistry", () => {
    expect(typeRegistryViolations(sources)).toEqual([]);
  });

  it("P2: no Map from names to functions outside ShapeFactory / CommandRegistry", () => {
    expect(functionMapViolations(sources)).toEqual([]);
  });

  it("P3: no switch", () => {
    expect(switchViolations(sources)).toEqual([]);
  });

  it("P3: no instanceof on shape classes", () => {
    expect(instanceofViolations(sources)).toEqual([]);
  });

  it("P3: no comparisons against shape type names", () => {
    expect(typeNameComparisonViolations(sources)).toEqual([]);
  });

  it("P4: no class file imports its own subclasses at run time", () => {
    expect(subclassImportViolations(sources)).toEqual([]);
  });

  it("P4: concrete shape classes do not import ShapeFactory", () => {
    expect(concreteShapeFactoryViolations(sources)).toEqual([]);
  });

  it("P5: one exported class or interface per file, named like the file", () => {
    expect(oneExportViolations(sources)).toEqual([]);
  });

  it("only ChildList calls .attachTo( / .detach(", () => {
    expect(parentPointerViolations(sources)).toEqual([]);
  });
});

// ---------------------------------------------------------------- the rules detect breaches

const file = (path: string, text: string) => analyze(path, text);

describe("architecture rules detect synthetic violations", () => {
  it("scanner: comments and strings do not count; multi-line and type-only imports are parsed", () => {
    const f = file(
      "model/A.ts",
      [
        "// switch (x) console.log",
        "/* import { X } from '../io/X.js'; */",
        "import {",
        "  type B,",
        "  type C,",
        '} from "./B.js";',
        'import { D } from "./D.js";',
        'const s = "switch (y) console.log";',
        "export class A {}",
      ].join("\n"),
    );
    expect(switchViolations([f])).toEqual([]);
    expect(ioIsolationViolations([f])).toEqual([]);
    expect(importsOf(f).map((r) => [r.target, r.typeOnly])).toEqual([
      ["model/B.ts", true],
      ["model/D.ts", false],
    ]);
  });

  it("unknown module", () => {
    expect(unknownModuleViolations([file("utils/X.ts", "export class X {}")])).toHaveLength(1);
  });

  it.each([
    ["D1", "model", 'import { Editor } from "../app/Editor.js";'],
    ["D1 (type-only counts)", "model", 'import type { Tree } from "../view/Tree.js";'],
    ["D2", "io", 'import { Cmd } from "../commands/Cmd.js";'],
    ["D3", "view", 'import { FileSystem } from "../io/FileSystem.js";'],
    ["D4", "commands", 'import { Editor } from "../app/Editor.js";'],
    ["D6", "app", 'import { Tree } from "../view/Tree.js";'],
    ["D7", "cli", 'import { Shape } from "../model/Shape.js";'],
  ])("%s: %s", (_rule, module, line) => {
    expect(moduleDependencyViolations([file(`${module}/X.ts`, `${line}\nexport class X {}`)], module)).toHaveLength(1);
  });

  it("D5", () => {
    const f = file("commands/X.ts", 'import { NodeFileSystem } from "../io/NodeFileSystem.js";');
    expect(commandsIoViolations([f])).toHaveLength(1);
    expect(commandsIoViolations([file("commands/Y.ts", 'import type { FileSystem } from "../io/FileSystem.js";')])).toEqual([]);
  });

  it("D8", () => {
    const a = file("io/A.ts", 'import { B } from "../model/B.js";');
    const b = file("model/B.ts", 'import { A } from "../io/A.js";');
    expect(moduleCycleViolations([a, b])).toEqual(["io -> model -> io"]);
  });

  it.each([
    ['import { readFileSync } from "node:fs";'],
    ['import fs from "fs";'],
    ['import { DOMParser } from "@xmldom/xmldom";'],
    ['import { createInterface } from "node:readline";'],
    ["console.log(1);"],
    ["process.stdout.write('x');"],
  ])("P1: %s outside its allowed file", (line) => {
    expect(ioIsolationViolations([file("model/X.ts", line)])).toHaveLength(1);
  });

  it("P1: allowed in the designated files", () => {
    expect(
      ioIsolationViolations([
        file("io/NodeFileSystem.ts", 'import { readFileSync } from "node:fs";'),
        file("io/XmlDomAdapter.ts", 'import { DOMParser } from "@xmldom/xmldom";'),
        file("cli/Repl.ts", 'import * as readline from "node:readline";\nconsole.log(process.stdin);'),
      ]),
    ).toEqual([]);
  });

  it("P2: type registries", () => {
    expect(typeRegistryViolations([file("model/X.ts", "private m = new Map<string, ShapeType>();")])).toHaveLength(1);
    expect(typeRegistryViolations([file("model/ShapeFactory.ts", "private m = new Map<string, ShapeType>();")])).toEqual([]);
  });

  it.each([
    ["stage-A style alias", "type StyleRule = (name: string, raw: string) => string | number;\nconst R: ReadonlyMap<string, StyleRule> = new Map();"],
    ["inline function type", "const m = new Map<string, (raw: string) => number>();"],
    ["Function", "const m: Map<string, Function> = new Map();"],
    ["call-signature interface", "interface Handler { (x: number): void }\nconst m = new Map<string, Handler>();"],
    ["Record of functions", "const r: Record<string, () => void> = {};"],
  ])("P2: function-valued map (%s)", (_case, text) => {
    expect(functionMapViolations([file("model/X.ts", text)])).toHaveLength(1);
  });

  it("P2: data maps and strategy-object maps are fine", () => {
    const text = "const a = new Map<string, string>();\nconst b = new Map<string, CoordinateRole>();\nconst c = new Map<string, Array<number>>();";
    expect(functionMapViolations([file("model/X.ts", text)])).toEqual([]);
  });

  it("P3", () => {
    expect(switchViolations([file("model/X.ts", "switch (tag) {}")])).toHaveLength(1);
    expect(instanceofViolations([file("model/X.ts", "if (s instanceof Rect) {}")])).toHaveLength(1);
    expect(instanceofViolations([file("model/X.ts", "if (e instanceof EditorError) {}")])).toEqual([]);
    expect(typeNameComparisonViolations([file("io/X.ts", 'if (tag === "rect") {}')])).toHaveLength(1);
    expect(typeNameComparisonViolations([file("io/X.ts", "if ('g' == tag) {}")])).toHaveLength(1);
  });

  it("P3: instanceof on a subclass found in src (e.g. a future Box)", () => {
    const box = file("model/Box.ts", "export class Box extends Group {}");
    const user = file("commands/X.ts", "if (s instanceof Box) {}");
    expect(instanceofViolations([box, user])).toHaveLength(1);
  });

  it("P4: runtime import of an own subclass; type-only is fine", () => {
    const shape = file("model/Shape.ts", 'import { Group } from "./Group.js";\nexport abstract class Shape {}');
    const group = file("model/Group.ts", 'import { Shape } from "./Shape.js";\nexport class Group extends Shape {}');
    expect(subclassImportViolations([shape, group])).toHaveLength(1);
    const typeOnly = file("model/Shape.ts", 'import type { Group } from "./Group.js";\nexport abstract class Shape {}');
    expect(subclassImportViolations([typeOnly, group])).toEqual([]);
  });

  it("P4: concrete shape importing ShapeFactory", () => {
    const rect = file("model/Rect.ts", 'import type { ShapeFactory } from "./ShapeFactory.js";\nexport class Rect extends LeafShape {}');
    const leaf = file("model/LeafShape.ts", "export abstract class LeafShape extends Shape {}");
    expect(concreteShapeFactoryViolations([rect, leaf])).toHaveLength(1);
  });

  it("P5", () => {
    expect(oneExportViolations([file("model/X.ts", "export class X {}\nexport class Y {}")])).toHaveLength(1);
    expect(oneExportViolations([file("model/X.ts", "export class Y {}")])).toHaveLength(1);
    expect(oneExportViolations([file("model/X.ts", "export function x() {}")])).toHaveLength(1);
    expect(oneExportViolations([file("model/X.ts", "class X {}")])).toHaveLength(1);
  });

  it.each([
    ["default class", "export default class Bad {}"],
    ["default abstract class", "export default abstract class Bad {}"],
    ["default interface", "export default interface Bad {}"],
    ["default expression", "class Bad {}\nexport default Bad;"],
    ["re-export as default", "class Bad {}\nexport { Bad as default };"],
  ])("P5: rejects %s even when named like the file", (_case, text) => {
    expect(oneExportViolations([file("model/Bad.ts", text)])).toEqual([
      "model/Bad.ts uses a default export; export the class by name",
    ]);
  });

  it("P5: the named form of the same class is fine", () => {
    expect(oneExportViolations([file("model/Bad.ts", "export class Bad {}")])).toEqual([]);
    expect(oneExportViolations([file("model/X.ts", "type T = number;\nexport abstract class X {}")])).toEqual([]);
    expect(oneExportViolations([file(ENTRY_SCRIPT, "console.log(1);")])).toEqual([]);
  });

  it("attachTo / detach outside ChildList", () => {
    expect(parentPointerViolations([file("model/Group.ts", "shape.attachTo(this);")])).toHaveLength(1);
    expect(parentPointerViolations([file("commands/X.ts", "shape?.detach();")])).toHaveLength(1);
    expect(parentPointerViolations([file("model/ChildList.ts", "shape.attachTo(this.owner); shape.detach();")])).toEqual([]);
    expect(parentPointerViolations([file("model/Shape.ts", "attachTo(container: ShapeContainer): void {}")])).toEqual([]);
  });
});

// ---------------------------------------------------------------- view does not modify the model (appended with src/view/)

/**
 * README §1.1: view lays the model out as text and does not modify it. Checked
 * as "no call of a mutating model method in view/". NOT detected: the same
 * gaps as parentPointerViolations, and mutating methods added to the model
 * later without being listed here.
 */
const MUTATING_MODEL_METHODS = [
  "moveBy",
  "scaleBy",
  "setAttribute",
  "addExtraAttribute",
  "restore",
  "insertAt",
  "remove",
  "resize",
  "attachTo",
  "detach",
];

function viewMutationViolations(files: SourceFile[]): string[] {
  const call = new RegExp(String.raw`\.\s*(${MUTATING_MODEL_METHODS.join("|")})\s*\(`, "g");
  return files
    .filter((file) => file.module === "view")
    .flatMap((file) => [...file.bare.matchAll(call)].map((m) => `${file.path} calls .${m[1]}(`));
}

describe("view (README §1.1, §3.1 D3) applied to src/", () => {
  it("view/ is scanned, so D3 is not satisfied vacuously", () => {
    const paths = sources.map((file) => file.path);
    expect(paths).toContain("view/TreeRenderer.ts");
    expect(paths).toContain("view/ShapeDetailRenderer.ts");
  });

  it("view calls no mutating model method", () => {
    expect(viewMutationViolations(sources)).toEqual([]);
  });

  it("the rule detects synthetic violations and ignores other modules", () => {
    expect(viewMutationViolations([file("view/Bad.ts", "shape.moveBy(1, 2); doc.insertAt(s, 0);")])).toEqual([
      "view/Bad.ts calls .moveBy(",
      "view/Bad.ts calls .insertAt(",
    ]);
    expect(viewMutationViolations([file("view/Ok.ts", "shape.summary(); // shape.moveBy(1, 2)")])).toEqual([]);
    expect(viewMutationViolations([file("commands/X.ts", "shape.moveBy(1, 2);")])).toEqual([]);
  });
});

describe("app and cli (README §3.1 D6, D7, §3.2 P1) applied to src/", () => {
  it("app/ and cli/ are scanned, so D6, D7 and P1 are not satisfied vacuously", () => {
    const paths = sources.map((file) => file.path);
    expect(paths).toContain("app/Editor.ts");
    expect(paths).toContain("app/EditorSession.ts");
    expect(paths).toContain("cli/Repl.ts");
    expect(paths).toContain(ENTRY_SCRIPT);
  });
});
