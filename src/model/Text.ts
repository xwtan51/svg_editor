import { GeometryAttribute } from "./GeometryAttribute.js";
import { LeafShape } from "./LeafShape.js";
import { ParamSpec } from "./ParamSpec.js";
import type { ShapeMemento } from "./ShapeMemento.js";
import { XCoordinate } from "./XCoordinate.js";
import { YCoordinate } from "./YCoordinate.js";

/** `<text x y>content</text>`: besides geometry it holds the text content. */
export class Text extends LeafShape {
  /** The `set` attribute name for the content (§4.1); declared before `params`, which uses it. */
  private static readonly CONTENT_ATTRIBUTE = "text";

  static readonly typeName: string = "text";
  static readonly params: readonly ParamSpec[] = [
    ParamSpec.required("x"),
    ParamSpec.required("y"),
    ParamSpec.textContent("content", Text.CONTENT_ATTRIBUTE),
  ];

  /** Static side of `ShapeType`; values are keyed by attribute name. */
  static create(id: string, values: ReadonlyMap<string, string>): Text {
    return ParamSpec.apply(new Text(id), Text.params, values);
  }

  private content = "";

  constructor(id: string) {
    super(id, [new GeometryAttribute("x", new XCoordinate()), new GeometryAttribute("y", new YCoordinate())]);
  }

  tagName(): string {
    return Text.typeName;
  }

  /** Any string is valid content, including the empty string (E3). */
  override setAttribute(name: string, raw: string): void {
    if (name !== Text.CONTENT_ATTRIBUTE) {
      super.setAttribute(name, raw);
      return;
    }
    this.content = raw;
  }

  /** `(20,40) "My Diagram"` */
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
