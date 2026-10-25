import { EditorError } from "./EditorError.js";
import { StyleProperty } from "./StyleProperty.js";

/** A paint value (`fill`, `stroke`): any non-empty text, no color syntax check (E5, E9). */
export class ColorProperty extends StyleProperty {
  private current: string | undefined = undefined;

  constructor(name: string) {
    super(name);
  }

  assign(raw: string): void {
    if (raw.length === 0) {
      throw new EditorError(`invalid value for ${this.name()}: ""`);
    }
    this.current = raw;
  }

  display(): string | undefined {
    return this.current;
  }

  copy(): ColorProperty {
    const result = new ColorProperty(this.name());
    result.current = this.current;
    return result;
  }
}
