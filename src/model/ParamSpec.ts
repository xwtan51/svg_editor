import type { Shape } from "./Shape.js";

/**
 * Describes one positional `create` parameter of a shape type: the name shown
 * in usage text, the attribute it sets, whether it may be omitted, and whether
 * a file stores it as element content rather than as an XML attribute.
 */
export class ParamSpec {
  private readonly label: string;
  private readonly attribute: string;
  private readonly optional: boolean;
  private readonly content: boolean;

  private constructor(label: string, attribute: string, optional: boolean, content: boolean) {
    this.label = label;
    this.attribute = attribute;
    this.optional = optional;
    this.content = content;
  }

  /** A required numeric/attribute parameter, e.g. `<w>` setting `width`. */
  static required(label: string, attribute: string = label): ParamSpec {
    return new ParamSpec(label, attribute, false, false);
  }

  /** A trailing optional parameter, e.g. `[fill]`. */
  static optionalAttribute(attribute: string): ParamSpec {
    return new ParamSpec(attribute, attribute, true, false);
  }

  /** The text content parameter (`"content"`), set through the `text` attribute. */
  static textContent(label: string, attribute: string): ParamSpec {
    return new ParamSpec(label, attribute, false, true);
  }

  /** Sets every parameter present in `values` (keyed by attribute name) on `shape`, in spec order. */
  static apply<T extends Shape>(shape: T, specs: readonly ParamSpec[], values: ReadonlyMap<string, string>): T {
    for (const key of values.keys()) {
      if (!specs.some((spec) => spec.attribute === key)) {
        throw new Error(`${shape.tagName()} has no create parameter ${key}`);
      }
    }
    for (const spec of specs) {
      const raw = values.get(spec.attribute);
      if (raw !== undefined) {
        shape.setAttribute(spec.attribute, raw);
      }
    }
    return shape;
  }

  /** The attribute name used as the key of `ShapeType.create` values and by `setAttribute`. */
  attributeName(): string {
    return this.attribute;
  }

  isOptional(): boolean {
    return this.optional;
  }

  /** True when the value lives in the element's character content in SVG. */
  isContent(): boolean {
    return this.content;
  }

  /** `<x>`, `[fill]` or `"content"`, as in §4.1. */
  usageToken(): string {
    if (this.content) {
      return `"${this.label}"`;
    }
    return this.optional ? `[${this.label}]` : `<${this.label}>`;
  }
}
