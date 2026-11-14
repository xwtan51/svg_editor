/**
 * Architecture rules, checked by scanning the source of the three regions of
 * design §1.1: the kernel (packages/kernel/src), the host (src) and every
 * plugin (plugins/<directory>/src). Which rule applies where follows design
 * §1.2.1 (layer rules L1–L4, L6–L8, L10; L9 without the loader part),
 * §1.2.2 (dependency rules D1–D8 inside the kernel), §1.2.4 (README's P rules
 * per region) and §1.3 (P5a, P5b).
 *
 * Every rule is a function `(files, …) => violations` so that the bottom of
 * this file can feed it synthetic sources and prove that it really detects a
 * breach.
 *
 * Nothing about plugins is written down here: the plugin list, the package
 * names, the entry files and the registration names all come from
 * plugins/<directory>/package.json, so a new plugin is scanned and its names
 * are checked without changing this file.
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
 * - Relative specifiers are resolved against the importing file; the kernel's
 *   and the plugins' package names are resolved through their package.json
 *   `exports`. Anything else (node:*, other packages) has no target.
 * - Directories without .ts files contribute no files, so their rules pass
 *   vacuously. Guard against that: the "is scanned" tests assert that named
 *   files of every kernel module and of the host are found, that every region
 *   contributes files and that every plugin contributes at least its entry file.
 */
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, posix, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { ContributionCategory } from "../../packages/kernel/src/extension/ContributionCategory.js";
import { PluginManifest } from "../../packages/kernel/src/extension/PluginManifest.js";
import { EditorError } from "../../packages/kernel/src/model/EditorError.js";

const REPO_DIR = fileURLToPath(new URL("../../", import.meta.url));

const KERNEL_DIR = "packages/kernel";
const KERNEL_SRC = `${KERNEL_DIR}/src/`;
const HOST_SRC = "src/";
const PLUGINS_DIR = "plugins";
const KERNEL_PACKAGE = "@svgframe/kernel";
const PLUGIN_PACKAGE_PREFIX = "@svgframe/plugin-";

/** The process entry script: the only host file exempt from P5. */
const ENTRY_SCRIPT = "src/cli/main.ts";
/** L4: the only file that may import plugin packages. */
const COMPOSITION_ROOT = "src/assembly/CompositionRoot.ts";

interface SourceFile {
  /** Repository-relative location, POSIX separators, e.g. "packages/kernel/src/model/Shape.ts". */
  location: string;
  /** "kernel", "host" or "plugin:<directory>" (design §1.2.3); "other" outside the three. */
  region: string;
  /** Kernel: first directory under packages/kernel/src ("(entry)" for api.ts, host-api.ts); host: first directory under src; plugin: "(plugin)". */
  module: string;
  /** Comments removed; strings kept (import specifiers live in strings). */
  code: string;
  /** Comments removed and string contents blanked (for code patterns). */
  bare: string;
  /** Contents of every '…' / "…" literal and of every `…` template without `${`. */
  literals: string[];
}

interface ImportRef {
  from: SourceFile;
  specifier: string;
  typeOnly: boolean;
  /** Names in braces (`import { A, type B } …` → A, B); empty for other forms. */
  names: string[];
  /** Resolved repository-relative location, or null (node:*, other packages, unknown subpaths). */
  target: string | null;
}

/** One plugins/<directory>/package.json. */
interface PluginPackage {
  directory: string;
  manifest: Record<string, unknown>;
}

// ---------------------------------------------------------------- scanning

function stripSource(text: string): { code: string; bare: string; literals: string[] } {
  let code = "";
  let bare = "";
  const literals: string[] = [];
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
      const content = literal.slice(1, -1);
      if (c !== "`" || !content.includes("${")) literals.push(content);
      code += literal;
      bare += c + content.replace(/[^\n]/g, " ") + c;
      i = j + 1;
      continue;
    }
    code += c;
    bare += c;
    i++;
  }
  return { code, bare, literals };
}

function regionOf(location: string): string {
  if (location.startsWith(KERNEL_SRC)) return "kernel";
  if (location.startsWith(HOST_SRC)) return "host";
  const plugin = /^plugins\/([^/]+)\//.exec(location);
  return plugin === null ? "other" : `plugin:${plugin[1]}`;
}

function moduleOf(location: string, region: string): string {
  const firstDirectory = (rest: string, root: string) => (rest.includes("/") ? (rest.split("/")[0] ?? "") : root);
  if (region === "kernel") return firstDirectory(location.slice(KERNEL_SRC.length), "(entry)");
  if (region === "host") return firstDirectory(location.slice(HOST_SRC.length), "(root)");
  return region === "other" ? "(other)" : "(plugin)";
}

function analyze(location: string, text: string): SourceFile {
  const region = regionOf(location);
  return { location, region, module: moduleOf(location, region), ...stripSource(text) };
}

function listDirectories(dir: string): string[] {
  try {
    return readdirSync(dir).filter((name) => statSync(join(dir, name)).isDirectory());
  } catch {
    return [];
  }
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

function readJson(location: string): Record<string, unknown> {
  return JSON.parse(readFileSync(join(REPO_DIR, location), "utf8")) as Record<string, unknown>;
}

/** Every plugins/<directory>/package.json (the plugin list of design §1.2.3). */
function loadPlugins(): PluginPackage[] {
  return listDirectories(join(REPO_DIR, PLUGINS_DIR))
    .filter((directory) => existsSync(join(REPO_DIR, PLUGINS_DIR, directory, "package.json")))
    .map((directory) => ({ directory, manifest: readJson(`${PLUGINS_DIR}/${directory}/package.json`) }));
}

/** Directories under plugins/ that are not plugins (no package.json): their source would not be scanned. */
function directoriesWithoutManifest(): string[] {
  return listDirectories(join(REPO_DIR, PLUGINS_DIR)).filter(
    (directory) => !existsSync(join(REPO_DIR, PLUGINS_DIR, directory, "package.json")),
  );
}

function exportsOf(manifest: Record<string, unknown>): Record<string, unknown> {
  const exports = manifest["exports"];
  return typeof exports === "object" && exports !== null && !Array.isArray(exports) ? (exports as Record<string, unknown>) : {};
}

function packageName(plugin: PluginPackage): string {
  return typeof plugin.manifest["name"] === "string" ? plugin.manifest["name"] : "";
}

/** The repository location of a package-relative `exports` target ("./src/X.ts"), or null. */
function exportTarget(packageDir: string, target: unknown): string | null {
  return typeof target === "string" ? posix.join(packageDir, target) : null;
}

/** The entry file of a plugin: `exports["."]`. */
function entryOf(plugin: PluginPackage): string | null {
  return exportTarget(`${PLUGINS_DIR}/${plugin.directory}`, exportsOf(plugin.manifest)["."]);
}

/** Registration names per `contributes` category, from the plugins whose manifest is valid. */
function registrationNames(plugins: readonly PluginPackage[]): Map<ContributionCategory, string[]> {
  const names = new Map<ContributionCategory, string[]>(ContributionCategory.all().map((category) => [category, []]));
  for (const plugin of plugins) {
    let manifest: PluginManifest;
    try {
      manifest = PluginManifest.parse(plugin.manifest);
    } catch {
      continue; // reported by L7
    }
    for (const category of ContributionCategory.all()) {
      names.get(category)?.push(...manifest.names(category));
    }
  }
  return names;
}

/** Package specifier → repository location, for the kernel's and the plugins' `exports`. */
function packageTargets(plugins: readonly PluginPackage[]): Map<string, string> {
  const targets = new Map<string, string>();
  const kernelExports = exportsOf(readJson(`${KERNEL_DIR}/package.json`));
  for (const [key, target] of Object.entries(kernelExports)) {
    const location = exportTarget(KERNEL_DIR, target);
    if (location !== null) targets.set(posix.join(KERNEL_PACKAGE, key), location);
  }
  for (const plugin of plugins) {
    const dir = `${PLUGINS_DIR}/${plugin.directory}`;
    for (const [key, target] of Object.entries(exportsOf(plugin.manifest))) {
      const location = exportTarget(dir, target);
      if (location !== null) targets.set(posix.join(packageName(plugin), key), location);
    }
  }
  return targets;
}

/** The three scan globs of design §1.2.3. */
function scanRoots(plugins: readonly PluginPackage[]): string[] {
  return [`${KERNEL_DIR}/src`, "src", ...plugins.map((plugin) => `${PLUGINS_DIR}/${plugin.directory}/src`)];
}

function loadFiles(roots: readonly string[]): SourceFile[] {
  return roots.flatMap((root) =>
    listTypeScript(join(REPO_DIR, root)).map((full) =>
      analyze(relative(REPO_DIR, full).split(sep).join("/"), readFileSync(full, "utf8")),
    ),
  );
}

const PLUGINS = loadPlugins();
const PACKAGE_TARGETS = packageTargets(PLUGINS);
const NAMES = registrationNames(PLUGINS);
const ALL_NAMES = [...new Set([...NAMES.values()].flat())];
const PLUGIN_SHAPE_NAMES = NAMES.get(ContributionCategory.SHAPES) ?? [];
const KERNEL_ENTRY_FILES = Object.values(exportsOf(readJson(`${KERNEL_DIR}/package.json`)))
  .map((target) => exportTarget(KERNEL_DIR, target))
  .filter((location): location is string => location !== null);
const PLUGIN_ENTRY_FILES = PLUGINS.map(entryOf).filter((location): location is string => location !== null);

function isTypeOnlyClause(clause: string): boolean {
  const braced = /^\{([^}]*)\}$/.exec(clause.trim());
  if (braced === null) return false;
  const specifiers = (braced[1] ?? "").split(",").map((s) => s.trim()).filter((s) => s.length > 0);
  return specifiers.length > 0 && specifiers.every((s) => s.startsWith("type "));
}

function bracedNames(clause: string): string[] {
  const braced = /\{([^}]*)\}/.exec(clause);
  if (braced === null) return [];
  return (braced[1] ?? "")
    .split(",")
    .map((s) => s.trim().replace(/^type\s+/, "").split(/\s+as\s+/)[0]?.trim() ?? "")
    .filter((s) => s.length > 0);
}

function resolveTarget(from: SourceFile, specifier: string, targets: ReadonlyMap<string, string> = PACKAGE_TARGETS): string | null {
  if (specifier.startsWith(".")) {
    return posix.normalize(posix.join(posix.dirname(from.location), specifier)).replace(/\.js$/, ".ts");
  }
  return targets.get(specifier) ?? null;
}

function importsOf(file: SourceFile, targets: ReadonlyMap<string, string> = PACKAGE_TARGETS): ImportRef[] {
  const refs: ImportRef[] = [];
  const add = (specifier: string, typeOnly: boolean, names: string[] = []) =>
    refs.push({ from: file, specifier, typeOnly, names, target: resolveTarget(file, specifier, targets) });
  for (const m of file.code.matchAll(/\b(?:import|export)\s+(type\s+)?([^;'"`()=]*?)\s*from\s*(["'])([^"']+)\3/g)) {
    add(m[4] ?? "", m[1] !== undefined || isTypeOnlyClause(m[2] ?? ""), bracedNames(m[2] ?? ""));
  }
  for (const m of file.code.matchAll(/\bimport\s*(["'])([^"']+)\1/g)) add(m[2] ?? "", false);
  for (const m of file.code.matchAll(/\b(?:import|require)\s*\(\s*(["'])([^"']+)\1\s*\)/g)) add(m[2] ?? "", false);
  return refs;
}

function allImports(files: readonly SourceFile[]): ImportRef[] {
  return files.flatMap((file) => importsOf(file));
}

function baseName(location: string): string {
  return (location.split("/").pop() ?? "").replace(/\.ts$/, "");
}

/** Class name → direct superclass name, over all given files. */
function superclasses(files: readonly SourceFile[]): Map<string, string> {
  const result = new Map<string, string>();
  for (const file of files) {
    for (const m of file.bare.matchAll(/\bclass\s+(\w+)(?:\s*<[^>{]*>)?\s+extends\s+(\w+)/g)) {
      result.set(m[1] ?? "", m[2] ?? "");
    }
  }
  return result;
}

/** All (transitive) subclasses of any of `roots`, excluding the roots themselves. */
function descendantsOf(roots: string | readonly string[], files: readonly SourceFile[]): Set<string> {
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

function cyclesOf(edges: ReadonlyMap<string, ReadonlySet<string>>): string[] {
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

const describeImport = (ref: ImportRef) => `${ref.from.location} imports "${ref.specifier}"`;
const inRegion = (files: readonly SourceFile[], test: (region: string) => boolean) => files.filter((f) => test(f.region));
const isPlugin = (region: string) => region.startsWith("plugin:");
const isNodeBuiltin = (specifier: string) => specifier.startsWith("node:");

// ---------------------------------------------------------------- L1–L4: layers

/** L1: the kernel imports only its own files (relative) and @xmldom/xmldom (where P1 allows it). */
function kernelImportViolations(files: readonly SourceFile[]): string[] {
  return allImports(inRegion(files, (r) => r === "kernel"))
    .filter((ref) => {
      if (ref.specifier.startsWith(".")) return ref.target === null || regionOf(ref.target) !== "kernel";
      return !/^@xmldom\/xmldom(\/.*)?$/.test(ref.specifier);
    })
    .map((ref) => `${describeImport(ref)} (L1: the kernel imports only its own files)`);
}

/** The kernel's own entry files (api.ts, host-api.ts) are never imported from inside the kernel. */
function kernelEntryImportViolations(files: readonly SourceFile[], entries: readonly string[] = KERNEL_ENTRY_FILES): string[] {
  return allImports(inRegion(files, (r) => r === "kernel"))
    .filter((ref) => ref.target !== null && entries.includes(ref.target))
    .map((ref) => `${describeImport(ref)} (kernel files use relative imports, never the kernel's entry files)`);
}

/**
 * L2: plugin source imports only the bare `@svgframe/kernel`, files of its own
 * package, and node:* built-ins. Plugin tests may also import
 * `@svgframe/kernel/host` and vitest.
 */
function pluginImportViolations(files: readonly SourceFile[], tests = false): string[] {
  const allowedPackages = tests ? [KERNEL_PACKAGE, `${KERNEL_PACKAGE}/host`, "vitest"] : [KERNEL_PACKAGE];
  return allImports(inRegion(files, isPlugin))
    .filter((ref) => {
      if (ref.specifier.startsWith(".")) {
        const ownPackage = `${PLUGINS_DIR}/${ref.from.region.slice("plugin:".length)}/`;
        return ref.target === null || !ref.target.startsWith(ownPackage);
      }
      return !allowedPackages.includes(ref.specifier) && !isNodeBuiltin(ref.specifier);
    })
    .map((ref) => `${describeImport(ref)} (L2: a plugin imports only ${allowedPackages.join(", ")}, its own files and node:*)`);
}

/** L3: no plugin imports another plugin, by package name or by relative path. */
function pluginToPluginViolations(files: readonly SourceFile[]): string[] {
  return allImports(inRegion(files, isPlugin))
    .filter((ref) => {
      const byName = ref.specifier.startsWith(PLUGIN_PACKAGE_PREFIX);
      const byPath = ref.target !== null && isPlugin(regionOf(ref.target)) && regionOf(ref.target) !== ref.from.region;
      return byName || byPath;
    })
    .map((ref) => `${describeImport(ref)} (L3: plugins do not import each other)`);
}

/**
 * L4: the host imports `@svgframe/kernel`, `@svgframe/kernel/host`, its own
 * files and node:*; only the composition root imports plugin packages (bare
 * name or `<package>/package.json`). No relative path into packages/ or plugins/.
 */
function hostImportViolations(files: readonly SourceFile[]): string[] {
  return allImports(inRegion(files, (r) => r === "host"))
    .filter((ref) => {
      if (ref.specifier.startsWith(".")) return ref.target === null || regionOf(ref.target) !== "host";
      if (ref.specifier === KERNEL_PACKAGE || ref.specifier === `${KERNEL_PACKAGE}/host` || isNodeBuiltin(ref.specifier)) return false;
      const pluginPackage = /^@svgframe\/plugin-[^/]+(\/package\.json)?$/.test(ref.specifier);
      return !(pluginPackage && ref.from.location === COMPOSITION_ROOT);
    })
    .map((ref) => `${describeImport(ref)} (L4)`);
}

// ---------------------------------------------------------------- L6: no registration names in the kernel

/**
 * L6: no string literal in the kernel equals a registration name of any plugin
 * (shape types, commands, decorators, handlers). Only whole literals count: a
 * message that merely contains a name (`"no document. use 'init' or 'read' first"`)
 * is not a literal of that name.
 */
function registrationNameViolations(files: readonly SourceFile[], names: readonly string[] = ALL_NAMES): string[] {
  return inRegion(files, (r) => r === "kernel").flatMap((file) =>
    file.literals
      .filter((literal) => names.includes(literal))
      .map((literal) => `${file.location} contains the registration name "${literal}" (L6)`),
  );
}

// ---------------------------------------------------------------- L7: plugin package.json

function manifestViolations(
  plugins: readonly PluginPackage[],
  exists: (location: string) => boolean = (location) => existsSync(join(REPO_DIR, location)),
): string[] {
  const violations: string[] = [];
  for (const plugin of plugins) {
    const at = `${PLUGINS_DIR}/${plugin.directory}/package.json`;
    const { manifest } = plugin;
    if (!packageName(plugin).startsWith(PLUGIN_PACKAGE_PREFIX)) violations.push(`${at}: name must start with ${PLUGIN_PACKAGE_PREFIX}`);
    if (manifest["type"] !== "module") violations.push(`${at}: "type" must be "module"`);
    const exports = exportsOf(manifest);
    const keys = Object.keys(exports).sort();
    if (keys.join(",") !== ".,./package.json" || typeof exports["."] !== "string" || exports["./package.json"] !== "./package.json") {
      violations.push(`${at}: exports must be exactly { ".": "<entry>", "./package.json": "./package.json" }`);
    }
    try {
      PluginManifest.parse(manifest);
    } catch (error) {
      if (!(error instanceof EditorError)) throw error;
      violations.push(`${at}: ${error.message}`);
    }
    const entry = entryOf(plugin);
    if (entry !== null && !exists(entry)) violations.push(`${at}: entry file ${entry} does not exist`);
  }
  return violations;
}

// ---------------------------------------------------------------- L8: no top-level statements

/**
 * L8 (heuristic): at the top level of kernel and plugin files only import,
 * export and class / interface / type declarations — no variables, no calls.
 * Looks at lines that start in column 0 after comments and strings are removed;
 * lines that continue a construct (`}`, `)`, `]`, `;`) are skipped.
 */
function topLevelStatementViolations(files: readonly SourceFile[]): string[] {
  const allowed =
    /^(?:import\b(?!\s*\()|export\s+(?:type\b|interface\b|class\b|abstract\s+class\b|default\s+(?:abstract\s+)?class\b|\{|\*)|class\b|abstract\s+class\b|interface\b|type\b|declare\b)/;
  return inRegion(files, (r) => r === "kernel" || isPlugin(r)).flatMap((file) =>
    file.bare.split("\n").flatMap((line, i) => {
      if (line.length === 0 || /^[\s;)\]}]/.test(line) || allowed.test(line)) return [];
      return [`${file.location}:${i + 1} has a top-level statement: ${line.trim().slice(0, 40)} (L8)`];
    }),
  );
}

// ---------------------------------------------------------------- L10 and D1–D8: dependency graph

/** L10: the region graph (kernel, host, plugin:<directory>) is acyclic. */
function regionCycleViolations(files: readonly SourceFile[]): string[] {
  const edges = new Map<string, Set<string>>();
  for (const ref of allImports(files)) {
    if (ref.target === null) continue;
    const to = regionOf(ref.target);
    if (to === ref.from.region || to === "other") continue;
    const targets = edges.get(ref.from.region) ?? new Set<string>();
    targets.add(to);
    edges.set(ref.from.region, targets);
  }
  return cyclesOf(edges);
}

/** Design §1.2.2: which kernel modules each kernel module may import (D1–D4, D6; extension per D8). */
const KERNEL_DEPENDENCIES: Readonly<Record<string, readonly string[]>> = {
  model: [],
  io: ["model"],
  view: ["model"],
  commands: ["model", "view", "io"],
  extension: ["commands", "view", "model", "io"],
  app: ["extension", "commands", "model", "io"],
};

/** D5: the only io classes a plugin gets from `@svgframe/kernel` (design §1.2.2: the rule moved to the plugins). */
const IO_FOR_PLUGINS = ["FileSystem", "SvgSerializer", "SvgImporter"];

function unknownKernelModuleViolations(files: readonly SourceFile[]): string[] {
  return inRegion(files, (r) => r === "kernel")
    .filter((file) => file.module !== "(entry)" && !(file.module in KERNEL_DEPENDENCIES))
    .map((file) => `${file.location} is outside the kernel modules of design §1.1`);
}

function kernelModuleDependencyViolations(files: readonly SourceFile[], module: string): string[] {
  const allowed = KERNEL_DEPENDENCIES[module] ?? [];
  return allImports(inRegion(files, (r) => r === "kernel"))
    .filter((ref) => ref.from.module === module && ref.target !== null && regionOf(ref.target) === "kernel")
    .filter((ref) => {
      const to = moduleOf(ref.target ?? "", "kernel");
      return to !== module && !allowed.includes(to);
    })
    .map((ref) => `${describeImport(ref)} (module ${moduleOf(ref.target ?? "", "kernel")})`);
}

/** D8: the kernel's modules are acyclic. */
function kernelModuleCycleViolations(files: readonly SourceFile[]): string[] {
  const edges = new Map<string, Set<string>>();
  for (const ref of allImports(inRegion(files, (r) => r === "kernel"))) {
    if (ref.target === null || regionOf(ref.target) !== "kernel") continue;
    const to = moduleOf(ref.target, "kernel");
    if (to === ref.from.module) continue;
    const targets = edges.get(ref.from.module) ?? new Set<string>();
    targets.add(to);
    edges.set(ref.from.module, targets);
  }
  return cyclesOf(edges);
}

/** The names the kernel's public entry re-exports from io/ (read from its `export … from "./io/…"` lines). */
function ioNamesOf(api: SourceFile | undefined): string[] {
  if (api === undefined) return [];
  return [...api.code.matchAll(/export\s+(?:type\s+)?\{\s*(\w+)\s*\}\s*from\s*"\.\/io\//g)].map((m) => m[1] ?? "");
}

/**
 * D5: the kernel's public entry exports only FileSystem, SvgSerializer and
 * SvgImporter from io/, and no plugin imports any other io name from it.
 * (Design §1.2.2 names plugins/builtin-commands; the check covers every plugin.)
 */
function pluginIoViolations(files: readonly SourceFile[], apiLocation: string = PACKAGE_TARGETS.get(KERNEL_PACKAGE) ?? ""): string[] {
  const ioNames = ioNamesOf(files.find((file) => file.location === apiLocation));
  const fromApi = ioNames.filter((name) => !IO_FOR_PLUGINS.includes(name)).map((name) => `${apiLocation} exports io class ${name} (D5)`);
  const fromPlugins = allImports(inRegion(files, isPlugin))
    .filter((ref) => ref.specifier === KERNEL_PACKAGE)
    .flatMap((ref) =>
      ref.names.filter((name) => ioNames.includes(name) && !IO_FOR_PLUGINS.includes(name)).map((name) => `${describeImport(ref)} for ${name} (D5)`),
    );
  return [...fromApi, ...fromPlugins];
}

/** D7: src/cli depends only on src/assembly and the kernel package (both entries). */
function cliDependencyViolations(files: readonly SourceFile[]): string[] {
  return allImports(files.filter((file) => file.region === "host" && file.module === "cli"))
    .filter((ref) => {
      if (ref.specifier.startsWith(".")) {
        if (ref.target === null || regionOf(ref.target) !== "host") return true;
        return !["cli", "assembly"].includes(moduleOf(ref.target, "host"));
      }
      return !(ref.specifier === KERNEL_PACKAGE || ref.specifier === `${KERNEL_PACKAGE}/host` || isNodeBuiltin(ref.specifier));
    })
    .map((ref) => `${describeImport(ref)} (D7)`);
}

// ---------------------------------------------------------------- P1 / L9: IO isolation

const RESTRICTED_IMPORTS: ReadonlyArray<{ what: RegExp; allowedIn: (file: SourceFile) => boolean }> = [
  {
    what: /^(node:)?(fs(\/promises)?|module)$/,
    allowedIn: (file) => file.location.startsWith("src/adapters/") || (isPlugin(file.region) && baseName(file.location).startsWith("Node")),
  },
  { what: /^@xmldom\/xmldom(\/.*)?$/, allowedIn: (file) => file.location === `${KERNEL_SRC}io/XmlDomAdapter.ts` },
  { what: /^(node:)?readline(\/promises)?$/, allowedIn: (file) => file.location.startsWith("src/cli/") },
];

const RESTRICTED_CODE: ReadonlyArray<{ name: string; what: RegExp; allowedIn: (file: SourceFile) => boolean }> = [
  { name: "console.*", what: /\bconsole\s*\./, allowedIn: (file) => file.location.startsWith("src/cli/") },
  { name: "process.std*", what: /\bprocess\s*\.\s*std(in|out|err)\b/, allowedIn: (file) => file.location.startsWith("src/cli/") },
];

function ioIsolationViolations(files: readonly SourceFile[]): string[] {
  const byImport = allImports(files)
    .filter((ref) => RESTRICTED_IMPORTS.some((rule) => rule.what.test(ref.specifier) && !rule.allowedIn(ref.from)))
    .map(describeImport);
  const byCode = files.flatMap((file) =>
    RESTRICTED_CODE.filter((rule) => rule.what.test(file.bare) && !rule.allowedIn(file)).map((rule) => `${file.location} uses ${rule.name}`),
  );
  return [...byImport, ...byCode];
}

// ---------------------------------------------------------------- P2: name dispatch

const NAME_DISPATCH_FILES = [`${KERNEL_SRC}model/ShapeRegistry.ts`, `${KERNEL_SRC}commands/CommandRegistry.ts`];

function typeRegistryViolations(files: readonly SourceFile[]): string[] {
  return files
    .filter((file) => !NAME_DISPATCH_FILES.includes(file.location))
    .filter((file) => /\b(?:Readonly)?Map\s*<\s*string\s*,\s*(?:ShapeProvider|ShapeType|CommandType)\s*>/.test(file.bare))
    .map((file) => `${file.location} declares a Map<string, ShapeProvider | ShapeType | CommandType>`);
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
function functionMapViolations(files: readonly SourceFile[]): string[] {
  const violations: string[] = [];
  for (const file of files) {
    if (NAME_DISPATCH_FILES.includes(file.location)) continue;
    const aliases = localFunctionTypes(file);
    for (const m of file.bare.matchAll(/\b(?:(?:Readonly|Weak)?Map|Record)\s*</g)) {
      const value = typeArgumentsAt(file.bare, (m.index ?? 0) + m[0].length - 1)[1] ?? "";
      const namesAlias = [...aliases].some((alias) => new RegExp(`\\b${alias}\\b`).test(value));
      if (/=>|\bFunction\b/.test(value) || namesAlias) {
        violations.push(`${file.location}: ${m[0]}…, ${value}> maps names to functions`);
      }
    }
  }
  return violations;
}

// ---------------------------------------------------------------- P3: no type switches

const BUILT_IN_SHAPE_CLASSES = ["LeafShape", "ContainerShape", "Rect", "Circle", "Ellipse", "Line", "Text", "Group"];
/** Phase 1 shape type names; the plugins' `contributes.shapes` are added to them (design §1.2.4 P3c). */
const BUILT_IN_TYPE_NAMES = ["rect", "circle", "ellipse", "line", "text", "g"];

function switchViolations(files: readonly SourceFile[]): string[] {
  return files.filter((file) => /\bswitch\s*\(/.test(file.bare)).map((file) => `${file.location} uses switch`);
}

function instanceofViolations(files: readonly SourceFile[]): string[] {
  // Seeded with the built-ins so that `class Box extends Group` counts even when Group.ts is not scanned.
  const classes = new Set([...BUILT_IN_SHAPE_CLASSES, ...descendantsOf(["Shape", ...BUILT_IN_SHAPE_CLASSES], files)]);
  return files.flatMap((file) =>
    [...file.bare.matchAll(/\binstanceof\s+(\w+)/g)]
      .filter((m) => classes.has(m[1] ?? ""))
      .map((m) => `${file.location} uses instanceof ${m[1]}`),
  );
}

/**
 * P3c: comparisons against a shape type-name literal (`tag === "rect"`), the
 * if-else-chain form of a type switch, in the kernel and the host only: a
 * plugin recognising its own elements and type names is its job (design
 * §1.2.4). Heuristic: an attribute that shares a type name (`text`) must be
 * compared through a named constant. Command-name literals are not checked.
 */
function typeNameComparisonViolations(files: readonly SourceFile[], pluginShapeNames: readonly string[] = PLUGIN_SHAPE_NAMES): string[] {
  const names = new Set([...BUILT_IN_TYPE_NAMES, ...pluginShapeNames]);
  const alternatives = [...names].map((n) => n.replace(/[.*+?^${}()|[\]\\-]/g, "\\$&")).join("|");
  // No backreference: the pattern is used twice in one regex.
  const literal = `(?:"(?:${alternatives})"|'(?:${alternatives})')`;
  const comparison = new RegExp(`(?:[!=]==?\\s*${literal})|(?:${literal}\\s*[!=]==?)`);
  return inRegion(files, (r) => r === "kernel" || r === "host")
    .filter((file) => comparison.test(file.code))
    .map((file) => `${file.location} compares against a type name`);
}

// ---------------------------------------------------------------- P4: import direction in class hierarchies

/** A class file must not import its own subclasses at run time (Shape, LeafShape, ContainerShape, …; any region). */
function subclassImportViolations(files: readonly SourceFile[]): string[] {
  return allImports(files)
    .filter((ref) => !ref.typeOnly && ref.target !== null)
    .filter((ref) => descendantsOf(baseName(ref.from.location), files).has(baseName(ref.target ?? "")))
    .map((ref) => `${describeImport(ref)} at run time (subclass)`);
}

function concreteShapeRegistryViolations(files: readonly SourceFile[]): string[] {
  const shapeClasses = descendantsOf("Shape", files);
  return allImports(files)
    .filter((ref) => shapeClasses.has(baseName(ref.from.location)) && baseName(ref.target ?? ref.specifier) === "ShapeRegistry")
    .map(describeImport);
}

// ---------------------------------------------------------------- P5, P5a, P5b: exports

/**
 * Named exports only: `export default` is rejected in every form (class,
 * interface, expression, `export { X as default }`), because the importer could
 * pick any local name and the "file name = class name" link would be lost.
 * Exempt: the process entry script and the package entry files (P5a, P5b).
 */
function oneExportViolations(
  files: readonly SourceFile[],
  exempt: readonly string[] = [...KERNEL_ENTRY_FILES, ...PLUGIN_ENTRY_FILES],
): string[] {
  const violations: string[] = [];
  for (const file of files) {
    if (file.location === ENTRY_SCRIPT || exempt.includes(file.location)) continue;
    if (/\bexport\s+default\b|\bas\s+default\b/.test(file.bare)) {
      violations.push(`${file.location} uses a default export; export the class by name`);
      continue;
    }
    const exports = [...file.bare.matchAll(/^\s*export\b/gm)].length;
    const declared = /^\s*export\s+(?:abstract\s+)?(?:class|interface)\s+(\w+)/m.exec(file.bare);
    if (exports !== 1 || declared === null) {
      violations.push(`${file.location} has ${exports} export statement(s); expected exactly one class or interface`);
    } else if (declared[1] !== baseName(file.location)) {
      violations.push(`${file.location} exports ${declared[1]}; the file name must equal it`);
    }
  }
  return violations;
}

/**
 * P5a: the kernel's entry files contain only `export { X } from "./…/X.js";` and
 * `export type { X } from "./…/X.js";`, one name each, named like its source
 * file, and the source file exists.
 */
function kernelEntryViolations(
  files: readonly SourceFile[],
  entries: readonly string[] = KERNEL_ENTRY_FILES,
  exists: (location: string) => boolean = (location) => existsSync(join(REPO_DIR, location)),
): string[] {
  const statement = /^export (?:type )?\{ (\w+) \} from "(\.\/[\w/]+\/(\w+))\.js";$/;
  return files
    .filter((file) => entries.includes(file.location))
    .flatMap((file) =>
      file.code.split("\n").flatMap((line, i) => {
        const text = line.trim();
        if (text.length === 0) return [];
        const m = statement.exec(text);
        if (m === null) return [`${file.location}:${i + 1} is not a single named re-export (P5a): ${text.slice(0, 50)}`];
        if (m[1] !== m[3]) return [`${file.location}:${i + 1} exports ${m[1]} from ${m[3]}.js; the names must be equal (P5a)`];
        const source = posix.join(posix.dirname(file.location), `${m[2]}.ts`);
        return exists(source) ? [] : [`${file.location}:${i + 1} re-exports from a missing file ${source} (P5a)`];
      }),
    );
}

/** P5b: a plugin entry file has exactly one export: `export default class <FileName>`. */
function pluginEntryViolations(files: readonly SourceFile[], entries: readonly string[] = PLUGIN_ENTRY_FILES): string[] {
  return files
    .filter((file) => entries.includes(file.location))
    .flatMap((file) => {
      const exports = [...file.bare.matchAll(/^\s*export\b/gm)].length;
      const declared = /^export\s+default\s+class\s+(\w+)/m.exec(file.bare);
      if (exports !== 1 || declared === null) {
        return [`${file.location} has ${exports} export statement(s); expected exactly one \`export default class\` (P5b)`];
      }
      return declared[1] === baseName(file.location) ? [] : [`${file.location} exports ${declared[1]}; the file name must equal it (P5b)`];
    });
}

// ---------------------------------------------------------------- P7: the `error:` prefix

/** P7: string literals that start with `error:` appear only where the prefix is added (design §1.2.4). */
const ERROR_PREFIX_FILES = [`${KERNEL_SRC}app/Editor.ts`, "src/assembly/EditorAssembler.ts"];

function errorPrefixViolations(files: readonly SourceFile[]): string[] {
  return files
    .filter((file) => !ERROR_PREFIX_FILES.includes(file.location))
    .filter((file) => file.literals.some((literal) => literal.startsWith("error:")))
    .map((file) => `${file.location} writes the error: prefix itself (P7)`);
}

// ---------------------------------------------------------------- P8: parent pointer ownership

/**
 * Shape.attachTo / detach must be public (TypeScript has no package scope), but
 * only ChildList may call them. NOT detected: bracket access (`s["detach"]()`),
 * destructuring or aliasing the method, calls inside template-literal `${…}`.
 */
function parentPointerViolations(files: readonly SourceFile[]): string[] {
  return files
    .filter((file) => file.location !== `${KERNEL_SRC}model/ChildList.ts`)
    .flatMap((file) => [...file.bare.matchAll(/\.\s*(attachTo|detach)\s*\(/g)].map((m) => `${file.location} calls .${m[1]}(`));
}

// ---------------------------------------------------------------- P9: view does not modify the model

/**
 * README §1.1: the kernel's view module lays the model out as text and does
 * not modify it. Checked as "no call of a mutating model method in view/". NOT
 * detected: the same gaps as parentPointerViolations, and mutating methods
 * added to the model later without being listed here.
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

function viewMutationViolations(files: readonly SourceFile[]): string[] {
  const call = new RegExp(String.raw`\.\s*(${MUTATING_MODEL_METHODS.join("|")})\s*\(`, "g");
  return files
    .filter((file) => file.region === "kernel" && file.module === "view")
    .flatMap((file) => [...file.bare.matchAll(call)].map((m) => `${file.location} calls .${m[1]}(`));
}

// ---------------------------------------------------------------- the rules applied to the source

const sources = loadFiles(scanRoots(PLUGINS));
const pluginTests = loadFiles(PLUGINS.map((plugin) => `${PLUGINS_DIR}/${plugin.directory}/tests`));

describe("scanning (design §1.2.3)", () => {
  it("every region contributes files, and named files of every kernel module and of the host are found", () => {
    const locations = sources.map((file) => file.location);
    for (const location of [
      `${KERNEL_SRC}api.ts`,
      `${KERNEL_SRC}host-api.ts`,
      `${KERNEL_SRC}model/Shape.ts`,
      `${KERNEL_SRC}io/SvgImporter.ts`,
      `${KERNEL_SRC}io/XmlDomAdapter.ts`,
      `${KERNEL_SRC}view/TreeRenderer.ts`,
      `${KERNEL_SRC}commands/CommandRegistry.ts`,
      `${KERNEL_SRC}extension/PluginInstaller.ts`,
      `${KERNEL_SRC}app/Editor.ts`,
      "src/cli/main.ts",
      "src/cli/Repl.ts",
      COMPOSITION_ROOT,
      "src/assembly/EditorAssembler.ts",
      "src/adapters/NodeFileSystem.ts",
    ]) {
      expect(locations).toContain(location);
    }
    const regions = new Set(sources.map((file) => file.region));
    expect([...regions].sort()).toEqual(["host", "kernel", ...PLUGINS.map((p) => `plugin:${p.directory}`)].sort());
    for (const module of Object.keys(KERNEL_DEPENDENCIES)) {
      expect(sources.some((file) => file.region === "kernel" && file.module === module), module).toBe(true);
    }
  });

  it("the plugin list comes from plugins/*/package.json, and every directory under plugins/ is a plugin", () => {
    expect(PLUGINS.length).toBeGreaterThanOrEqual(2);
    expect(directoriesWithoutManifest()).toEqual([]);
  });

  it("every plugin contributes at least its entry file", () => {
    const locations = sources.map((file) => file.location);
    expect(PLUGIN_ENTRY_FILES).toHaveLength(PLUGINS.length);
    for (const entry of PLUGIN_ENTRY_FILES) expect(locations).toContain(entry);
  });

  it("the registration names are collected from every contributes", () => {
    expect(PLUGIN_SHAPE_NAMES).toEqual(expect.arrayContaining(BUILT_IN_TYPE_NAMES));
    expect(NAMES.get(ContributionCategory.COMMANDS)).toEqual(expect.arrayContaining(["create", "help", "canvas", "redo"]));
  });

  it("the plugins' tests are scanned for L2", () => {
    expect(pluginTests.length).toBeGreaterThan(0);
  });
});

describe("layer rules (design §1.2.1) applied to the source", () => {
  it("L1: the kernel imports only its own files and @xmldom/xmldom", () => {
    expect(kernelImportViolations(sources)).toEqual([]);
  });

  it("L1: kernel files never import the kernel's entry files (api.ts, host-api.ts)", () => {
    expect(kernelEntryImportViolations(sources)).toEqual([]);
  });

  it("L2: plugin source imports only @svgframe/kernel, its own files and node:*", () => {
    expect(pluginImportViolations(sources)).toEqual([]);
  });

  it("L2: plugin tests import only @svgframe/kernel(/host), vitest, their own package and node:*", () => {
    expect(pluginImportViolations(pluginTests, true)).toEqual([]);
  });

  it("L3: plugins do not import each other (source and tests)", () => {
    expect(pluginToPluginViolations([...sources, ...pluginTests])).toEqual([]);
  });

  it("L4: the host imports the kernel's two entries; only the composition root imports plugins", () => {
    expect(hostImportViolations(sources)).toEqual([]);
  });

  it("L6: no registration name appears as a string literal in the kernel", () => {
    expect(registrationNameViolations(sources)).toEqual([]);
  });

  it("L7: every plugin package.json has the required shape and its entry file exists", () => {
    expect(manifestViolations(PLUGINS)).toEqual([]);
  });

  it("L8: kernel and plugin files have no top-level statements", () => {
    expect(topLevelStatementViolations(sources)).toEqual([]);
  });

  it("L10: the regions depend on each other without cycles", () => {
    expect(regionCycleViolations(sources)).toEqual([]);
  });
});

describe("dependency rules D1–D8 (design §1.2.2) applied to the source", () => {
  it("every kernel file belongs to a kernel module", () => {
    expect(unknownKernelModuleViolations(sources)).toEqual([]);
  });

  it.each([
    ["D1", "model"],
    ["D2", "io"],
    ["D3", "view"],
    ["D4", "commands"],
    ["D6", "app"],
    ["D8 (extension)", "extension"],
  ])("%s: kernel module %s depends only on its allowed modules", (_rule, module) => {
    expect(kernelModuleDependencyViolations(sources, module)).toEqual([]);
  });

  it("D5: plugins get only FileSystem, SvgSerializer, SvgImporter from the kernel's io", () => {
    expect(pluginIoViolations(sources)).toEqual([]);
  });

  it("D7: src/cli depends only on src/assembly and the kernel package", () => {
    expect(cliDependencyViolations(sources)).toEqual([]);
  });

  it("D8: the kernel's modules are acyclic", () => {
    expect(kernelModuleCycleViolations(sources)).toEqual([]);
  });
});

describe("paradigm rules per region (design §1.2.4, §1.3) applied to the source", () => {
  it("P1 / L9: node:fs, node:module, @xmldom/xmldom, node:readline, console, process.std* only where allowed", () => {
    expect(ioIsolationViolations(sources)).toEqual([]);
  });

  it("P2: Map<string, ShapeProvider | ShapeType | CommandType> only in ShapeRegistry / CommandRegistry", () => {
    expect(typeRegistryViolations(sources)).toEqual([]);
  });

  it("P2: no Map from names to functions outside ShapeRegistry / CommandRegistry", () => {
    expect(functionMapViolations(sources)).toEqual([]);
  });

  it("P3a: no switch", () => {
    expect(switchViolations(sources)).toEqual([]);
  });

  it("P3b: no instanceof on shape classes", () => {
    expect(instanceofViolations(sources)).toEqual([]);
  });

  it("P3c: no comparisons against shape type names in the kernel and the host", () => {
    expect(typeNameComparisonViolations(sources)).toEqual([]);
  });

  it("P4: no class file imports its own subclasses at run time", () => {
    expect(subclassImportViolations(sources)).toEqual([]);
  });

  it("P4: concrete shape classes do not import ShapeRegistry", () => {
    expect(concreteShapeRegistryViolations(sources)).toEqual([]);
  });

  it("P5: one exported class or interface per file, named like the file", () => {
    expect(oneExportViolations(sources)).toEqual([]);
  });

  it("P5a: the kernel's entry files are single named re-exports", () => {
    expect(KERNEL_ENTRY_FILES).toEqual([`${KERNEL_SRC}api.ts`, `${KERNEL_SRC}host-api.ts`]);
    expect(kernelEntryViolations(sources)).toEqual([]);
  });

  it("P5b: every plugin entry file is one `export default class`", () => {
    expect(pluginEntryViolations(sources)).toEqual([]);
  });

  it("P7: only Editor and EditorAssembler add the error: prefix", () => {
    expect(errorPrefixViolations(sources)).toEqual([]);
  });

  it("P8: only ChildList calls .attachTo( / .detach(", () => {
    expect(parentPointerViolations(sources)).toEqual([]);
  });

  it("P9: the kernel's view calls no mutating model method", () => {
    expect(viewMutationViolations(sources)).toEqual([]);
  });
});

// ---------------------------------------------------------------- the rules detect breaches

const file = (location: string, text: string) => analyze(location, text);
const kernel = (path: string, text: string) => file(`${KERNEL_SRC}${path}`, text);
const host = (path: string, text: string) => file(`src/${path}`, text);
const plugin = (directory: string, path: string, text: string) => file(`plugins/${directory}/src/${path}`, text);
const pluginPackage = (directory: string, manifest: Record<string, unknown>): PluginPackage => ({ directory, manifest });
const VALID_MANIFEST = {
  name: "@svgframe/plugin-x",
  type: "module",
  exports: { ".": "./src/XPlugin.ts", "./package.json": "./package.json" },
  contributes: { shapes: ["x"] },
};

describe("architecture rules detect synthetic violations", () => {
  it("scanner: comments and strings do not count; multi-line and type-only imports are parsed; literals are whole", () => {
    const f = kernel(
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
        `const m = "no document. use 'init' or 'read' first";`,
        "export class A {}",
      ].join("\n"),
    );
    expect(switchViolations([f])).toEqual([]);
    expect(ioIsolationViolations([f])).toEqual([]);
    expect(importsOf(f).map((r) => [r.target, r.typeOnly])).toEqual([
      [`${KERNEL_SRC}model/B.ts`, true],
      [`${KERNEL_SRC}model/D.ts`, false],
    ]);
    expect(f.literals).toContain("no document. use 'init' or 'read' first");
    expect(f.literals).not.toContain("init");
  });

  it("regions and modules come from the location", () => {
    const files = [kernel("io/X.ts", ""), kernel("api.ts", ""), host("cli/X.ts", ""), plugin("shape-box", "X.ts", "")];
    expect(files.map((f) => [f.region, f.module])).toEqual([
      ["kernel", "io"],
      ["kernel", "(entry)"],
      ["host", "cli"],
      ["plugin:shape-box", "(plugin)"],
    ]);
  });

  it.each([
    ["a plugin package", 'import { X } from "@svgframe/plugin-builtin-shapes";'],
    ["the kernel's own package name", 'import { Shape } from "@svgframe/kernel";'],
    ["a relative path into a plugin", 'import { Group } from "../../../../plugins/builtin-shapes/src/Group.js";'],
    ["a relative path into the host", 'import { NodeFileSystem } from "../../../../src/adapters/NodeFileSystem.js";'],
    ["node:fs", 'import { readFileSync } from "node:fs";'],
    ["node:readline", 'import { createInterface } from "node:readline";'],
  ])("L1: the kernel importing %s", (_case, line) => {
    expect(kernelImportViolations([kernel("model/X.ts", line)])).toHaveLength(1);
  });

  it("L1: the kernel's own files and @xmldom/xmldom are fine", () => {
    const f = kernel("io/XmlDomAdapter.ts", 'import { DOMParser } from "@xmldom/xmldom";\nimport { A } from "../model/A.js";');
    expect(kernelImportViolations([f])).toEqual([]);
  });

  it("L1: a kernel file importing the kernel's entry file", () => {
    const entries = [`${KERNEL_SRC}api.ts`];
    expect(kernelEntryImportViolations([kernel("model/X.ts", 'import { Shape } from "../api.js";')], entries)).toHaveLength(1);
    expect(kernelEntryImportViolations([kernel("model/X.ts", 'import { Shape } from "./Shape.js";')], entries)).toEqual([]);
  });

  it.each([
    ["the host entry", 'import { Editor } from "@svgframe/kernel/host";'],
    ["a deep kernel path", 'import { Shape } from "@svgframe/kernel/src/model/Shape.js";'],
    ["another plugin", 'import { Group } from "@svgframe/plugin-builtin-shapes";'],
    ["a relative path into another plugin", 'import { Group } from "../../builtin-shapes/src/Group.js";'],
    ["a relative path into the kernel", 'import { Shape } from "../../../packages/kernel/src/model/Shape.js";'],
    ["another package", 'import { DOMParser } from "@xmldom/xmldom";'],
  ])("L2: plugin source importing %s", (_case, line) => {
    expect(pluginImportViolations([plugin("builtin-commands", "GroupCommand.ts", line)])).toHaveLength(1);
  });

  it("L2: the bare kernel, own files (also ../package.json) and node:* are fine", () => {
    const text = [
      'import { Shape } from "@svgframe/kernel";',
      'import { A } from "./A.js";',
      'import m from "../package.json" with { type: "json" };',
      'import { readdirSync } from "node:fs";',
    ].join("\n");
    expect(pluginImportViolations([plugin("command-dir", "NodeLister.ts", text)])).toEqual([]);
  });

  it("L2: plugin tests may also import the host entry and vitest, but not another plugin", () => {
    const test = (text: string) => file("plugins/shape-box/tests/X.test.ts", text);
    const allowed = 'import { Editor } from "@svgframe/kernel/host";\nimport { it } from "vitest";\nimport { B } from "../src/B.js";';
    expect(pluginImportViolations([test(allowed)], true)).toEqual([]);
    expect(pluginImportViolations([test('import { Rect } from "../../builtin-shapes/src/Rect.js";')], true)).toHaveLength(1);
  });

  it("L3: a plugin importing another plugin, by name or by path; its own files are fine", () => {
    expect(pluginToPluginViolations([plugin("builtin-commands", "G.ts", 'import { Group } from "../../builtin-shapes/src/Group.js";')])).toHaveLength(1);
    expect(pluginToPluginViolations([plugin("shape-box", "B.ts", 'import R from "@svgframe/plugin-builtin-shapes";')])).toHaveLength(1);
    expect(pluginToPluginViolations([plugin("shape-box", "B.ts", 'import { C } from "./C.js";')])).toEqual([]);
  });

  it.each([
    ["cli/main.ts", 'import C from "@svgframe/plugin-builtin-commands";'],
    ["assembly/EditorAssembler.ts", 'import m from "@svgframe/plugin-builtin-shapes/package.json" with { type: "json" };'],
    ["cli/Repl.ts", 'import type { Editor } from "../../packages/kernel/src/app/Editor.js";'],
    ["cli/Repl.ts", 'import { Shape } from "@svgframe/kernel/src/model/Shape.js";'],
  ])("L4: host file %s with %s", (path, line) => {
    expect(hostImportViolations([host(path, line)])).toHaveLength(1);
  });

  it("L4: the composition root may import plugin packages and their package.json", () => {
    const text = [
      'import P from "@svgframe/plugin-x";',
      'import m from "@svgframe/plugin-x/package.json" with { type: "json" };',
      'import { PluginCandidate } from "@svgframe/kernel/host";',
    ].join("\n");
    expect(hostImportViolations([file(COMPOSITION_ROOT, text)])).toEqual([]);
  });

  it("L6: a registration name as a whole literal in the kernel; contained in a message, or outside the kernel, it is fine", () => {
    const names = ["rect", "init", "read", "box-type-label"];
    expect(registrationNameViolations([kernel("model/X.ts", 'const t = "rect";')], names)).toHaveLength(1);
    expect(registrationNameViolations([kernel("view/X.ts", "const d = `box-type-label`;")], names)).toHaveLength(1);
    const message = `throw new EditorError("no document. use 'init' or 'read' first");`;
    expect(registrationNameViolations([kernel("app/Editor.ts", message)], names)).toEqual([]);
    expect(registrationNameViolations([plugin("builtin-shapes", "Rect.ts", 'static readonly typeName = "rect";')], names)).toEqual([]);
  });

  it.each([
    ["a name without the prefix", { ...VALID_MANIFEST, name: "box" }],
    ["no type", { ...VALID_MANIFEST, type: undefined }],
    ["type commonjs", { ...VALID_MANIFEST, type: "commonjs" }],
    ["an extra exports key", { ...VALID_MANIFEST, exports: { ...VALID_MANIFEST.exports, "./x": "./src/x.ts" } }],
    ["exports without ./package.json", { ...VALID_MANIFEST, exports: { ".": "./src/XPlugin.ts" } }],
    ["a misspelt contributes key", { ...VALID_MANIFEST, contributes: { shape: ["x"] } }],
    ["a duplicate contributes name", { ...VALID_MANIFEST, contributes: { commands: ["a", "a"] } }],
  ])("L7: %s", (_case, manifest) => {
    expect(manifestViolations([pluginPackage("x", manifest)], () => true)).toHaveLength(1);
  });

  it("L7: exports as a string (no entry can be found either)", () => {
    expect(manifestViolations([pluginPackage("x", { ...VALID_MANIFEST, exports: "./src/XPlugin.ts" })], () => true)).toEqual([
      'plugins/x/package.json: exports must be exactly { ".": "<entry>", "./package.json": "./package.json" }',
    ]);
  });

  it("L7: a missing entry file; a valid package.json passes", () => {
    expect(manifestViolations([pluginPackage("x", VALID_MANIFEST)], () => false)).toEqual([
      "plugins/x/package.json: entry file plugins/x/src/XPlugin.ts does not exist",
    ]);
    expect(manifestViolations([pluginPackage("x", VALID_MANIFEST)], () => true)).toEqual([]);
  });

  it.each([
    ["let counter = 0;"],
    ["const TABLE = new Map();"],
    ["export const X = 1;"],
    ["export function f() {}"],
    ["register(Something);"],
    ['import("./side-effect.js");'],
    ["enum E { A }"],
  ])("L8: top-level %s in a plugin and in the kernel", (line) => {
    const text = `import { A } from "./A.js";\n${line}\nexport class X {}`;
    expect(topLevelStatementViolations([plugin("builtin-shapes", "X.ts", text)])).toHaveLength(1);
    expect(topLevelStatementViolations([kernel("model/X.ts", text)])).toHaveLength(1);
  });

  it("L8: declarations, multi-line imports and class bodies are fine; the host is not checked", () => {
    const text = [
      'import {\n  A,\n  type B,\n} from "./A.js";',
      'export { C } from "./C.js";',
      "type T = number;",
      "interface I {\n  x: number;\n}",
      "export default class X implements I {\n  static readonly n = 1;\n  x = 0;\n  run(): void {\n    go();\n  }\n}",
      "export abstract class Y {}",
    ].join("\n");
    expect(topLevelStatementViolations([plugin("p", "X.ts", text), kernel("model/X.ts", text)])).toEqual([]);
    expect(topLevelStatementViolations([host("cli/main.ts", "const repl = new Repl();\nawait repl.run();")])).toEqual([]);
  });

  it("L10: a cycle between regions", () => {
    const k = kernel("model/A.ts", 'import { P } from "../../../../plugins/p/src/P.js";');
    const p = plugin("p", "P.ts", 'import { A } from "../../../packages/kernel/src/model/A.js";');
    expect(regionCycleViolations([k, p])).toEqual(["kernel -> plugin:p -> kernel"]);
  });

  it.each([
    ["D1", "model", 'import { Editor } from "../app/Editor.js";'],
    ["D1 (type-only counts)", "model", 'import type { Tree } from "../view/Tree.js";'],
    ["D2", "io", 'import { Cmd } from "../commands/Cmd.js";'],
    ["D3", "view", 'import { FileSystem } from "../io/FileSystem.js";'],
    ["D4", "commands", 'import { Plugin } from "../extension/Plugin.js";'],
    ["D6", "app", 'import { Tree } from "../view/Tree.js";'],
    ["extension", "extension", 'import { Editor } from "../app/Editor.js";'],
  ])("%s: kernel module %s", (_rule, module, line) => {
    expect(kernelModuleDependencyViolations([kernel(`${module}/X.ts`, `${line}\nexport class X {}`)], module)).toHaveLength(1);
  });

  it("D6: app may use extension, commands, model and io", () => {
    const text = [
      'import { E } from "../extension/E.js";',
      'import { C } from "../commands/C.js";',
      'import { M } from "../model/M.js";',
      'import { I } from "../io/I.js";',
    ].join("\n");
    expect(kernelModuleDependencyViolations([kernel("app/X.ts", text)], "app")).toEqual([]);
  });

  it("unknown kernel module", () => {
    expect(unknownKernelModuleViolations([kernel("utils/X.ts", "export class X {}")])).toHaveLength(1);
    expect(unknownKernelModuleViolations([kernel("api.ts", "")])).toEqual([]);
  });

  it("D5: an io class other than the three, exported by api.ts or imported by a plugin", () => {
    const api = kernel("api.ts", 'export { SvgImporter } from "./io/SvgImporter.js";\nexport { XmlElement } from "./io/XmlElement.js";');
    const user = plugin("builtin-commands", "X.ts", 'import { SvgImporter, XmlElement } from "@svgframe/kernel";');
    expect(pluginIoViolations([api, user], api.location)).toEqual([
      `${KERNEL_SRC}api.ts exports io class XmlElement (D5)`,
      `plugins/builtin-commands/src/X.ts imports "@svgframe/kernel" for XmlElement (D5)`,
    ]);
    const good = kernel("api.ts", 'export type { FileSystem } from "./io/FileSystem.js";\nexport { SvgSerializer } from "./io/SvgSerializer.js";');
    expect(pluginIoViolations([good], good.location)).toEqual([]);
  });

  it.each([
    ['import { NodeFileSystem } from "../adapters/NodeFileSystem.js";'],
    ['import { X } from "@svgframe/plugin-builtin-commands";'],
    ['import { Shape } from "../../packages/kernel/src/model/Shape.js";'],
  ])("D7: src/cli with %s", (line) => {
    expect(cliDependencyViolations([host("cli/X.ts", line)])).toHaveLength(1);
  });

  it("D7: src/cli may use src/assembly, its own files and the kernel package", () => {
    const text = [
      'import { EditorAssembler } from "../assembly/EditorAssembler.js";',
      'import { Repl } from "./Repl.js";',
      'import type { Editor } from "@svgframe/kernel/host";',
      'import { createInterface } from "node:readline";',
    ].join("\n");
    expect(cliDependencyViolations([host("cli/main.ts", text)])).toEqual([]);
  });

  it("D8", () => {
    const a = kernel("io/A.ts", 'import { B } from "../model/B.js";');
    const b = kernel("model/B.ts", 'import { A } from "../io/A.js";');
    expect(kernelModuleCycleViolations([a, b])).toEqual(["io -> model -> io"]);
  });

  it.each([
    ["the kernel", kernel("model/X.ts", 'import { readFileSync } from "node:fs";')],
    ["the kernel (bare fs)", kernel("model/X.ts", 'import fs from "fs";')],
    ["a host file outside adapters", host("assembly/X.ts", 'import { readFileSync } from "node:fs";')],
    ["a plugin file not named Node…", plugin("command-dir", "DirCommand.ts", 'import { readdirSync } from "node:fs";')],
    ["node:module in a plugin", plugin("p", "Loader.ts", 'import { createRequire } from "node:module";')],
    ["@xmldom/xmldom outside XmlDomAdapter", kernel("io/X.ts", 'import { DOMParser } from "@xmldom/xmldom";')],
    ["@xmldom/xmldom in a plugin", plugin("p", "X.ts", 'import { DOMParser } from "@xmldom/xmldom";')],
    ["node:readline outside src/cli", host("assembly/X.ts", 'import { createInterface } from "node:readline";')],
    ["console in a plugin", plugin("p", "X.ts", "console.log(1);")],
    ["process.stdout in the kernel", kernel("app/X.ts", "process.stdout.write('x');")],
  ])("P1 / L9: %s", (_case, f) => {
    expect(ioIsolationViolations([f])).toHaveLength(1);
  });

  it("P1 / L9: allowed in the designated places", () => {
    expect(
      ioIsolationViolations([
        host("adapters/NodeFileSystem.ts", 'import { readFileSync } from "node:fs";'),
        plugin("command-dir", "NodeDirectoryLister.ts", 'import { readdirSync } from "node:fs";'),
        kernel("io/XmlDomAdapter.ts", 'import { DOMParser } from "@xmldom/xmldom";'),
        host("cli/Repl.ts", 'import * as readline from "node:readline";\nconsole.log(process.stdin);'),
      ]),
    ).toEqual([]);
  });

  it("P2: type registries", () => {
    expect(typeRegistryViolations([kernel("model/X.ts", "private m = new Map<string, ShapeProvider>();")])).toHaveLength(1);
    expect(typeRegistryViolations([plugin("p", "X.ts", "private m = new Map<string, CommandType>();")])).toHaveLength(1);
    expect(typeRegistryViolations([kernel("model/ShapeRegistry.ts", "private m = new Map<string, ShapeProvider>();")])).toEqual([]);
  });

  it.each([
    ["stage-A style alias", "type StyleRule = (name: string, raw: string) => string | number;\nconst R: ReadonlyMap<string, StyleRule> = new Map();"],
    ["inline function type", "const m = new Map<string, (raw: string) => number>();"],
    ["Function", "const m: Map<string, Function> = new Map();"],
    ["call-signature interface", "interface Handler { (x: number): void }\nconst m = new Map<string, Handler>();"],
    ["Record of functions", "const r: Record<string, () => void> = {};"],
  ])("P2: function-valued map (%s), in every region", (_case, text) => {
    for (const f of [kernel("model/X.ts", text), host("assembly/X.ts", text), plugin("p", "X.ts", text)]) {
      expect(functionMapViolations([f])).toHaveLength(1);
    }
  });

  it("P2: data maps and strategy-object maps are fine", () => {
    const text = "const a = new Map<string, string>();\nconst b = new Map<string, CoordinateRole>();\nconst c = new Map<string, Array<number>>();";
    expect(functionMapViolations([kernel("model/X.ts", text)])).toEqual([]);
  });

  it("P3a, P3b: switch and instanceof on shape classes, in every region", () => {
    const makers = [(t: string) => kernel("model/X.ts", t), (t: string) => host("assembly/X.ts", t), (t: string) => plugin("p", "X.ts", t)];
    for (const make of makers) {
      expect(switchViolations([make("switch (tag) {}")])).toHaveLength(1);
      expect(instanceofViolations([make("if (s instanceof Rect) {}")])).toHaveLength(1);
      expect(instanceofViolations([make("if (s instanceof ContainerShape) {}")])).toHaveLength(1);
    }
    expect(instanceofViolations([kernel("io/X.ts", "if (e instanceof EditorError || s instanceof Shape) {}")])).toEqual([]);
  });

  it("P3b: instanceof on a subclass declared in a plugin (e.g. a future BoxShape)", () => {
    const box = plugin("shape-box", "BoxShape.ts", "export class BoxShape extends ContainerShape {}");
    const user = plugin("tree-star", "X.ts", "if (s instanceof BoxShape) {}");
    expect(instanceofViolations([box, user])).toHaveLength(1);
  });

  it("P3c: the kernel and the host must not compare type names; a plugin comparing its own type name is fine", () => {
    const line = 'if (element.name() === "g") {}';
    expect(typeNameComparisonViolations([kernel("io/SvgImporter.ts", line)])).toHaveLength(1);
    expect(typeNameComparisonViolations([host("assembly/X.ts", "if ('rect' == tag) {}")])).toHaveLength(1);
    expect(typeNameComparisonViolations([plugin("builtin-shapes", "Group.ts", line)])).toEqual([]);
    expect(typeNameComparisonViolations([plugin("shape-box", "BoxProvider.ts", 'if (kind === "box") {}')], ["box"])).toEqual([]);
  });

  it("P3c: names from the plugins' contributes.shapes count in the kernel", () => {
    expect(typeNameComparisonViolations([kernel("model/X.ts", 'if (kind === "box") {}')], ["box"])).toHaveLength(1);
    expect(typeNameComparisonViolations([kernel("model/X.ts", 'if (kind === "box") {}')], [])).toEqual([]);
  });

  it("P4: runtime import of an own subclass, in any region; type-only is fine", () => {
    const shape = kernel("model/Shape.ts", 'import { ContainerShape } from "./ContainerShape.js";\nexport abstract class Shape {}');
    const container = kernel("model/ContainerShape.ts", 'import { Shape } from "./Shape.js";\nexport abstract class ContainerShape extends Shape {}');
    expect(subclassImportViolations([shape, container])).toHaveLength(1);
    const typeOnly = kernel("model/Shape.ts", 'import type { ContainerShape } from "./ContainerShape.js";\nexport abstract class Shape {}');
    expect(subclassImportViolations([typeOnly, container])).toEqual([]);
    const base = plugin("p", "Base.ts", 'import { Sub } from "./Sub.js";\nexport class Base {}');
    const sub = plugin("p", "Sub.ts", 'import { Base } from "./Base.js";\nexport class Sub extends Base {}');
    expect(subclassImportViolations([base, sub])).toHaveLength(1);
  });

  it("P4: a concrete shape importing ShapeRegistry", () => {
    const rect = plugin("p", "Rect.ts", 'import type { ShapeRegistry } from "../../../packages/kernel/src/model/ShapeRegistry.js";\nexport class Rect extends LeafShape {}');
    const leaf = kernel("model/LeafShape.ts", "export abstract class LeafShape extends Shape {}");
    expect(concreteShapeRegistryViolations([rect, leaf])).toHaveLength(1);
  });

  it("P5", () => {
    expect(oneExportViolations([kernel("model/X.ts", "export class X {}\nexport class Y {}")])).toHaveLength(1);
    expect(oneExportViolations([plugin("p", "X.ts", "export class Y {}")])).toHaveLength(1);
    expect(oneExportViolations([host("assembly/X.ts", "export function x() {}")])).toHaveLength(1);
    expect(oneExportViolations([kernel("model/X.ts", "class X {}")])).toHaveLength(1);
  });

  it.each([
    ["default class", "export default class Bad {}"],
    ["default abstract class", "export default abstract class Bad {}"],
    ["default interface", "export default interface Bad {}"],
    ["default expression", "class Bad {}\nexport default Bad;"],
    ["re-export as default", "class Bad {}\nexport { Bad as default };"],
  ])("P5: rejects %s even when named like the file, outside the package entry files", (_case, text) => {
    expect(oneExportViolations([plugin("p", "Bad.ts", text)], [])).toEqual([
      "plugins/p/src/Bad.ts uses a default export; export the class by name",
    ]);
  });

  it("P5: the named form is fine, and so are the entry script and the package entry files", () => {
    expect(oneExportViolations([kernel("model/Bad.ts", "export class Bad {}")])).toEqual([]);
    expect(oneExportViolations([kernel("model/X.ts", "type T = number;\nexport abstract class X {}")])).toEqual([]);
    expect(oneExportViolations([file(ENTRY_SCRIPT, "console.log(1);")])).toEqual([]);
    expect(oneExportViolations([plugin("p", "PPlugin.ts", "export default class PPlugin {}")], ["plugins/p/src/PPlugin.ts"])).toEqual([]);
  });

  it.each([
    ["export *", 'export * from "./model/Shape.js";'],
    ["two names", 'export { Shape, LeafShape } from "./model/Shape.js";'],
    ["a renamed export", 'export { Shape as Base } from "./model/Shape.js";'],
    ["a name unlike its file", 'export { Shape } from "./model/LeafShape.js";'],
    ["a declaration", "export class Api {}"],
    ["a default export", 'export { default } from "./model/Shape.js";'],
    ["an import", 'import { Shape } from "./model/Shape.js";'],
  ])("P5a: %s in an entry file", (_case, line) => {
    const entry = kernel("api.ts", `export { Shape } from "./model/Shape.js";\n${line}`);
    expect(kernelEntryViolations([entry], [entry.location], () => true)).toHaveLength(1);
  });

  it("P5a: single named re-exports pass; a missing source file does not", () => {
    const entry = kernel("api.ts", '/** doc */\nexport { Shape } from "./model/Shape.js";\nexport type { ShapeProvider } from "./model/ShapeProvider.js";');
    expect(kernelEntryViolations([entry], [entry.location], () => true)).toEqual([]);
    expect(kernelEntryViolations([entry], [entry.location], () => false)).toHaveLength(2);
  });

  it.each([
    ["a second export", "export default class XPlugin {}\nexport class Helper {}"],
    ["a named class", "export class XPlugin {}"],
    ["a default instance", "export default new XPlugin();"],
    ["a class unlike its file", "export default class OtherPlugin {}"],
  ])("P5b: %s in a plugin entry", (_case, text) => {
    expect(pluginEntryViolations([plugin("x", "XPlugin.ts", text)], ["plugins/x/src/XPlugin.ts"])).toHaveLength(1);
  });

  it("P5b: one default-exported class named like the file passes", () => {
    const entry = plugin("x", "XPlugin.ts", "export default class XPlugin implements Plugin {}");
    expect(pluginEntryViolations([entry], ["plugins/x/src/XPlugin.ts"])).toEqual([]);
  });

  it("P7: an error: prefix written outside Editor / EditorAssembler", () => {
    expect(errorPrefixViolations([plugin("p", "X.ts", 'return ["error: nope"];')])).toHaveLength(1);
    expect(errorPrefixViolations([kernel("app/Editor.ts", 'private static readonly ERROR_PREFIX = "error: ";')])).toEqual([]);
    expect(errorPrefixViolations([host("cli/Repl.ts", "write(`internal error: ${x}`);")])).toEqual([]);
  });

  it("P8: attachTo / detach outside ChildList", () => {
    expect(parentPointerViolations([kernel("model/ContainerShape.ts", "shape.attachTo(this);")])).toHaveLength(1);
    expect(parentPointerViolations([plugin("p", "X.ts", "shape?.detach();")])).toHaveLength(1);
    expect(parentPointerViolations([kernel("model/ChildList.ts", "shape.attachTo(this.owner); shape.detach();")])).toEqual([]);
    expect(parentPointerViolations([kernel("model/Shape.ts", "attachTo(container: ShapeContainer): void {}")])).toEqual([]);
  });

  it("P9: the kernel's view module only", () => {
    expect(viewMutationViolations([kernel("view/Bad.ts", "shape.moveBy(1, 2); doc.insertAt(s, 0);")])).toEqual([
      `${KERNEL_SRC}view/Bad.ts calls .moveBy(`,
      `${KERNEL_SRC}view/Bad.ts calls .insertAt(`,
    ]);
    expect(viewMutationViolations([kernel("view/Ok.ts", "shape.summary(); // shape.moveBy(1, 2)")])).toEqual([]);
    expect(viewMutationViolations([kernel("commands/X.ts", "shape.moveBy(1, 2);"), plugin("p", "view/X.ts", "shape.moveBy(1, 2);")])).toEqual([]);
  });
});
