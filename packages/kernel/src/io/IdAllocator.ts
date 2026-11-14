import type { XmlElement } from "./XmlElement.js";

/**
 * Hands out the ids of imported elements (F13, F14). Every explicit id in the
 * file is reserved up front, so a generated `<tag><n>` can never collide with
 * an id that appears later in the file. The first element with an explicit id
 * keeps it; a missing (or empty, F16) id or a repeated one gets the smallest
 * free `<tag><n>`, n ≥ 1, and a warning.
 */
export class IdAllocator {
  private readonly reserved: ReadonlySet<string>;
  private readonly used = new Set<string>();

  private constructor(reserved: Iterable<string>) {
    this.reserved = new Set(reserved);
  }

  /** Reserves the explicit ids of every element below `root` (unsupported ones included). */
  static forTree(root: XmlElement): IdAllocator {
    const ids = root
      .descendantsAndSelf()
      .slice(1)
      .map((element) => element.attribute("id") ?? "")
      .filter((id) => id.length > 0);
    return new IdAllocator(ids);
  }

  /** The id to use for the next element in document order; appends a warning message when it differs from `explicit`. */
  idFor(tag: string, explicit: string | undefined, warnings: string[]): string {
    if (explicit === undefined || explicit.length === 0) {
      const id = this.generate(tag);
      warnings.push(`assigned id ${id} to unnamed <${tag}>`);
      return id;
    }
    if (this.used.has(explicit)) {
      const id = this.generate(tag);
      warnings.push(`duplicate id ${explicit}, reassigned to ${id}`);
      return id;
    }
    this.used.add(explicit);
    return explicit;
  }

  private generate(tag: string): string {
    let n = 1;
    while (this.reserved.has(`${tag}${n}`) || this.used.has(`${tag}${n}`)) {
      n++;
    }
    const id = `${tag}${n}`;
    this.used.add(id);
    return id;
  }
}
