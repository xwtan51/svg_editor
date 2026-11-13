import fs from "node:fs";
import path from "node:path";
import { BaselinePaths } from "./BaselinePaths.js";

/**
 * One session: `doc/transcript/<name>.txt` (commands and `#` comments only),
 * its optional fixtures `doc/transcript/fixtures/<name>/` and its baseline
 * `doc/transcript/expected/<name>/`.
 */
export class TranscriptSession {
  private constructor(readonly name: string) {}

  /** All sessions, i.e. every `*.txt` directly under `doc/transcript/`, sorted by name. */
  static discoverAll(): TranscriptSession[] {
    return fs
      .readdirSync(BaselinePaths.TRANSCRIPT_DIR, { withFileTypes: true })
      .filter((entry) => entry.isFile() && entry.name.endsWith(".txt"))
      .map((entry) => new TranscriptSession(entry.name.slice(0, -".txt".length)))
      .sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
  }

  /** Names that have a baseline directory, whether or not the session input still exists. */
  static baselineNames(): string[] {
    if (!fs.existsSync(BaselinePaths.EXPECTED_DIR)) {
      return [];
    }
    return fs
      .readdirSync(BaselinePaths.EXPECTED_DIR, { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name)
      .sort();
  }

  get inputPath(): string {
    return path.join(BaselinePaths.TRANSCRIPT_DIR, `${this.name}.txt`);
  }

  get fixturesDir(): string {
    return path.join(BaselinePaths.FIXTURES_DIR, this.name);
  }

  get expectedDir(): string {
    return path.join(BaselinePaths.EXPECTED_DIR, this.name);
  }

  hasFixtures(): boolean {
    return fs.existsSync(this.fixturesDir);
  }
}
