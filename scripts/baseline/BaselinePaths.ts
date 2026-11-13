import path from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Every path the baseline tool depends on, in one place.
 *
 * `CLI_ENTRY` is the only line to change when the CLI entry script moves (plan S5).
 */
export class BaselinePaths {
  /** CLI entry script, relative to the repository root. */
  static readonly CLI_ENTRY = "src/cli/main.ts";

  static readonly REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");

  /** The repository's own tsx launcher (not `npm run cli`: npm adds lines to stdout and resets the cwd). */
  static readonly TSX = path.join(BaselinePaths.REPO_ROOT, "node_modules", ".bin", "tsx");

  static readonly TRANSCRIPT_DIR = path.join(BaselinePaths.REPO_ROOT, "doc", "transcript");
  static readonly FIXTURES_DIR = path.join(BaselinePaths.TRANSCRIPT_DIR, "fixtures");
  static readonly EXPECTED_DIR = path.join(BaselinePaths.TRANSCRIPT_DIR, "expected");

  static entryAbsolute(): string {
    return path.join(BaselinePaths.REPO_ROOT, BaselinePaths.CLI_ENTRY);
  }

  /** Repository-relative form of an absolute path, with `/` separators, for messages. */
  static display(absolute: string): string {
    return path.relative(BaselinePaths.REPO_ROOT, absolute).split(path.sep).join("/");
  }
}
