/**
 * A user-visible, expected failure (bad input, missing id, constraint violation…).
 *
 * The message carries no `error:` prefix; only `Editor` adds it (rule P7).
 * Programming errors (broken invariants) are plain `Error`s, never this class.
 */
export class EditorError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "EditorError";
  }
}
