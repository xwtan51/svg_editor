import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { BaselinePaths } from "./BaselinePaths.js";
import { SessionOutcome } from "./SessionOutcome.js";
import type { TranscriptSession } from "./TranscriptSession.js";

/**
 * Runs one session against the real CLI, the same way in update and check mode:
 * a fresh temporary directory, the session's fixtures copied into it, the CLI
 * started there with stdin redirected from the input file (so it is not a TTY),
 * then stdout, stderr, exit code and every file left in the directory collected.
 */
export class SessionRunner {
  private static readonly TIMEOUT_MS = 60_000;

  run(session: TranscriptSession): SessionOutcome {
    const workDir = fs.mkdtempSync(path.join(os.tmpdir(), `svg-baseline-${session.name}-`));
    try {
      if (session.hasFixtures()) {
        fs.cpSync(session.fixturesDir, workDir, { recursive: true });
      }
      const input = fs.openSync(session.inputPath, "r");
      try {
        const result = spawnSync(BaselinePaths.TSX, [BaselinePaths.entryAbsolute()], {
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
