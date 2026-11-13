/**
 * What a resource is, in the extension's own terms (independent of `vscode.FileType`).
 *
 * Two independent facts are kept apart:
 * - the *target*: a regular file, a directory, or unknown (neither, or a dangling
 *   symbolic link whose target does not exist);
 * - whether the resource is reached *through a symbolic link*.
 *
 * Instances are immutable; use the static factories and `throughSymbolicLink()`.
 */
export class ResourceKind {
  private static readonly FILE_NAME = "file";
  private static readonly DIRECTORY_NAME = "directory";
  private static readonly UNKNOWN_NAME = "unknown";

  private readonly targetIsFile: boolean;
  private readonly targetIsDirectory: boolean;
  private readonly linked: boolean;

  private constructor(targetIsFile: boolean, targetIsDirectory: boolean, linked: boolean) {
    this.targetIsFile = targetIsFile;
    this.targetIsDirectory = targetIsDirectory;
    this.linked = linked;
  }

  static file(): ResourceKind {
    return new ResourceKind(true, false, false);
  }

  static directory(): ResourceKind {
    return new ResourceKind(false, true, false);
  }

  /** Neither a file nor a directory (device, socket, …) or a dangling link. */
  static unknown(): ResourceKind {
    return new ResourceKind(false, false, false);
  }

  /** The same target, reached through a symbolic link. */
  throughSymbolicLink(): ResourceKind {
    return new ResourceKind(this.targetIsFile, this.targetIsDirectory, true);
  }

  /** True when the resource (or the target of its link) is a regular file. */
  isFile(): boolean {
    return this.targetIsFile;
  }

  /** True when the resource (or the target of its link) is a directory. */
  isDirectory(): boolean {
    return this.targetIsDirectory;
  }

  isSymbolicLink(): boolean {
    return this.linked;
  }

  equals(other: ResourceKind): boolean {
    return (
      this.targetIsFile === other.targetIsFile &&
      this.targetIsDirectory === other.targetIsDirectory &&
      this.linked === other.linked
    );
  }

  /** For test messages and logs, e.g. "file", "symbolic link to directory". */
  toString(): string {
    const target = this.targetIsFile
      ? ResourceKind.FILE_NAME
      : this.targetIsDirectory
        ? ResourceKind.DIRECTORY_NAME
        : ResourceKind.UNKNOWN_NAME;
    return this.linked ? `symbolic link to ${target}` : target;
  }
}
