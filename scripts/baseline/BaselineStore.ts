import fs from "node:fs";
import path from "node:path";
import { BaselinePaths } from "./BaselinePaths.js";
import { SessionOutcome } from "./SessionOutcome.js";

/**
 * Reads and writes the baselines under `doc/transcript/expected/<name>/`; a
 * run group names the baseline it is compared with (design §4.8):
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

  /** `expectedRoot` is the absolute `doc/transcript/expected/`. */
  constructor(private readonly expectedRoot: string = BaselinePaths.EXPECTED_DIR) {}

  /** Absolute directory of the baseline `name`. */
  dirOf(name: string): string {
    return path.join(this.expectedRoot, name);
  }

  exists(name: string): boolean {
    return fs.existsSync(this.dirOf(name));
  }

  read(name: string): SessionOutcome {
    const dir = this.dirOf(name);
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

  /** Replaces the whole baseline directory `name` with `outcome`. */
  write(name: string, outcome: SessionOutcome): void {
    const dir = this.dirOf(name);
    fs.rmSync(dir, { recursive: true, force: true });
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, BaselineStore.STDOUT), outcome.stdout);
    fs.writeFileSync(path.join(dir, BaselineStore.EXIT_CODE), `${outcome.exitCode}\n`);
    for (const file of outcome.sortedFileNames()) {
      const target = path.join(dir, BaselineStore.FILES, ...file.split("/"));
      fs.mkdirSync(path.dirname(target), { recursive: true });
      fs.writeFileSync(target, outcome.files.get(file) ?? Buffer.alloc(0));
    }
  }
}
