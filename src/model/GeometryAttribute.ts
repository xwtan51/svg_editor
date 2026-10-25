import type { CoordinateRole } from "./CoordinateRole.js";
import { NumberFormat } from "./NumberFormat.js";

/**
 * Context of the `CoordinateRole` strategy: one named numeric geometry
 * attribute of a leaf shape (e.g. `width`), stored at full precision (V3).
 */
export class GeometryAttribute {
  private readonly attrName: string;
  private readonly role: CoordinateRole;
  private current: number;

  /** Starts at the SVG default 0 (F12); use `assign` to set a validated value. */
  constructor(name: string, role: CoordinateRole) {
    this.attrName = name;
    this.role = role;
    this.current = 0;
  }

  name(): string {
    return this.attrName;
  }

  value(): number {
    return this.current;
  }

  /** The value in the V3 output format. */
  formatted(): string {
    return NumberFormat.format(this.current);
  }

  /** Parses and validates `raw`; on failure throws and leaves the value unchanged. */
  assign(raw: string): void {
    const value = NumberFormat.parse(raw);
    this.role.validate(this.attrName, value);
    this.current = value;
  }

  shift(dx: number, dy: number): void {
    this.current = this.role.shift(this.current, dx, dy);
  }

  scale(factor: number): void {
    this.current = this.role.scale(this.current, factor);
  }

  /** Writes back a value captured earlier by a snapshot; no validation. */
  restoreValue(value: number): void {
    this.current = value;
  }
}
