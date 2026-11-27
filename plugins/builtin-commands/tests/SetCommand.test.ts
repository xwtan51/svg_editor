import { EditorError, SvgSerializer } from "@svgframe/kernel";
import type { AttributeChange, AttributeHandler, AttributeTarget, ShapeView } from "@svgframe/kernel";
import { describe, expect, it } from "vitest";
import { FakePairProvider } from "./doubles/FakePairProvider.js";
import { TestEditor } from "./doubles/TestEditor.js";
import type { TestAssembly } from "./doubles/TestEditor.js";

/**
 * `set` through attribute handlers installed by a test plugin (design §2.4.3):
 * `create pair n1 x y` builds a `<g>` echoed as `pair#n1` with a dot part
 * `n1-a`. The handler `pair-fill` sends `fill` on a pair to its part;
 * `pair-tag` handles `tag` and changes the part, then fails in a scripted way.
 * A failing `set` leaves document, undo / redo depth and io lock unchanged
 * and never falls back to the whitelist.
 */
class FillChange implements AttributeChange {
  private readonly label: string;
  private readonly value: string;

  constructor(label: string, value: string) {
    this.label = label;
    this.value = value;
  }

  appliedMessage(): string {
    return `${this.label} fill propagated: ${this.value}`;
  }

  undoneMessage(): string {
    return `${this.label} fill restored`;
  }
}

class PairFill implements AttributeHandler {
  readonly name = "pair-fill";
  readonly priority = 0;
  applied = 0;

  handles(target: ShapeView, attribute: string): boolean {
    return target.kindName() === "pair" && attribute === "fill";
  }

  apply(target: AttributeTarget, _attribute: string, value: string): AttributeChange {
    this.applied += 1;
    target.part(`${target.view().getId()}-a`).setAttribute("fill", value);
    return new FillChange(target.view().label(), value);
  }
}

/** Handles `fill` and `tag` on pairs: changes the part's fill, then fails as `failure` says. */
class FailingPairHandler implements AttributeHandler {
  readonly name = "pair-broken";
  readonly priority: number;
  private readonly failure: () => never;

  constructor(failure: () => never, priority: number = 0) {
    this.failure = failure;
    this.priority = priority;
  }

  handles(target: ShapeView, attribute: string): boolean {
    return target.kindName() === "pair" && (attribute === "fill" || attribute === "tag");
  }

  apply(target: AttributeTarget, _attribute: string, value: string): AttributeChange {
    target.part(`${target.view().getId()}-a`).setAttribute("fill", value);
    target.setAttribute("stroke", value);
    return this.failure();
  }
}

function setup(...handlers: AttributeHandler[]): TestAssembly {
  const plugin = TestEditor.plugin("handlers", { attributes: handlers.map((h) => h.name) }, (context) =>
    handlers.forEach((handler) => context.registerAttributeHandler(handler)),
  );
  const assembly = TestEditor.assemble([new FakePairProvider()], {}, [plugin]);
  ["init", "create pair n1 1 2", "create dot d1 3 4"].forEach((line) => assembly.editor.executeLine(line));
  return assembly;
}

function run(assembly: TestAssembly, ...lines: string[]): string[] {
  return lines.flatMap((line) => assembly.editor.executeLine(line));
}

function state(assembly: TestAssembly): unknown[] {
  const history = assembly.session.history();
  return [new SvgSerializer().serialize(assembly.session.document()), history.undoDepth(), history.redoDepth(), history.isLocked()];
}

describe("set through a handler", () => {
  it("succeeds with the handler's echo; undo and redo each once, redo echoing like the first run", () => {
    const handler = new PairFill();
    const assembly = setup(handler);
    const part = () => new SvgSerializer().serialize(assembly.session.document()).split("\n").find((line) => line.includes('"n1-a"'))?.trim();
    expect(run(assembly, "set n1 fill red")).toEqual(["pair#n1 fill propagated: red"]);
    expect(part()).toBe('<dot id="n1-a" x="1" y="2" fill="red"/>');
    expect(run(assembly, "undo")).toEqual(["pair#n1 fill restored"]);
    expect(part()).toBe('<dot id="n1-a" x="1" y="2"/>');
    expect(run(assembly, "redo")).toEqual(["pair#n1 fill propagated: red"]);
    expect(part()).toBe('<dot id="n1-a" x="1" y="2" fill="red"/>');
    expect(handler.applied).toBe(1);
    expect(assembly.session.history().undoDepth()).toBe(3);
  });

  it("an attribute or shape no handler takes goes the Phase 1 whitelist way", () => {
    const assembly = setup(new PairFill());
    expect(run(assembly, "set d1 fill red")).toEqual(["dot#d1 updated: fill=red"]);
    expect(run(assembly, "set n1 stroke blue")).toEqual(["pair#n1 updated: stroke=blue"]);
    expect(run(assembly, "set d1 label x")).toEqual(["error: unknown attribute: label"]);
    expect(run(assembly, "set n1 label x")).toEqual(["error: unknown attribute: label"]);
  });

  it("no such shape is still reported first", () => {
    expect(run(setup(new PairFill()), "set nope fill red")).toEqual(["error: no such shape: nope"]);
  });
});

describe("set through a failing handler: state unchanged, no whitelist fallback", () => {
  const failures: ReadonlyArray<readonly [string, () => never, string]> = [
    ["an EditorError (reported as is)", () => { throw new EditorError("invalid value for tag: x"); }, "error: invalid value for tag: x"],
    ["a plain Error (wrapped)", () => { throw new Error("oops"); }, "error: attribute handler failed: pair-broken (oops)"],
  ];

  it.each(failures)("%s after a partial change", (_name, failure, message) => {
    const assembly = setup(new FailingPairHandler(failure));
    run(assembly, "set d1 fill red");
    const before = state(assembly);
    expect(run(assembly, "set n1 fill green")).toEqual([message]);
    expect(run(assembly, "set n1 tag green")).toEqual([message]);
    expect(state(assembly)).toEqual(before);
    expect(run(assembly, "undo")).toEqual(["dot#d1 updated: fill unset"]);
  });

  it.each(failures)("%s after a partial change, with a redo pending: both stacks and the document stay, redo still redoes", (_name, failure, message) => {
    const assembly = setup(new FailingPairHandler(failure));
    run(assembly, "set d1 fill red", "set d1 stroke blue", "undo");
    const before = state(assembly);
    expect(before.slice(1)).toEqual([3, 1, false]);
    expect(run(assembly, "set n1 fill green")).toEqual([message]);
    expect(state(assembly)).toEqual(before);
    expect(run(assembly, "redo")).toEqual(["dot#d1 updated: stroke=blue"]);
    expect(run(assembly, "undo", "undo")).toEqual(["dot#d1 updated: stroke unset", "dot#d1 updated: fill unset"]);
  });

  it("after save, a failing set does not lift the io lock and keeps the stacks empty", () => {
    const assembly = setup(new FailingPairHandler(() => { throw new Error("oops"); }));
    run(assembly, "save a.svg");
    const before = state(assembly);
    expect(before.slice(1)).toEqual([0, 0, true]);
    expect(run(assembly, "set n1 fill green")).toEqual(["error: attribute handler failed: pair-broken (oops)"]);
    expect(state(assembly)).toEqual(before);
    expect(run(assembly, "undo")).toEqual(["error: undo not allowed after io command"]);
  });

  it("the whitelist would have accepted fill on the g, but a failing handler is not bypassed", () => {
    const assembly = setup(new FailingPairHandler(() => { throw new Error("oops"); }));
    run(assembly, "set n1 fill green");
    expect(run(assembly, "show n1")[0]).toBe("pair#n1  parent=svg");
    expect(new SvgSerializer().serialize(assembly.session.document())).not.toContain("green");
  });

  it("two handlers tied at the top: ambiguous, nothing applied, no fallback", () => {
    const fill = new PairFill();
    const assembly = setup(fill, new FailingPairHandler(() => { throw new Error("never"); }));
    const before = state(assembly);
    expect(run(assembly, "set n1 fill red")).toEqual(["error: ambiguous attribute handlers for fill on n1: pair-fill, pair-broken"]);
    expect(state(assembly)).toEqual(before);
    expect(fill.applied).toBe(0);
  });

  it("a higher priority resolves the tie", () => {
    const fill = new PairFill();
    const assembly = setup(fill, new FailingPairHandler(() => { throw new Error("low priority, never runs"); }, -1));
    expect(run(assembly, "set n1 fill red")).toEqual(["pair#n1 fill propagated: red"]);
  });
});
