/**
 * The `<reason>` of a contract-breach message such as
 * `plugin failed to activate: <name> (<reason>)` (design §3.3.1, §3.9): the
 * first line of an `Error`'s message, otherwise `String(value)`. Deterministic
 * for the same input on the same machine.
 */
export class FailureReason {
  private constructor() {}

  static of(error: unknown): string {
    const text = error instanceof Error ? error.message : String(error);
    return text.split(/\r?\n/, 1)[0] ?? "";
  }
}
