/**
 * The short text shown next to a resource in the Explorer, plus its tooltip.
 *
 * VSCode rejects a `FileDecoration` whose badge is longer than two characters
 * (`FileDecoration.validate` in `extHostTypes.ts` throws "The 'badge'-property
 * must be undefined or a short character"), so the constructor enforces 1–2
 * characters here, before any VSCode object is built (VA2). Characters are counted
 * as Unicode code points, which is at least as strict as VSCode's own count.
 */
export class Badge {
  /** Upper bound imposed by VSCode on `FileDecoration.badge`. */
  static readonly MAX_LENGTH = 2;

  /** The badge for SVG files required by spec A.1. */
  static readonly SVG = new Badge("[]", "SVG file");

  private readonly label: string;
  private readonly hint: string;

  constructor(label: string, hint: string) {
    const length = Array.from(label).length;
    if (length < 1 || length > Badge.MAX_LENGTH) {
      throw new Error(`badge must be 1-${Badge.MAX_LENGTH} characters, got ${length}: "${label}"`);
    }
    this.label = label;
    this.hint = hint;
  }

  text(): string {
    return this.label;
  }

  tooltip(): string {
    return this.hint;
  }
}
