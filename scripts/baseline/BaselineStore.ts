import fs from "node:fs";
import path from "node:path";
import { SessionOutcome } from "./SessionOutcome.js";
import type { TranscriptSession } from "./TranscriptSession.js";

/**
 * Reads and writes the baseline of a session under `doc/transcript/expected/<name>/`:
 *
 * - `stdout.txt`    — stdout byte for byte (banner included);
 * - `exit-code.txt` — the exit code followed by a newline;
 * - `files/…`       — every file left in the working directory at the end of the session.
 *
 * stderr is not stored: a baseline is only ever written from a run whose stderr was
 * empty, so the expected stderr is always the empty byte string.
 */
export class BaselineStore {
  static readonly STDOUT = "stdout.txt";
  static readonly EXIT_CODE = "exit-code.txt";
  static readonly FILES = "files";

  exists(session: TranscriptSession): boolean {
    return fs.existsSync(session.expectedDir);
  }

  read(session: TranscriptSession): SessionOutcome {
    const dir = session.expectedDir;
    const exitText = fs.readFileSync(path.join(dir, BaselineStore.EXIT_CODE), "utf8").trim();
    const exitCode = Number(exitText);
    if (!/^\d+$/.test(exitText)) {
      throw new Error(`malformed ${BaselineStore.EXIT_CODE} in ${dir}: ${JSON.stringify(exitText)}`);
    }
    const filesDir = path.join(dir, BaselineStore.FILES);
    const files = new Map<string, Buffer>();
    if (fs.existsSync(filesDir)) {
      for (const relative of fs.readdirSync(filesDir, { recursive: true }) as string[]) {
        const absolute = path.join(filesDir, relative);
        if (fs.statSync(absolute).isFile()) {
          files.set(relative.split(path.sep).join("/"), fs.readFileSync(absolute));
        }
      }
    }
    return new SessionOutcome(fs.readFileSync(path.join(dir, BaselineStore.STDOUT)), Buffer.alloc(0), exitCode, files);
  }

  /** Replaces the whole baseline directory of the session with `outcome`. */
  write(session: TranscriptSession, outcome: SessionOutcome): void {
    const dir = session.expectedDir;
    fs.rmSync(dir, { recursive: true, force: true });
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, BaselineStore.STDOUT), outcome.stdout);
    fs.writeFileSync(path.join(dir, BaselineStore.EXIT_CODE), `${outcome.exitCode}\n`);
    for (const name of outcome.sortedFileNames()) {
      const target = path.join(dir, BaselineStore.FILES, ...name.split("/"));
      fs.mkdirSync(path.dirname(target), { recursive: true });
      fs.writeFileSync(target, outcome.files.get(name) ?? Buffer.alloc(0));
    }
  }

  /** Path of a stored baseline file, for diff output. */
  pathOf(session: TranscriptSession, ...parts: string[]): string {
    return path.join(session.expectedDir, ...parts);
  }
}
