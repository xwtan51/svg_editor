import type { ElementView } from "../../src/model/ElementView.js";

/** Test double: an `ElementView` built in memory. */
export class FakeElement implements ElementView {
  private readonly tag: string;
  private readonly attributeList: ReadonlyArray<[string, string]>;
  private readonly childElements: readonly ElementView[];
  private readonly content: string;

  constructor(
    name: string,
    attributes: ReadonlyArray<[string, string]> = [],
    children: readonly ElementView[] = [],
    text: string = "",
  ) {
    this.tag = name;
    this.attributeList = attributes;
    this.childElements = children;
    this.content = text;
  }

  name(): string {
    return this.tag;
  }

  attribute(name: string): string | undefined {
    return this.attributeList.find(([key]) => key === name)?.[1];
  }

  attributes(): Array<[string, string]> {
    return this.attributeList.map(([key, value]) => [key, value]);
  }

  children(): readonly ElementView[] {
    return this.childElements;
  }

  text(): string {
    return this.content;
  }
}
