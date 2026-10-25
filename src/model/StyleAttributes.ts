import { ColorProperty } from "./ColorProperty.js";
import { EditorError } from "./EditorError.js";
import { StrokeWidthProperty } from "./StrokeWidthProperty.js";
import type { StyleProperty } from "./StyleProperty.js";

/**
 * The common optional attributes `fill`, `stroke`, `stroke-width`, held as an
 * ordered list of property objects; the list order is the serialization and
 * display order (F18, V6). Unset properties fall back to SVG rendering defaults.
 */
export class StyleAttributes {
  private static readonly NAMES: readonly string[] = StyleAttributes.createProperties().map((p) => p.name());

  private properties: StyleProperty[] = StyleAttributes.createProperties();

  /** Whether `name` is one of the style properties (the shared part of the `set` whitelist). */
  static accepts(name: string): boolean {
    return StyleAttributes.NAMES.includes(name);
  }

  /**
   * Validates and stores a value. Throws `unknown attribute` for other names,
   * `invalid value for …` / `invalid number` for bad values; state is unchanged on failure.
   */
  set(name: string, raw: string): void {
    const property = this.find(name);
    if (property === undefined) {
      throw new EditorError(`unknown attribute: ${name}`);
    }
    property.assign(raw);
  }

  /** The displayed value, or `undefined` when the property is unset. */
  get(name: string): string | undefined {
    return this.find(name)?.display();
  }

  isEmpty(): boolean {
    return this.properties.every((p) => !p.isSet());
  }

  /** Set properties as `[name, displayed value]`, in list order. */
  entries(): Array<[string, string]> {
    const result: Array<[string, string]> = [];
    for (const property of this.properties) {
      const value = property.display();
      if (value !== undefined) {
        result.push([property.name(), value]);
      }
    }
    return result;
  }

  /** Independent copy, used by snapshots. */
  copy(): StyleAttributes {
    const result = new StyleAttributes();
    result.properties = this.copyProperties();
    return result;
  }

  /** Makes this object equal to `source`, including properties that were unset there. */
  restoreFrom(source: StyleAttributes): void {
    this.properties = source.copyProperties();
  }

  private find(name: string): StyleProperty | undefined {
    return this.properties.find((p) => p.name() === name);
  }

  private copyProperties(): StyleProperty[] {
    return this.properties.map((p) => p.copy());
  }

  private static createProperties(): StyleProperty[] {
    return [new ColorProperty("fill"), new ColorProperty("stroke"), new StrokeWidthProperty()];
  }
}
