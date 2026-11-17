import { GitRepository } from "../shared/GitRepository.js";

/**
 * `npm run plugin-diff -- <C> plugins/<new directory> --mode A|B`: the
 * criteria of spec §6 for the commit `C` that adds a plugin, with the real
 * paths of design §1.5. Everything is read from the commits `C^` and `C`,
 * never from the working tree.
 *
 * Sections, in order (each prints what it looked at):
 *
 * 0. Paths: `packages/kernel`, `src/loader`, `plugins`,
 *    `src/assembly/CompositionRoot.ts` and `plugins.config.json` exist in both
 *    `C^` and `C`; the new plugin directory exists in `C` and not in `C^`.
 * 1. Files: `git diff --name-status C^ C`; files outside `packages/`, `src/`
 *    and `plugins/` are listed again as "explain in the PR" (allowed by spec
 *    §6, not a failure).
 * 2. Common criterion: no change under `packages/kernel`, `src/loader` or
 *    `plugins` once the new plugin directory is excluded.
 * 2A / 2B. Way A: among `packages`, `src`, `plugins` (new directory excluded)
 *    exactly `M src/assembly/CompositionRoot.ts`, and `plugins.config.json`
 *    unchanged (decision X24). Way B: nothing among them, and
 *    `plugins.config.json` changed.
 * 3. Loader independence, for manual review only:
 *    `git grep -n -E "import|require|switch" C -- src/loader` without the
 *    `C:` prefix (the same lines as `rg --sort path` on a checkout of `C`).
 *
 * The last line is `plugin-diff: PASS` (exit 0) or
 * `plugin-diff: FAIL (<reason>; …)` (exit 1); a usage error (or a failing git
 * command) exits 2.
 */
export class PluginDiffCheck {
  static readonly USAGE = "usage: plugin-diff <commit> plugins/<new directory> --mode A|B\n";

  private static readonly KERNEL = "packages/kernel";
  private static readonly LOADER = "src/loader";
  private static readonly PLUGINS = "plugins";
  private static readonly COMPOSITION_ROOT = "src/assembly/CompositionRoot.ts";
  private static readonly CONFIG = "plugins.config.json";
  private static readonly REQUIRED = [
    PluginDiffCheck.KERNEL,
    PluginDiffCheck.LOADER,
    PluginDiffCheck.PLUGINS,
    PluginDiffCheck.COMPOSITION_ROOT,
    PluginDiffCheck.CONFIG,
  ];
  /** Top-level directories that hold run code (and the plugins' tests and manifests). */
  private static readonly CODE_ROOTS = ["packages/", "src/", "plugins/"];
  private static readonly MODES = ["A", "B"];
  private static readonly PLUGIN_DIR = /^plugins\/([^/]+)\/?$/;
  private static readonly LOADER_PATTERN = "import|require|switch";

  private readonly out: NodeJS.WritableStream;
  private readonly git: GitRepository;
  private readonly reasons: string[] = [];

  constructor(out: NodeJS.WritableStream, git: GitRepository = new GitRepository(process.cwd())) {
    this.out = out;
    this.git = git;
  }

  /** Parses the command line and runs the check; returns the exit code. */
  main(args: readonly string[]): number {
    try {
      return this.run(args);
    } catch (error) {
      this.out.write(`plugin-diff: error: ${error instanceof Error ? error.message : String(error)}\n`);
      return 2;
    }
  }

  private run(args: readonly string[]): number {
    const [rev, pluginArg, flag, mode, ...rest] = args;
    const directory = PluginDiffCheck.PLUGIN_DIR.exec(pluginArg ?? "")?.[1];
    if (
      rev === undefined ||
      flag !== "--mode" ||
      mode === undefined ||
      !PluginDiffCheck.MODES.includes(mode) ||
      rest.length > 0 ||
      directory === undefined ||
      directory === "." ||
      directory === ".."
    ) {
      return this.usage("");
    }
    const commit = this.git.commit(rev);
    if (commit === null) {
      return this.usage(`not a commit: ${rev}`);
    }
    const parents = this.git.parents(commit);
    const [parent] = parents;
    if (parents.length !== 1 || parent === undefined) {
      return this.usage(`${rev} must have exactly one parent (it has ${parents.length})`);
    }
    return this.check(commit, parent, `${PluginDiffCheck.PLUGINS}/${directory}`, mode === "A");
  }

  private check(commit: string, parent: string, plugin: string, wayA: boolean): number {
    const exclude = `:(exclude)${plugin}`;
    const subject = this.git.text(["log", "-1", "--format=%s", commit]).trim();
    this.out.write(`plugin-diff: C = ${commit} (${subject})\n`);
    this.out.write(`             C^ = ${parent}, new plugin ${plugin}, way ${wayA ? "A" : "B"}\n`);

    this.section("0. paths exist (git cat-file -e)");
    for (const path of PluginDiffCheck.REQUIRED) {
      const missing = [parent, commit].filter((sha) => !this.git.exists(sha, path)).map((sha) => (sha === parent ? "C^" : "C"));
      this.verdict(missing.length === 0, `${path}: in C^ and C`, `${path}: missing in ${missing.join(" and ")}`);
    }
    this.verdict(this.git.exists(commit, plugin), `${plugin}: in C`, `${plugin}: missing in C`);
    this.verdict(!this.git.exists(parent, plugin), `${plugin}: not in C^`, `${plugin}: already in C^ (not a new plugin)`);

    this.section("1. files changed (git diff --name-status C^ C)");
    const all = this.git.nameStatus(parent, commit);
    this.list(all);
    const outside = all.filter((line) => !PluginDiffCheck.CODE_ROOTS.some((root) => PluginDiffCheck.pathOf(line).startsWith(root)));
    this.out.write("-- outside packages/, src/, plugins/ (allowed; explain each in the PR):\n");
    this.list(outside);

    this.section(`2. kernel, loader and existing plugins unchanged (git diff C^ C -- ${PluginDiffCheck.KERNEL} ${PluginDiffCheck.LOADER} ${PluginDiffCheck.PLUGINS} '${exclude}')`);
    const common = this.git.nameStatus(parent, commit, [PluginDiffCheck.KERNEL, PluginDiffCheck.LOADER, PluginDiffCheck.PLUGINS, exclude]);
    this.list(common);
    this.verdict(common.length === 0, "empty", `changed: ${common.map(PluginDiffCheck.pathOf).join(", ")}`);

    const code = this.git.nameStatus(parent, commit, ["packages", "src", PluginDiffCheck.PLUGINS, exclude]);
    const config = this.git.nameStatus(parent, commit, [PluginDiffCheck.CONFIG]);
    if (wayA) {
      this.section(`2A. way A: only ${PluginDiffCheck.COMPOSITION_ROOT} changes (git diff C^ C -- packages src plugins '${exclude}'), ${PluginDiffCheck.CONFIG} unchanged`);
      this.list(code);
      const expected = `M\t${PluginDiffCheck.COMPOSITION_ROOT}`;
      const others = code.filter((line) => line !== expected);
      this.verdict(others.length === 0, "nothing besides the composition root", `way A: changed besides the composition root: ${others.map(PluginDiffCheck.pathOf).join(", ")}`);
      this.verdict(code.includes(expected), `${PluginDiffCheck.COMPOSITION_ROOT} modified`, `way A: ${PluginDiffCheck.COMPOSITION_ROOT} not modified`);
      this.verdict(config.length === 0, `${PluginDiffCheck.CONFIG} unchanged`, `way A: ${PluginDiffCheck.CONFIG} changed`);
    } else {
      this.section(`2B. way B: no run code changes (git diff C^ C -- packages src plugins '${exclude}'), ${PluginDiffCheck.CONFIG} changed`);
      this.list(code);
      this.verdict(code.length === 0, "empty", `way B: run code changed: ${code.map(PluginDiffCheck.pathOf).join(", ")}`);
      this.verdict(config.length > 0, `${PluginDiffCheck.CONFIG} changed`, `way B: ${PluginDiffCheck.CONFIG} not changed`);
    }

    this.section(`3. loader independence, for manual review only (git grep -n -E "${PluginDiffCheck.LOADER_PATTERN}" C -- ${PluginDiffCheck.LOADER})`);
    const grep = this.git.run(["grep", "--no-color", "-n", "-E", PluginDiffCheck.LOADER_PATTERN, commit, "--", PluginDiffCheck.LOADER]);
    if (grep.status > 1) {
      throw new Error(`git grep failed (${grep.status}): ${grep.stderr.trim()}`);
    }
    this.list(GitRepository.lines(grep.stdout).map((line) => (line.startsWith(`${commit}:`) ? line.slice(commit.length + 1) : line)));

    this.out.write("\n");
    if (this.reasons.length === 0) {
      this.out.write("plugin-diff: PASS\n");
      return 0;
    }
    this.out.write(`plugin-diff: FAIL (${this.reasons.join("; ")})\n`);
    return 1;
  }

  private usage(problem: string): number {
    this.out.write(problem === "" ? PluginDiffCheck.USAGE : `plugin-diff: ${problem}\n${PluginDiffCheck.USAGE}`);
    return 2;
  }

  private section(title: string): void {
    this.out.write(`\n== ${title}\n`);
  }

  private list(lines: readonly string[]): void {
    this.out.write(lines.length === 0 ? "(none)\n" : `${lines.join("\n")}\n`);
  }

  /** Prints `ok   <good>` or `FAIL <bad>`, remembering `bad` as a reason. */
  private verdict(passed: boolean, good: string, bad: string): void {
    if (passed) {
      this.out.write(`ok   ${good}\n`);
    } else {
      this.out.write(`FAIL ${bad}\n`);
      this.reasons.push(bad);
    }
  }

  /** The path of a `--name-status` line (`M\tsrc/a.ts` → `src/a.ts`). */
  private static pathOf(line: string): string {
    return line.slice(line.indexOf("\t") + 1);
  }
}
