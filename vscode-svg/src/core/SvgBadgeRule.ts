import { Badge } from "./Badge.js";
import type { ResourceKind } from "./ResourceKind.js";
import type { ResourcePath } from "./ResourcePath.js";

/**
 * Spec A.1: a resource gets the `[]` badge exactly when its name ends in `.svg`
 * (case-insensitive, VA3; hidden `.svg` excluded, VA4) **and** it is a file.
 *
 * "Is a file" means the resource or the target of its symbolic link is a regular
 * file (VA5): a link to a file is badged, a link to a directory and a dangling
 * link are not. Directories are never badged, whatever their name (`icons.svg/`).
 *
 * The rule is split in two so the caller can skip the (asynchronous) type query
 * for the vast majority of resources whose name already rules them out.
 */
export class SvgBadgeRule {
  static readonly EXTENSION = ".svg";

  /** Cheap pre-check on the name alone; `false` means "never a badge". */
  matchesName(path: ResourcePath): boolean {
    return path.hasExtension(SvgBadgeRule.EXTENSION);
  }

  /** The badge for a resource of this name and kind, or `undefined` for none. */
  badgeFor(path: ResourcePath, kind: ResourceKind): Badge | undefined {
    return this.matchesName(path) && kind.isFile() ? Badge.SVG : undefined;
  }

  /**
   * Glob for a file-system watcher that sees every resource the rule could badge,
   * in any letter case: `*.[sS][vV][gG]` at any depth (VSCode globs support `[…]`).
   */
  watchGlob(): string {
    const letters = Array.from(SvgBadgeRule.EXTENSION.slice(1))
      .map((c) => `[${c.toLowerCase()}${c.toUpperCase()}]`)
      .join("");
    return `**/*.${letters}`;
  }
}
