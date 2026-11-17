import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { GitRepository } from "../../../../scripts/shared/GitRepository.js";

/**
 * Test helper: a throw-away git repository in a temporary directory (design
 * §9.1). Tests never read this repository's own history: CI checks out a
 * shallow clone without tags, and its runner has no git identity.
 *
 * Git runs with an isolated configuration — no global or system config, a
 * fixed identity and fixed dates — so local settings (`commit.gpgsign`,
 * `diff.renames`, colours …) cannot change a result, and the same commands
 * produce the same commit ids every time.
 */
export class TempGitRepo {
  readonly root: string;
  private tick = 0;

  constructor(prefix = "svg-git-test-") {
    this.root = realpathSync(mkdtempSync(join(tmpdir(), prefix)));
    this.git("init", "-q", "-b", "main");
  }

  /** The environment every git command of a test runs with. */
  static env(): NodeJS.ProcessEnv {
    const env: NodeJS.ProcessEnv = {};
    for (const [key, value] of Object.entries(process.env)) {
      if (!key.startsWith("GIT_")) env[key] = value;
    }
    return {
      ...env,
      GIT_CONFIG_GLOBAL: "/dev/null",
      GIT_CONFIG_NOSYSTEM: "1",
      GIT_AUTHOR_NAME: "Test",
      GIT_AUTHOR_EMAIL: "test@example.com",
      GIT_COMMITTER_NAME: "Test",
      GIT_COMMITTER_EMAIL: "test@example.com",
    };
  }

  /** A `GitRepository` on this repository, with the isolated environment. */
  repository(): GitRepository {
    return new GitRepository(this.root, TempGitRepo.env());
  }

  /** Runs git here; a failure throws. Returns stdout. */
  git(...args: string[]): string {
    const date = `2000-01-01T00:00:${String(this.tick).padStart(2, "0")}Z`;
    const result = spawnSync("git", args, {
      cwd: this.root,
      env: { ...TempGitRepo.env(), GIT_AUTHOR_DATE: date, GIT_COMMITTER_DATE: date },
      encoding: "utf8",
    });
    if (result.status !== 0) {
      throw new Error(`git ${args.join(" ")}: ${result.stderr}`);
    }
    return result.stdout;
  }

  /** Writes each file (directories created). */
  write(files: Readonly<Record<string, string>>): this {
    for (const [relative, text] of Object.entries(files)) {
      const location = join(this.root, relative);
      mkdirSync(dirname(location), { recursive: true });
      writeFileSync(location, text);
    }
    return this;
  }

  /** Deletes files or directories. */
  remove(...paths: string[]): this {
    for (const relative of paths) rmSync(join(this.root, relative), { recursive: true, force: true });
    return this;
  }

  /** Commits everything in the working tree; returns the new commit id. */
  commit(message: string): string {
    this.tick += 1;
    this.git("add", "-A");
    this.git("commit", "-q", "--allow-empty", "-m", message);
    return this.head();
  }

  head(): string {
    return this.git("rev-parse", "HEAD").trim();
  }

  /** Checks out a new branch `name` at `rev`. */
  branch(name: string, rev: string): this {
    this.git("checkout", "-q", "-b", name, rev);
    return this;
  }

  dispose(): void {
    rmSync(this.root, { recursive: true, force: true });
  }
}
