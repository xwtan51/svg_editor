import { FileDecoration } from "vscode";
import type { CancellationToken, Event, FileDecorationProvider, Uri } from "vscode";
import type { SchemeFilter } from "../core/SchemeFilter.js";
import type { SvgBadgeRule } from "../core/SvgBadgeRule.js";
import { ResourcePath } from "../core/ResourcePath.js";
import type { VscodeResourceKindReader } from "./VscodeResourceKindReader.js";

/**
 * The object VSCode calls back for every resource it renders (Explorer rows,
 * editor tabs, …). Deliberately thin: it only chains
 * scheme filter → name pre-check → type query → rule → `FileDecoration`.
 *
 * `onDidChangeFileDecorations` is supplied from outside (see `SvgResourceWatcher`):
 * VSCode caches every answer per URI until the provider fires this event (VA7).
 */
export class SvgFileDecorationProvider implements FileDecorationProvider {
  private readonly rule: SvgBadgeRule;
  private readonly kinds: VscodeResourceKindReader;
  private readonly schemes: SchemeFilter;
  private readonly changes: Event<Uri>;

  constructor(rule: SvgBadgeRule, kinds: VscodeResourceKindReader, schemes: SchemeFilter, changes: Event<Uri>) {
    this.rule = rule;
    this.kinds = kinds;
    this.schemes = schemes;
    this.changes = changes;
  }

  get onDidChangeFileDecorations(): Event<Uri> {
    return this.changes;
  }

  async provideFileDecoration(uri: Uri, token: CancellationToken): Promise<FileDecoration | undefined> {
    if (!this.schemes.includes(uri.scheme)) {
      return undefined;
    }
    const path = new ResourcePath(uri.path);
    if (!this.rule.matchesName(path)) {
      return undefined;
    }
    const kind = await this.kinds.read(uri);
    if (kind === undefined || token.isCancellationRequested) {
      return undefined;
    }
    const badge = this.rule.badgeFor(path, kind);
    return badge === undefined ? undefined : new FileDecoration(badge.text(), badge.tooltip());
  }
}
