import type { ElementView } from "@svgframe/kernel";

/** Test double: an XML element as read-back sees it, built in the test (name, attributes, children). */
export class FakeElement implements ElementView {
  private readonly tag: string;
  private readonly attrs: ReadonlyArray<[string, string]>;
  private readonly kids: readonly ElementView[];

  constructor(tag: string, attributes: Record<string, string> = {}, children: readonly ElementView[] = []) {
    this.tag = tag;
    this.attrs = Object.entries(attributes);
    this.kids = [...children];
  }

  name(): string {
    return this.tag;
  }

  attribute(name: string): string | undefined {
    return this.attrs.find(([key]) => key === name)?.[1];
  }

  attributes(): Array<[string, string]> {
    return this.attrs.map(([key, value]) => [key, value]);
  }

  children(): readonly ElementView[] {
    return this.kids;
  }

  text(): string {
    return "";
  }
}
