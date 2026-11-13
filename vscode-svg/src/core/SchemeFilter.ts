/**
 * Which URI schemes the extension decorates at all (VA6).
 *
 * - `file`: local workspaces — the case spec A.1 is about.
 * - `vscode-remote`: the same Explorer in a Remote-SSH / WSL / container window,
 *   where the extension host runs remotely and workspace URIs use this scheme.
 *
 * Everything else is skipped *before* any type query: `untitled` buffers have no
 * file to stat (and are not in the Explorer); `git`, `gitlens`, `vscode-userdata`,
 * `output`, … are views of other data (old revisions, settings, logs). Their
 * file-system providers can be slow (`git` runs a git process per stat) and a
 * badge there would not mean "an SVG file in your workspace".
 */
export class SchemeFilter {
  static readonly DEFAULT = new SchemeFilter(["file", "vscode-remote"]);

  private readonly schemes: ReadonlySet<string>;

  constructor(schemes: readonly string[]) {
    this.schemes = new Set(schemes);
  }

  includes(scheme: string): boolean {
    return this.schemes.has(scheme);
  }
}
