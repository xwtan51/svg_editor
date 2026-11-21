import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { GitRepository } from "../shared/GitRepository.js";
import { BaselinePaths } from "./BaselinePaths.js";
import { SessionOutcome } from "./SessionOutcome.js";
import type { TranscriptSession } from "./TranscriptSession.js";

/**
 * Runs one session against the real CLI, the same way in update and check mode:
 * a fresh temporary directory, the session's fixtures copied into it, the CLI
 * started there with stdin redirected from the input file (so it is not a TTY),
 * then stdout, stderr, exit code and every file left in the directory collected.
 *
 * Only the fixtures git tracks are copied (`git ls-files`, design G38), with
 * their content taken from the working tree: an ignored or untracked file in
 * `fixtures/<session>/` (macOS's `.DS_Store`) never reaches the directory, so a
 * local run sees what CI sees, while an edited but uncommitted fixture is used
 * as edited. A new fixture takes effect only once it is `git add`ed.
 *
 * `args` (one run of a run group, placeholders already expanded) go after the
 * entry script; nothing else depends on them (design §4.8).
 */
export class SessionRunner {
  private static readonly TIMEOUT_MS = 60_000;

  run(session: TranscriptSession, args: readonly string[]): SessionOutcome {
    const workDir = fs.mkdtempSync(path.join(os.tmpdir(), `svg-baseline-${session.name}-`));
    try {
      if (session.hasFixtures()) {
        this.copyTrackedFixtures(session, workDir);
      }
      const input = fs.openSync(session.inputPath, "r");
      try {
        const result = spawnSync(BaselinePaths.TSX, [BaselinePaths.entryAbsolute(), ...args], {
          cwd: workDir,
          stdio: [input, "pipe", "pipe"],
          timeout: SessionRunner.TIMEOUT_MS,
          maxBuffer: 64 * 1024 * 1024,
        });
        if (result.error !== undefined) {
          throw new Error(`cannot run session ${session.name}: ${result.error.message}`);
        }
        if (result.status === null) {
          throw new Error(`session ${session.name} was killed by signal ${String(result.signal)}`);
        }
        return new SessionOutcome(result.stdout, result.stderr, result.status, this.collectFiles(workDir));
      } finally {
        fs.closeSync(input);
      }
    } finally {
      fs.rmSync(workDir, { recursive: true, force: true });
    }
  }

  /**
   * Copies every file under `session.fixturesDir` that git tracks into
   * `workDir`, keeping relative paths. A tracked fixture missing from the
   * working tree, or a fixtures directory outside any git repository, is an
   * error naming the session.
   */
  private copyTrackedFixtures(session: TranscriptSession, workDir: string): void {
    let listing: string;
    try {
      listing = new GitRepository(session.fixturesDir).text(["ls-files", "-z", "--", "."]);
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      throw new Error(`cannot run session ${session.name}: cannot list the fixtures git tracks in ${session.fixturesDir} (${reason})`);
    }
    const tracked = new Set(listing.split("\0").filter((relative) => relative.length > 0));
    for (const relative of tracked) {
      const source = path.join(session.fixturesDir, relative);
      if (!fs.existsSync(source)) {
        throw new Error(
          `cannot run session ${session.name}: the fixture ${BaselinePaths.FIXTURES}/${session.name}/${relative} is tracked by git but missing from the working tree`,
        );
      }
      const target = path.join(workDir, relative);
      fs.mkdirSync(path.dirname(target), { recursive: true });
      fs.copyFileSync(source, target);
    }
  }

  private collectFiles(root: string): Map<string, Buffer> {
    const files = new Map<string, Buffer>();
    for (const relative of fs.readdirSync(root, { recursive: true }) as string[]) {
      const absolute = path.join(root, relative);
      if (fs.statSync(absolute).isFile()) {
        files.set(relative.split(path.sep).join("/"), fs.readFileSync(absolute));
      }
    }
    return files;
  }
}
