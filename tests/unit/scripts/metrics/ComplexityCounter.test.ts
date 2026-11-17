import { describe, expect, it } from "vitest";
import { MetricsTool } from "../../../../scripts/metrics/MetricsTool.js";
import { SourceSnapshot } from "../../../../scripts/metrics/SourceSnapshot.js";

/** Name → M_f of every function in `source`, in source order. */
function complexities(source: string): [string, number][] {
  const snapshot = SourceSnapshot.of({ "sample.ts": source });
  try {
    const [file] = snapshot.measure();
    return (file?.functions ?? []).map((f) => [f.name, f.complexity()]);
  } finally {
    snapshot.dispose();
  }
}

/** M_f of the only function `f` in `body`'s function. */
const m = (body: string) => complexities(`export function f(a: any, b: any, c: any) {\n${body}\n}\n`)[0]?.[1];

describe("ComplexityCounter (design §5.3)", () => {
  it("the built-in sample: readQuoted has M = 8 (the tool's self-check)", () => {
    expect(MetricsTool.selfCheck()).toBe(8);
    expect(complexities(MetricsTool.SAMPLE)).toEqual([["readQuoted", 8]]);
  });

  it("a function without decision points has M = 1", () => {
    expect(m("return a;")).toBe(1);
  });

  it.each([
    ["if", "if (a) { b(); }"],
    ["else if adds its own if", "if (a) { b(); } else { c(); }"],
    ["for", "for (let i = 0; i < a; i++) { b(); }"],
    ["for…in", "for (const k in a) { b(k); }"],
    ["for…of", "for (const x of a) { b(x); }"],
    ["while", "while (a) { b(); }"],
    ["do", "do { b(); } while (a);"],
    ["catch", "try { a(); } catch { b(); }"],
    ["?:", "return a ? b : c;"],
    ["&&", "return a && b;"],
    ["||", "return a || b;"],
    ["??", "return a ?? b;"],
    ["&&=", "a &&= b;"],
    ["||=", "a ||= b;"],
    ["??=", "a ??= b;"],
  ])("one decision point: %s", (_name, body) => {
    expect(m(body)).toBe(2);
  });

  it("else if is a second if", () => {
    expect(m("if (a) { b(); } else if (c) { b(); } else { c(); }")).toBe(3);
  });

  it("each case is one decision point; default is not", () => {
    expect(m("switch (a) { case 1: return b; case 2: return c; default: return a; }")).toBe(3);
    expect(m("switch (a) { default: return a; }")).toBe(1);
  });

  it("try without catch, finally, and plain operators are not decision points", () => {
    expect(m("try { a(); } finally { b(); }")).toBe(1);
    expect(m("return a + b === c || false;")).toBe(2);
    expect(m("a += b; a = b; return a !== b;")).toBe(1);
  });

  it("optional chaining ?. is not a decision point, nor is ?. with a call", () => {
    expect(m("return a?.b?.c;")).toBe(1);
    expect(m("return a?.b(c)?.[0];")).toBe(1);
    expect(m("return a?.b ?? c;")).toBe(2);
  });

  it("nested functions are counted on their own and add nothing to the outer one", () => {
    const source = [
      "export function outer(a: number[]) {",
      "  if (a.length > 0) {",
      "    return a.map((x) => (x > 0 && x < 9 ? x : 0));",
      "  }",
      "  const inner = function (y: number) { while (y) y--; return y; };",
      "  return inner(1);",
      "}",
      "",
    ].join("\n");
    expect(complexities(source)).toEqual([
      ["outer", 2],
      ["(anonymous)", 3],
      ["(anonymous)", 2],
    ]);
  });

  it("methods, constructors, accessors; an arrow function in a property initializer is one function", () => {
    const source = [
      "export class C {",
      "  private readonly pick = (x: number) => (x > 0 ? x : -x);",
      "  private value = 0;",
      "  constructor(v?: number) { this.value = v ?? 0; }",
      "  get size(): number { return this.value || 1; }",
      "  set size(v: number) { if (v) this.value = v; }",
      "  method(): number { return this.pick(this.value); }",
      "}",
      "",
    ].join("\n");
    expect(complexities(source)).toEqual([
      ["(anonymous)", 2],
      ["constructor", 2],
      ["size", 2],
      ["size", 2],
      ["method", 1],
    ]);
  });

  it("decision points outside every function count for no function", () => {
    expect(complexities("export class C {\n  static readonly X = 1 > 0 ? 1 : 2;\n}\n")).toEqual([]);
  });
});
