/**
 * Adapter pattern, the Target's data: one direct child of a directory as the
 * `dir` command sees it, a name and whether it counts as a directory. Whether
 * a symbolic link counts as a directory is decided by the Adapter that makes
 * the entry (design §8.2, N3), so the Client never asks the file system.
 */
export class DirectoryEntry {
  private readonly entryName: string;
  private readonly directory: boolean;

  constructor(name: string, directory: boolean) {
    this.entryName = name;
    this.directory = directory;
  }

  /** The name inside its directory, without any path. */
  name(): string {
    return this.entryName;
  }

  /** `true` for `[DIR]`, `false` for `[FILE]`. */
  isDirectory(): boolean {
    return this.directory;
  }
}
