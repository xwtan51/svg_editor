/**
 * One optional style attribute of a shape (`fill`, `stroke`, `stroke-width`).
 * Each subclass owns its typed value and its "unset" state; style properties
 * are never affected by move or scale (E12).
 */
export abstract class StyleProperty {
  private readonly propName: string;

  protected constructor(name: string) {
    this.propName = name;
  }

  name(): string {
    return this.propName;
  }

  isSet(): boolean {
    return this.display() !== undefined;
  }

  /** Validates and stores `raw`; on failure throws `EditorError` and keeps the old value. */
  abstract assign(raw: string): void;

  /** The value in its output form, or `undefined` when unset. */
  abstract display(): string | undefined;

  /** Independent copy, including the unset state. */
  abstract copy(): StyleProperty;
}
