import type { CoordinateRole } from "./CoordinateRole.js";

/** A horizontal position (x, cx, x1, x2): follows dx, any finite value (E4). */
export class XCoordinate implements CoordinateRole {
  shift(value: number, dx: number, _dy: number): number {
    return value + dx;
  }

  scale(value: number, factor: number): number {
    return value * factor;
  }

  validate(_name: string, _value: number): void {}
}
