/**
 * Attributes outside the editable whitelist found when reading a file
 * (`transform`, `font-size`, `data-*`…). Kept verbatim and in document order so
 * that read → save round-trips (F7); never editable through `set`.
 */
export class ExtraAttributes {
  private readonly values = new Map<string, string>();

  /** Used only while importing; a repeated name keeps its first position. */
  append(name: string, value: string): void {
    this.values.set(name, value);
  }

  get(name: string): string | undefined {
    return this.values.get(name);
  }

  isEmpty(): boolean {
    return this.values.size === 0;
  }

  /** `[name, value]` pairs in their original order. */
  entries(): Array<[string, string]> {
    return [...this.values];
  }
}
