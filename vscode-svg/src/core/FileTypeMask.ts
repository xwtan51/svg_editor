import { ResourceKind } from "./ResourceKind.js";

/**
 * A `vscode.FileType` value, decoded without importing `vscode`.
 *
 * `FileType` is a bit mask: a symbolic link to a file is `SymbolicLink | File`
 * (64 | 1 = 65), to a directory `SymbolicLink | Directory` (66), and a dangling
 * link is `SymbolicLink | Unknown` (64) — see `toType()` in VSCode's
 * `src/vs/platform/files/node/diskFileSystemProvider.ts`. Every test therefore
 * uses `&`, never `===`.
 *
 * The flag values mirror `vscode.FileType` in `@types/vscode`; a unit test reads
 * that declaration file and fails if they ever drift apart.
 */
export class FileTypeMask {
  static readonly UNKNOWN = 0;
  static readonly FILE = 1;
  static readonly DIRECTORY = 2;
  static readonly SYMBOLIC_LINK = 64;

  private readonly bits: number;

  constructor(bits: number) {
    this.bits = bits;
  }

  has(flag: number): boolean {
    return (this.bits & flag) !== 0;
  }

  /**
   * File wins over directory if a (malformed) mask sets both: only a confirmed
   * file can ever be badged, and directories are never badged, so the opposite
   * choice would be equally safe — this one simply keeps the decoding total.
   */
  toResourceKind(): ResourceKind {
    const target = this.has(FileTypeMask.FILE)
      ? ResourceKind.file()
      : this.has(FileTypeMask.DIRECTORY)
        ? ResourceKind.directory()
        : ResourceKind.unknown();
    return this.has(FileTypeMask.SYMBOLIC_LINK) ? target.throughSymbolicLink() : target;
  }
}
