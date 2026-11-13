/** One difference between a session's baseline and a fresh run. */
export class Mismatch {
  constructor(
    readonly session: string,
    /** One line: what differs and where, e.g. `stdout differs at line 12`. */
    readonly headline: string,
    /** Optional detail (a unified diff), printed under the headline. */
    readonly detail: string = "",
  ) {}

  render(): string {
    const head = `FAIL ${this.session}: ${this.headline}\n`;
    if (this.detail === "") {
      return head;
    }
    return head + this.detail + (this.detail.endsWith("\n") ? "" : "\n");
  }
}
