import { EditorError } from "./EditorError.js";
import { NumberFormat } from "./NumberFormat.js";

/** Immutable canvas width × height in px; both must be positive and finite (F2). */
export class CanvasSize {
  static readonly DEFAULT = new CanvasSize(800, 600);

  private readonly w: number;
  private readonly h: number;

  constructor(width: number, height: number) {
    if (!CanvasSize.isPositive(width) || !CanvasSize.isPositive(height)) {
      throw new EditorError("canvas size must be positive");
    }
    this.w = width;
    this.h = height;
  }

  width(): number {
    return this.w;
  }

  height(): number {
    return this.h;
  }

  /** `800x600`, numbers in the V3 format. */
  toString(): string {
    return `${NumberFormat.format(this.w)}x${NumberFormat.format(this.h)}`;
  }

  private static isPositive(value: number): boolean {
    return Number.isFinite(value) && value > 0;
  }
}
