import type { ShapeView } from "../../src/model/ShapeView.js";

/**
 * Test double: a hand-written `ShapeView` that is not a `Shape`. It has only
 * the view methods, so code that reaches for anything else (`asContainer`,
 * `childList`, …) fails when given it.
 */
export class FakeShapeView implements ShapeView {
  private readonly id: string;
  private readonly tag: string;
  private readonly attributes: ReadonlyArray<readonly [string, string]>;
  private readonly text: string | null;
  private readonly children: readonly ShapeView[];

  constructor(
    tag: string,
    attributes: ReadonlyArray<readonly [string, string]>,
    children: readonly ShapeView[] = [],
    text: string | null = null,
  ) {
    this.tag = tag;
    this.attributes = attributes;
    this.id = attributes.find(([name]) => name === "id")?.[1] ?? "";
    this.children = children;
    this.text = text;
  }

  getId(): string {
    return this.id;
  }

  tagName(): string {
    return this.tag;
  }

  kindName(): string {
    return this.tag;
  }

  label(): string {
    return `${this.tag}#${this.id}`;
  }

  treeLabel(): string {
    return `${this.tag}#${this.id}`;
  }

  summary(): string {
    return "";
  }

  svgAttributes(): Array<[string, string]> {
    return this.attributes.map(([name, value]) => [name, value]);
  }

  textContent(): string | null {
    return this.text;
  }

  parentId(): string | null {
    return null;
  }

  isContainer(): boolean {
    return this.children.length > 0;
  }

  childViews(): readonly ShapeView[] {
    return this.children;
  }
}
