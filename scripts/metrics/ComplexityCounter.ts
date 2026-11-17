import { SyntaxKind } from "typescript/unstable/ast";
import type { BinaryExpression, Node, SourceFile } from "typescript/unstable/ast";
import { FunctionComplexity } from "./FunctionComplexity.js";

/**
 * Counts cyclomatic complexity with the rules of design §5.3 (decision X18).
 *
 * - Functions: function declarations and expressions, methods, constructors,
 *   get / set accessors and arrow functions (also an arrow function in a class
 *   property initializer). A nested function is counted on its own and adds
 *   nothing to the function around it.
 * - Decision points: `if`, `for`, `for … in`, `for … of`, `while`, `do`, each
 *   `case` (not `default`), `catch`, `?:`, and the operators `&&`, `||`, `??`,
 *   `&&=`, `||=`, `??=`. Optional chaining `?.` is not a decision point.
 * - $M_f = 1 + d_f$; a file's $M$ is the sum over its functions. Decision
 *   points outside every function (none in this repository's run code) count
 *   for no function.
 */
export class ComplexityCounter {
  private static readonly FUNCTIONS: ReadonlySet<SyntaxKind> = new Set([
    SyntaxKind.FunctionDeclaration,
    SyntaxKind.MethodDeclaration,
    SyntaxKind.Constructor,
    SyntaxKind.GetAccessor,
    SyntaxKind.SetAccessor,
    SyntaxKind.FunctionExpression,
    SyntaxKind.ArrowFunction,
  ]);

  private static readonly DECISIONS: ReadonlySet<SyntaxKind> = new Set([
    SyntaxKind.IfStatement,
    SyntaxKind.ForStatement,
    SyntaxKind.ForInStatement,
    SyntaxKind.ForOfStatement,
    SyntaxKind.WhileStatement,
    SyntaxKind.DoStatement,
    SyntaxKind.CaseClause,
    SyntaxKind.CatchClause,
    SyntaxKind.ConditionalExpression,
  ]);

  private static readonly OPERATORS: ReadonlySet<SyntaxKind> = new Set([
    SyntaxKind.AmpersandAmpersandToken,
    SyntaxKind.BarBarToken,
    SyntaxKind.QuestionQuestionToken,
    SyntaxKind.AmpersandAmpersandEqualsToken,
    SyntaxKind.BarBarEqualsToken,
    SyntaxKind.QuestionQuestionEqualsToken,
  ]);

  /** Every function of `file`, in source order (a function before the ones nested in it). */
  functions(file: SourceFile): FunctionComplexity[] {
    const found: FunctionComplexity[] = [];
    this.visit(file, file, null, found);
    return found;
  }

  private visit(file: SourceFile, node: Node, owner: FunctionComplexity | null, found: FunctionComplexity[]): void {
    let current = owner;
    if (ComplexityCounter.FUNCTIONS.has(node.kind)) {
      current = new FunctionComplexity(ComplexityCounter.nameOf(file, node), file.getLineAndCharacterOfPosition(node.getStart(file)).line + 1);
      found.push(current);
    } else if (current !== null && ComplexityCounter.isDecision(node)) {
      current.addDecision();
    }
    node.forEachChild((child) => {
      this.visit(file, child, current, found);
      return undefined;
    });
  }

  private static isDecision(node: Node): boolean {
    if (ComplexityCounter.DECISIONS.has(node.kind)) {
      return true;
    }
    return node.kind === SyntaxKind.BinaryExpression && ComplexityCounter.OPERATORS.has((node as BinaryExpression).operatorToken.kind);
  }

  private static nameOf(file: SourceFile, node: Node): string {
    if (node.kind === SyntaxKind.Constructor) {
      return "constructor";
    }
    const name = (node as { readonly name?: Node }).name;
    return name === undefined ? "(anonymous)" : name.getText(file);
  }
}
