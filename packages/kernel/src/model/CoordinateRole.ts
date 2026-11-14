/**
 * Strategy: how a geometry attribute reacts to move and scale, and which values
 * it accepts. Concrete roles: `XCoordinate`, `YCoordinate`, `Extent`.
 */
export interface CoordinateRole {
  /** Value after translating the shape by (dx, dy). */
  shift(value: number, dx: number, dy: number): number;

  /** Value after scaling the shape by `factor` about the origin (E12). */
  scale(value: number, factor: number): number;

  /** Throws `invalid value for <name>: <value>` if the role rejects the value. */
  validate(name: string, value: number): void;
}
