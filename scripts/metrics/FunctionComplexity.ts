/** The cyclomatic complexity of one function: $M_f = 1 + d_f$ (design §5.3). */
export class FunctionComplexity {
  private decisions = 0;

  constructor(
    /** The function's name as written, or `(anonymous)`. */
    readonly name: string,
    /** 1-based line of the function's first token. */
    readonly line: number,
  ) {}

  addDecision(): void {
    this.decisions += 1;
  }

  complexity(): number {
    return 1 + this.decisions;
  }
}
