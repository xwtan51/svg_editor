import { spawnSync } from "node:child_process";

/**
 * The git commands the tooling scripts need, run in one repository.
 * `commit`, `parents`, `exists` and `nameStatus` read objects in commits, so
 * their results depend on commits only. `run` and `text` execute whatever git
 * command the caller passes: `SessionRunner`, for one, reads the index with
 * `text(["ls-files", …])` and then copies the listed files' contents from the
 * working tree itself.
 *
 * The environment is a parameter: tests run against temporary repositories
 * with an isolated git configuration (design §9.1).
 */
export class GitRepository {
  private static readonly MAX_BUFFER = 256 * 1024 * 1024;

  constructor(
    /** Any directory inside the repository. */
    readonly dir: string,
    private readonly env: NodeJS.ProcessEnv = process.env,
  ) {}

  /** The environment git runs with. */
  environment(): NodeJS.ProcessEnv {
    return this.env;
  }

  /** Runs `git args…`; returns stdout and the exit status (never throws on a non-zero status). */
  run(args: readonly string[]): { stdout: string; stderr: string; status: number } {
    const result = spawnSync("git", [...args], { cwd: this.dir, env: this.env, encoding: "utf8", maxBuffer: GitRepository.MAX_BUFFER });
    if (result.error !== undefined) {
      throw new Error(`cannot run git ${args.join(" ")}: ${result.error.message}`);
    }
    return { stdout: result.stdout, stderr: result.stderr, status: result.status ?? -1 };
  }

  /** stdout of `git args…`; a non-zero status is an error. */
  text(args: readonly string[]): string {
    const result = this.run(args);
    if (result.status !== 0) {
      throw new Error(`git ${args.join(" ")} failed (${result.status}): ${result.stderr.trim()}`);
    }
    return result.stdout;
  }

  /** The full id of the commit `rev` names, or null when it names no commit. */
  commit(rev: string): string | null {
    const result = this.run(["rev-parse", "--verify", "--quiet", `${rev}^{commit}`]);
    return result.status === 0 ? result.stdout.trim() : null;
  }

  /** The parents of commit `sha`, in order. */
  parents(sha: string): string[] {
    const [, ...parents] = this.text(["rev-list", "--parents", "-n", "1", sha]).trim().split(" ");
    return parents;
  }

  /** Whether `path` (a file or a directory) exists in commit `sha` (`git cat-file -e`). */
  exists(sha: string, path: string): boolean {
    return this.run(["cat-file", "-e", `${sha}:${path}`]).status === 0;
  }

  /** `git diff --name-status` between two commits, limited to `pathspecs` when given, as lines. */
  nameStatus(from: string, to: string, pathspecs: readonly string[] = []): string[] {
    const args = ["diff", "--no-color", "--no-ext-diff", "--no-renames", "--name-status", from, to];
    return GitRepository.lines(this.text(pathspecs.length === 0 ? args : [...args, "--", ...pathspecs]));
  }

  /** The non-empty lines of `text`. */
  static lines(text: string): string[] {
    return text.split("\n").filter((line) => line.length > 0);
  }
}
