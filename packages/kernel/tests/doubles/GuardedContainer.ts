import type { Shape } from "../../src/model/Shape.js";
import { FakeContainer } from "./FakeContainer.js";

/** Test double: a container that refuses to release the children whose ids are listed (design §3.7). */
export class GuardedContainer extends FakeContainer {
  private readonly required: readonly string[];

  constructor(id: string, required: readonly string[]) {
    super(id, "guarded", false);
    this.required = [...required];
  }

  override canRelease(child: Shape): boolean {
    return !this.required.includes(child.getId());
  }
}
