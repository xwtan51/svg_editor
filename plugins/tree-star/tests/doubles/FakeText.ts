import { GeometryAttribute, LeafShape, ParamSpec, XCoordinate, YCoordinate } from "@svgframe/kernel";
import type { ShapeMemento } from "@svgframe/kernel";

/**
 * Test double: `<text x y>content</text>` written like the built-in `Text`
 * (L3): geometry plus the text content, set through the attribute `text`.
 */
export class FakeText extends LeafShape {
  private static readonly CONTENT_ATTRIBUTE = "text";

  static readonly typeName: string = "text";
  static readonly params: readonly ParamSpec[] = [
    ParamSpec.required("x"),
    ParamSpec.required("y"),
    ParamSpec.textContent("content", FakeText.CONTENT_ATTRIBUTE),
  ];

  /** Static side of `ShapeType`. */
  static create(id: string, values: ReadonlyMap<string, string>): FakeText {
    return ParamSpec.apply(new FakeText(id), FakeText.params, values);
  }

  private content = "";

  constructor(id: string) {
    super(id, [new GeometryAttribute("x", new XCoordinate()), new GeometryAttribute("y", new YCoordinate())]);
  }

  tagName(): string {
    return FakeText.typeName;
  }

  override setAttribute(name: string, raw: string): void {
    if (name !== FakeText.CONTENT_ATTRIBUTE) {
      super.setAttribute(name, raw);
      return;
    }
    this.content = raw;
  }

  /** `(20,40) "My Diagram"`, as the built-in `Text`. */
  summary(): string {
    return `(${this.geometryText("x")},${this.geometryText("y")}) "${this.content}"`;
  }

  override textContent(): string {
    return this.content;
  }

  override restore(memento: ShapeMemento): void {
    super.restore(memento);
    const text = memento.text();
    if (text === null) {
      throw new Error(`memento for ${this.label()} lacks text content`);
    }
    this.content = text;
  }

  protected anchor(): readonly [string, string] {
    return ["x", "y"];
  }
}
