/**
 * The path part of a resource URI (`Uri.path`: always `/`-separated, never a
 * Windows path), with the naming questions the badge rule needs.
 *
 * Extension = the base name from its last `.`, but only when that dot is not the
 * first character: `.svg` is a hidden file *without* an extension (VA4), as in
 * Node's `path.posix.extname` and VSCode's own `resources.extname`, while
 * `.foo.svg` and `..svg` do end in `.svg`.
 */
export class ResourcePath {
  private readonly path: string;

  constructor(path: string) {
    this.path = path;
  }

  /** Last segment; trailing slashes are ignored. */
  baseName(): string {
    const trimmed = this.path.replace(/\/+$/, "");
    return trimmed.slice(trimmed.lastIndexOf("/") + 1);
  }

  /** Extension including the dot (`".svg"`), or `""` when there is none. */
  extension(): string {
    const name = this.baseName();
    const dot = name.lastIndexOf(".");
    return dot > 0 ? name.slice(dot) : "";
  }

  /** Case-insensitive comparison (VA3): `a.SVG` has extension `.svg`. */
  hasExtension(extension: string): boolean {
    return this.extension().toLowerCase() === extension.toLowerCase();
  }

  toString(): string {
    return this.path;
  }
}
