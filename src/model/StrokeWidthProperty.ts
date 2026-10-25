import { Extent } from "./Extent.js";
import { NumberFormat } from "./NumberFormat.js";
import { StyleProperty } from "./StyleProperty.js";

/**
 * `stroke-width`: a full-precision number validated like a size (≥ 0, E4).
 * It is not a geometry attribute, so scale leaves it unchanged (E12).
 */
export class StrokeWidthProperty extends StyleProperty {
  private static readonly ROLE = new Extent();

  private current: number | undefined = undefined;

  constructor() {
    super("stroke-width");
  }

  assign(raw: string): void {
    const value = NumberFormat.parse(raw);
    StrokeWidthProperty.ROLE.validate(this.name(), value);
    this.current = value;
  }

  display(): string | undefined {
    return this.current === undefined ? undefined : NumberFormat.format(this.current);
  }

  copy(): StrokeWidthProperty {
    const result = new StrokeWidthProperty();
    result.current = this.current;
    return result;
  }
}
