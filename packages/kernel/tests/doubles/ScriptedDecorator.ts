import type { TreeDecorator } from "../../src/view/TreeDecorator.js";
import type { TreeRowView } from "../../src/view/TreeRowView.js";

/** Test double: a tree decorator whose `tagFor` is given as a function (returning anything, to script breaches). */
export class ScriptedDecorator implements TreeDecorator {
  readonly name: string;
  private readonly tag: (row: TreeRowView) => unknown;

  constructor(name: string, tag: (row: TreeRowView) => unknown) {
    this.name = name;
    this.tag = tag;
  }

  tagFor(row: TreeRowView): string | null {
    return this.tag(row) as string | null;
  }
}
