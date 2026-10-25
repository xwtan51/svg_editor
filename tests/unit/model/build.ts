import type { Shape } from "../../../src/model/Shape.js";

/** Test helper: applies `set`-style attributes in order and returns the same shape. */
export function build<T extends Shape>(shape: T, attributes: Record<string, string>): T {
  for (const [name, raw] of Object.entries(attributes)) {
    shape.setAttribute(name, raw);
  }
  return shape;
}
