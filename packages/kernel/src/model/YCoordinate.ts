import type { CoordinateRole } from "./CoordinateRole.js";

/** A vertical position (y, cy, y1, y2): follows dy, any finite value (E4). */
export class YCoordinate implements CoordinateRole {
  shift(value: number, _dx: number, dy: number): number {
    return value + dy;
  }

  scale(value: number, factor: number): number {
    return value * factor;
  }

  validate(_name: string, _value: number): void {}
}
