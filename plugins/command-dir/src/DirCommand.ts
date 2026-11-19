import { CommandResult, EditorError, QueryCommand } from "@svgframe/kernel";
import type { CommandContext } from "@svgframe/kernel";
import type { DirectoryEntry } from "./DirectoryEntry.js";
import type { DirectoryLister } from "./DirectoryLister.js";
import type { WorkingDirectory } from "./WorkingDirectory.js";

/**
 * Adapter pattern, the Client: `dir` lists the direct children of the working
 * directory, directories first, each group in UTF-16 code-unit order (spec
 * §2.2, design §8.2). It depends only on the two Targets, `DirectoryLister`
 * and `WorkingDirectory`, never on Node, so it is tested with stand-ins.
 *
 * A display command (`QueryCommand`): never recorded, so it neither sets nor
 * lifts the io lock (design §2.2.6). `execute` does not touch the context at
 * all, so it works without a document and changes neither the document nor
 * the history, and raises no document event.
 */
export class DirCommand extends QueryCommand {
  /** Width of `[FILE]`: `[DIR]` is padded to it, so every name starts after the same 7 characters (X27, T2). */
  private static readonly TAG_WIDTH = 6;
  private static readonly DIRECTORY_TAG = "[DIR]";
  private static readonly FILE_TAG = "[FILE]";
  private static readonly EMPTY = "(empty directory)";

  private readonly lister: DirectoryLister;
  private readonly workingDirectory: WorkingDirectory;

  constructor(lister: DirectoryLister, workingDirectory: WorkingDirectory) {
    super();
    this.lister = lister;
    this.workingDirectory = workingDirectory;
  }

  /** Reads nothing from `context`. A failed read is `cannot read directory: <absolute path>` (N7); the editor goes on. */
  execute(_context: CommandContext): CommandResult {
    const path = this.workingDirectory.current();
    let entries: DirectoryEntry[];
    try {
      entries = this.lister.list(path);
    } catch {
      throw new EditorError(`cannot read directory: ${path}`);
    }
    if (entries.length === 0) {
      return CommandResult.of(DirCommand.EMPTY);
    }
    const directories = entries.filter((entry) => entry.isDirectory()).sort(DirCommand.byCodeUnit);
    const files = entries.filter((entry) => !entry.isDirectory()).sort(DirCommand.byCodeUnit);
    return CommandResult.of(
      ...directories.map((entry) => DirCommand.line(DirCommand.DIRECTORY_TAG, entry)),
      ...files.map((entry) => DirCommand.line(DirCommand.FILE_TAG, entry)),
    );
  }

  /**
   * UTF-16 code-unit order (the `<` of JavaScript strings): the same on every
   * machine, unlike `localeCompare`, which depends on ICU and the locale.
   */
  private static byCodeUnit(a: DirectoryEntry, b: DirectoryEntry): number {
    if (a.name() < b.name()) {
      return -1;
    }
    return a.name() > b.name() ? 1 : 0;
  }

  /** `[DIR]  docs`, `[FILE] demo.svg`. */
  private static line(tag: string, entry: DirectoryEntry): string {
    return `${tag.padEnd(DirCommand.TAG_WIDTH)} ${entry.name()}`;
  }
}
