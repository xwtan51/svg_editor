import type { Shape } from "@svgframe/kernel";
import { FakeGroup } from "./FakeGroup.js";

/** Test double: a `<g>` of a composite type that refuses to release its required parts (design §3.7). */
export class FakeLockedGroup extends FakeGroup {
  private readonly required: readonly string[];

  constructor(id: string, kind: string, required: readonly string[]) {
    super(id, kind);
    this.required = [...required];
  }

  override canRelease(child: Shape): boolean {
    return !this.required.includes(child.getId());
  }
}
