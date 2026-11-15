import type { AttributeChange } from "../../src/model/AttributeChange.js";
import type { AttributeHandler } from "../../src/model/AttributeHandler.js";
import type { AttributeTarget } from "../../src/model/AttributeTarget.js";
import type { ShapeView } from "../../src/model/ShapeView.js";

/**
 * Test double: an attribute handler whose `handles` and `apply` are given as
 * functions (answering anything, to script breaches). It counts its calls.
 */
export class ScriptedHandler implements AttributeHandler {
  readonly name: string;
  readonly priority: number;
  private readonly answer: (target: ShapeView, attribute: string) => unknown;
  private readonly change: (target: AttributeTarget, attribute: string, value: string) => unknown;
  private handlesCalls = 0;
  private applyCalls = 0;

  constructor(
    name: string,
    priority: number,
    handles: (target: ShapeView, attribute: string) => unknown,
    apply: (target: AttributeTarget, attribute: string, value: string) => unknown = () => {
      throw new Error("apply not scripted");
    },
  ) {
    this.name = name;
    this.priority = priority;
    this.answer = handles;
    this.change = apply;
  }

  handles(target: ShapeView, attribute: string): boolean {
    this.handlesCalls += 1;
    return this.answer(target, attribute) as boolean;
  }

  apply(target: AttributeTarget, attribute: string, value: string): AttributeChange {
    this.applyCalls += 1;
    return this.change(target, attribute, value) as AttributeChange;
  }

  calls(): { handles: number; apply: number } {
    return { handles: this.handlesCalls, apply: this.applyCalls };
  }
}
