import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { API } from "typescript/unstable/sync";
import type { GitRepository } from "../shared/GitRepository.js";
import { ClassComment } from "./ClassComment.js";
import { CodeLineCounter } from "./CodeLineCounter.js";
import { ComplexityCounter } from "./ComplexityCounter.js";
import { FileMeasure } from "./FileMeasure.js";

/**
 * The TypeScript files of one revision, unpacked into a temporary directory
 * with `git archive` and parsed there with `typescript/unstable/sync`
 * (design §5.3, appendix B.4), so that the numbers come from git history
 * only, never from the working tree.
 *
 * One path prefix is used for everything: the temporary directory is used as
 * created (not resolved through symbolic links) for the generated
 * `tsconfig.json` and for every lookup, because the API answers only for
 * the form of a path its project was opened with.
 */
export class SourceSnapshot {
  private static readonly TSCONFIG = "tsconfig.json";

  private readonly root: string;
  private readonly files: readonly string[];

  private constructor(root: string, files: readonly string[]) {
    this.root = root;
    this.files = [...files].sort(SourceSnapshot.byCodeUnits);
  }

  /** The `.ts` files (not `.d.ts`) of `commit` that `keep` accepts, unpacked. */
  static extract(git: GitRepository, commit: string, keep: (file: string) => boolean): SourceSnapshot {
    const files = git
      .text(["ls-tree", "-r", "-z", "--name-only", commit])
      .split("\0")
      .filter((file) => file.endsWith(".ts") && !file.endsWith(".d.ts") && keep(file));
    const root = SourceSnapshot.temporaryDirectory();
    if (files.length > 0) {
      const archive = spawnSync("git", ["archive", "--format=tar", commit, "--", ...files], {
        cwd: git.dir,
        env: git.environment(),
        maxBuffer: 1024 * 1024 * 1024,
      });
      if (archive.status !== 0) {
        fs.rmSync(root, { recursive: true, force: true });
        throw new Error(`git archive ${commit} failed: ${archive.stderr.toString("utf8").trim()}`);
      }
      const tar = spawnSync("tar", ["-x", "-f", "-", "-C", root], { input: archive.stdout });
      if (tar.status !== 0) {
        fs.rmSync(root, { recursive: true, force: true });
        throw new Error(`tar -x failed: ${tar.stderr.toString("utf8").trim()}`);
      }
    }
    return new SourceSnapshot(root, files);
  }

  /** A snapshot of the given texts (path → text), e.g. the built-in self-check sample. */
  static of(texts: Readonly<Record<string, string>>): SourceSnapshot {
    const root = SourceSnapshot.temporaryDirectory();
    for (const [file, text] of Object.entries(texts)) {
      const target = path.join(root, ...file.split("/"));
      fs.mkdirSync(path.dirname(target), { recursive: true });
      fs.writeFileSync(target, text);
    }
    return new SourceSnapshot(root, Object.keys(texts));
  }

  /** Orders strings by UTF-16 code units, the same on every machine (no locale). */
  static byCodeUnits(a: string, b: string): number {
    return a < b ? -1 : a > b ? 1 : 0;
  }

  /** The files, repository-relative, sorted by code units. */
  paths(): readonly string[] {
    return this.files;
  }

  text(file: string): string {
    return fs.readFileSync(this.absolute(file), "utf8");
  }

  /**
   * Parses `files` (all by default) in one project and measures each; the
   * result is in the order of `paths()`.
   */
  measure(files: readonly string[] = this.files): FileMeasure[] {
    const wanted = this.files.filter((file) => files.includes(file));
    if (wanted.length === 0) {
      return [];
    }
    const tsconfig = path.join(this.root, SourceSnapshot.TSCONFIG);
    fs.writeFileSync(
      tsconfig,
      `${JSON.stringify({ compilerOptions: { noEmit: true, noResolve: true, types: [], target: "ES2022", module: "NodeNext" }, files: wanted }, null, 2)}\n`,
    );
    const api = new API({ cwd: this.root });
    try {
      const [project] = api.updateSnapshot({ openProjects: [tsconfig] }).getProjects();
      if (project === undefined) {
        throw new Error(`no project for ${tsconfig}`);
      }
      const complexity = new ComplexityCounter();
      const lines = new CodeLineCounter();
      return wanted.map((file) => {
        const source = project.program.getSourceFile(this.absolute(file));
        if (source === undefined) {
          throw new Error(`the TypeScript API did not return ${file} (looked up as ${this.absolute(file)})`);
        }
        const text = source.text;
        return new FileMeasure(file, lines.physical(text), lines.code(source), complexity.functions(source), ClassComment.of(text)?.firstSentence() ?? null);
      });
    } finally {
      api.close();
    }
  }

  dispose(): void {
    fs.rmSync(this.root, { recursive: true, force: true });
  }

  private absolute(file: string): string {
    return path.join(this.root, ...file.split("/"));
  }

  private static temporaryDirectory(): string {
    return fs.mkdtempSync(path.join(os.tmpdir(), "svg-metrics-"));
  }
}
