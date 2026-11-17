import fs from "node:fs";
import path from "node:path";
import { BaselinePaths } from "./BaselinePaths.js";

/**
 * One session: `doc/transcript/<name>.txt` (commands and `#` comments only),
 * its optional fixtures `doc/transcript/fixtures/<name>/` and its optional run
 * groups `doc/transcript/<name>.runs.json` (design §4.8, read by `SessionPlan`).
 * Which baselines under `doc/transcript/expected/` it is compared with is
 * decided by its plan, not by its name.
 *
 * The transcript directory is a parameter so that tests can lay out sessions
 * in a temporary directory; the tool uses `BaselinePaths.TRANSCRIPT_DIR`.
 */
export class TranscriptSession {
  static readonly INPUT_SUFFIX = ".txt";
  static readonly RUNS_SUFFIX = ".runs.json";

  private constructor(
    readonly name: string,
    /** Absolute `doc/transcript/` this session lives in. */
    readonly transcriptDir: string,
  ) {}

  /** All sessions, i.e. every `*.txt` directly under the transcript directory, sorted by name. */
  static discoverAll(transcriptDir: string = BaselinePaths.TRANSCRIPT_DIR): TranscriptSession[] {
    return TranscriptSession.namesWithSuffix(transcriptDir, TranscriptSession.INPUT_SUFFIX).map(
      (name) => new TranscriptSession(name, transcriptDir),
    );
  }

  /** Names of `<name>.runs.json` files that have no `<name>.txt` next to them, sorted. */
  static strayRunFiles(transcriptDir: string = BaselinePaths.TRANSCRIPT_DIR): string[] {
    const sessions = new Set(TranscriptSession.namesWithSuffix(transcriptDir, TranscriptSession.INPUT_SUFFIX));
    return TranscriptSession.namesWithSuffix(transcriptDir, TranscriptSession.RUNS_SUFFIX).filter((name) => !sessions.has(name));
  }

  /** Names that have a baseline directory under `expected/`, whether or not any session still uses them. */
  static baselineNames(transcriptDir: string = BaselinePaths.TRANSCRIPT_DIR): string[] {
    const expected = path.join(transcriptDir, BaselinePaths.EXPECTED);
    if (!fs.existsSync(expected)) {
      return [];
    }
    return fs
      .readdirSync(expected, { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name)
      .sort(TranscriptSession.byCodeUnits);
  }

  /** Orders strings by UTF-16 code units, the same on every machine (no locale). */
  static byCodeUnits(a: string, b: string): number {
    return a < b ? -1 : a > b ? 1 : 0;
  }

  get inputPath(): string {
    return path.join(this.transcriptDir, `${this.name}${TranscriptSession.INPUT_SUFFIX}`);
  }

  get runsPath(): string {
    return path.join(this.transcriptDir, `${this.name}${TranscriptSession.RUNS_SUFFIX}`);
  }

  get fixturesDir(): string {
    return path.join(this.transcriptDir, BaselinePaths.FIXTURES, this.name);
  }

  hasFixtures(): boolean {
    return fs.existsSync(this.fixturesDir);
  }

  hasRuns(): boolean {
    return fs.existsSync(this.runsPath);
  }

  private static namesWithSuffix(transcriptDir: string, suffix: string): string[] {
    return fs
      .readdirSync(transcriptDir, { withFileTypes: true })
      .filter((entry) => entry.isFile() && entry.name.endsWith(suffix) && entry.name.length > suffix.length)
      .map((entry) => entry.name.slice(0, -suffix.length))
      .sort(TranscriptSession.byCodeUnits);
  }
}
