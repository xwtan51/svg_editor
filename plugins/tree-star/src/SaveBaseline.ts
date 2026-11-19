import { SvgSerializer } from "@svgframe/kernel";
import type { DocumentView, ShapeView } from "@svgframe/kernel";

/**
 * The save point of modified-star (design §8.4, ADR-3): an immutable value
 * object holding one fingerprint per shape id and the serialized text of the
 * whole document, as they were at the last `init`, `read` or `save`.
 */
export class SaveBaseline {
  private readonly fingerprints: ReadonlyMap<string, string>;
  private readonly documentText: string;

  private constructor(fingerprints: ReadonlyMap<string, string>, documentText: string) {
    this.fingerprints = fingerprints;
    this.documentText = documentText;
  }

  static capture(document: DocumentView): SaveBaseline {
    const fingerprints = new Map(document.allViews().map((view) => [view.getId(), SaveBaseline.fingerprint(view)]));
    return new SaveBaseline(fingerprints, new SvgSerializer().serialize(document));
  }

  /** Own attributes (id and data-kind included), text and parent; children and sibling order are not part of it. */
  private static fingerprint(view: ShapeView): string {
    return JSON.stringify([view.tagName(), view.svgAttributes(), view.textContent(), view.parentId()]);
  }

  /** A shape whose id the save point does not know is new, and so dirty. */
  isShapeDirty(view: ShapeView): boolean {
    return this.fingerprints.get(view.getId()) !== SaveBaseline.fingerprint(view);
  }

  /** The whole serialized document: canvas size, deletions and z-order included. */
  isDocumentDirty(document: DocumentView): boolean {
    return new SvgSerializer().serialize(document) !== this.documentText;
  }
}
