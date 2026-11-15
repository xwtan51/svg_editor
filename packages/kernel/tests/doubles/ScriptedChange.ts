import type { AttributeChange } from "../../src/model/AttributeChange.js";

/** Test double: an `AttributeChange` whose two messages are given as functions (to script breaches). */
export class ScriptedChange implements AttributeChange {
  private readonly applied: () => unknown;
  private readonly undone: () => unknown;

  constructor(applied: string | (() => unknown), undone: string | (() => unknown)) {
    this.applied = typeof applied === "string" ? () => applied : applied;
    this.undone = typeof undone === "string" ? () => undone : undone;
  }

  appliedMessage(): string {
    return this.applied() as string;
  }

  undoneMessage(): string {
    return this.undone() as string;
  }
}
