import type { FunctionComplexity } from "./FunctionComplexity.js";

/** What the metrics record for one source file of one revision (design §5.3). */
export class FileMeasure {
  constructor(
    /** Repository-relative path, `/`-separated. */
    readonly path: string,
    readonly lines: number,
    readonly codeLines: number,
    readonly functions: readonly FunctionComplexity[],
    /** First sentence of the class comment, or null when the file has none. */
    readonly responsibility: string | null,
  ) {}

  /** $M$ of the file: the sum of its functions' $M_f$. */
  complexity(): number {
    return this.functions.reduce((sum, f) => sum + f.complexity(), 0);
  }

  /** $\max_f M_f$, 0 for a file without functions. */
  maxComplexity(): number {
    return this.functions.reduce((max, f) => Math.max(max, f.complexity()), 0);
  }
}
