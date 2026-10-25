import type { CoordinateRole } from "./CoordinateRole.js";
import { EditorError } from "./EditorError.js";

/** A size (width, height, r, rx, ry): unaffected by move, must be ≥ 0 (E4). */
export class Extent implements CoordinateRole {
  shift(value: number, _dx: number, _dy: number): number {
    return value;
  }

  scale(value: number, factor: number): number {
    return value * factor;
  }

  validate(name: string, value: number): void {
    if (!(value >= 0)) {
      // String(), not NumberFormat: -1e-9 must not be shown as "0".
      throw new EditorError(`invalid value for ${name}: ${String(value)}`);
    }
  }
}
