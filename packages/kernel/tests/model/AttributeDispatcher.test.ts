import { describe, expect, it } from "vitest";
import { SvgSerializer } from "../../src/io/SvgSerializer.js";
import { AttributeDispatcher } from "../../src/model/AttributeDispatcher.js";
import type { AttributeTarget } from "../../src/model/AttributeTarget.js";
import type { ContainerShape } from "../../src/model/ContainerShape.js";
import { EditableSubtree } from "../../src/model/EditableSubtree.js";
import { EditorError } from "../../src/model/EditorError.js";
import type { ShapeView } from "../../src/model/ShapeView.js";
import { SvgDocument } from "../../src/model/SvgDocument.js";
import { FakeContainer } from "../doubles/FakeContainer.js";
import { FakeLeaf } from "../doubles/FakeLeaf.js";
import { ScriptedChange } from "../doubles/ScriptedChange.js";
import { ScriptedHandler } from "../doubles/ScriptedHandler.js";

/**
 * `AttributeDispatcher.plan` (design §2.4.3) with test handlers: resolution
 * (hit, miss, priority, tie), the snapshot transaction (rollback of partial
 * changes on any failure in steps 5–7, including the echoes), and the
 * planned edit (one undo unit, echoes kept). The document is a composite
 * `n1` with parts `n1-a`, `n1-b`, plus a separate leaf `solo`.
 */
function fixture(): { doc: SvgDocument; n1: FakeContainer; solo: FakeLeaf; text: () => string } {
  const doc = new SvgDocument();
  const n1 = new FakeContainer("n1", "composite");
  const solo = new FakeLeaf("solo");
  doc.insertAt(n1, 0);
  doc.insertAt(solo, 1);
  n1.insertAt(new FakeLeaf("n1-a"), 0);
  n1.insertAt(new FakeLeaf("n1-b"), 1);
  const serializer = new SvgSerializer();
  return { doc, n1, solo, text: () => serializer.serialize(doc) };
}

const onComposite = (attribute: string) => (target: ShapeView, asked: string) => target.kindName() === "composite" && asked === attribute;

/** fill → both parts; the echoes name the value. */
const fillBoth = (target: AttributeTarget, _attribute: string, value: string) => {
  target.part("n1-a").setAttribute("fill", value);
  target.part("n1-b").setAttribute("fill", value);
  return new ScriptedChange(`composite#n1 fill ${value}`, "composite#n1 fill restored");
};

function failure(run: () => unknown): string {
  try {
    run();
  } catch (error) {
    expect(error).toBeInstanceOf(EditorError);
    return (error as Error).message;
  }
  return "no error";
}

describe("AttributeDispatcher: resolution", () => {
  it("no handler responsible → null, and the document is untouched", () => {
    const { n1, text } = fixture();
    const before = text();
    const other = new ScriptedHandler("other", 0, onComposite("label"));
    expect(new AttributeDispatcher([other]).plan(n1, "fill", "red")).toBeNull();
    expect(new AttributeDispatcher([]).plan(n1, "fill", "red")).toBeNull();
    expect(other.calls()).toEqual({ handles: 1, apply: 0 });
    expect(text()).toBe(before);
  });

  it("a hit: the handler is tried out, the document is unchanged after planning, redo applies", () => {
    const { n1, text } = fixture();
    const before = text();
    const edit = new AttributeDispatcher([new ScriptedHandler("h", 0, onComposite("fill"), fillBoth)]).plan(n1, "fill", "red");
    expect(edit).not.toBeNull();
    expect(text()).toBe(before);
    edit?.redo();
    expect(text()).toContain('<fake-leaf id="n1-a" px="0" py="0" fill="red"/>');
    expect(text()).toContain('<fake-leaf id="n1-b" px="0" py="0" fill="red"/>');
    expect([edit?.appliedMessage(), edit?.undoneMessage()]).toEqual(["composite#n1 fill red", "composite#n1 fill restored"]);
  });

  it("handles is asked of every handler in registration order and sees the target as a view", () => {
    const { n1 } = fixture();
    const asked: string[] = [];
    const record = (name: string, answer: boolean) => (target: ShapeView, attribute: string) => {
      asked.push(`${name}:${target.getId()}:${attribute}`);
      return answer;
    };
    const handlers = [new ScriptedHandler("x", 0, record("x", false)), new ScriptedHandler("y", 0, record("y", true), fillBoth), new ScriptedHandler("z", 0, record("z", false))];
    new AttributeDispatcher(handlers).plan(n1, "fill", "red");
    expect(asked).toEqual(["x:n1:fill", "y:n1:fill", "z:n1:fill"]);
  });

  it("the highest priority wins, whatever the registration order", () => {
    const { n1 } = fixture();
    const low = new ScriptedHandler("low", 0, onComposite("fill"), fillBoth);
    const high = new ScriptedHandler("high", 5, onComposite("fill"), () => new ScriptedChange("high won", "high undone"));
    const negative = new ScriptedHandler("negative", -3, onComposite("fill"), fillBoth);
    expect(new AttributeDispatcher([low, high, negative]).plan(n1, "fill", "red")?.appliedMessage()).toBe("high won");
    expect([low.calls().apply, negative.calls().apply]).toEqual([0, 0]);
  });

  it("a tie at the top is refused, naming the tied handlers in registration order; nothing is applied", () => {
    const { n1, text } = fixture();
    const before = text();
    const a = new ScriptedHandler("a", 1, onComposite("fill"), fillBoth);
    const lower = new ScriptedHandler("lower", 0, onComposite("fill"), fillBoth);
    const b = new ScriptedHandler("b", 1, onComposite("fill"), fillBoth);
    expect(failure(() => new AttributeDispatcher([a, lower, b]).plan(n1, "fill", "red"))).toBe(
      "ambiguous attribute handlers for fill on n1: a, b",
    );
    expect([a.calls().apply, lower.calls().apply, b.calls().apply]).toEqual([0, 0, 0]);
    expect(text()).toBe(before);
  });

  it("a tie below the top does not matter", () => {
    const { n1 } = fixture();
    const handlers = [
      new ScriptedHandler("a", 0, onComposite("fill"), fillBoth),
      new ScriptedHandler("b", 0, onComposite("fill"), fillBoth),
      new ScriptedHandler("top", 2, onComposite("fill"), () => new ScriptedChange("top", "top undone")),
    ];
    expect(new AttributeDispatcher(handlers).plan(n1, "fill", "red")?.appliedMessage()).toBe("top");
  });
});

describe("AttributeDispatcher: breaches of handles", () => {
  it("throwing an Error → attribute handler failed, later handlers are not asked", () => {
    const { n1, text } = fixture();
    const before = text();
    const later = new ScriptedHandler("later", 0, onComposite("fill"), fillBoth);
    const thrower = new ScriptedHandler("thrower", 0, () => {
      throw new Error("cannot tell\ndetails");
    });
    expect(failure(() => new AttributeDispatcher([thrower, later]).plan(n1, "fill", "red"))).toBe(
      "attribute handler failed: thrower (cannot tell)",
    );
    expect(later.calls().handles).toBe(0);
    expect(text()).toBe(before);
  });

  it("throwing an EditorError → reported as is", () => {
    const { n1 } = fixture();
    const thrower = new ScriptedHandler("thrower", 0, () => {
      throw new EditorError("my own message");
    });
    expect(failure(() => new AttributeDispatcher([thrower]).plan(n1, "fill", "red"))).toBe("my own message");
  });

  it.each([["undefined", undefined], ["a string", "yes"], ["a number", 1]])("answering %s → attribute handler failed", (_name, answer) => {
    const { n1 } = fixture();
    expect(failure(() => new AttributeDispatcher([new ScriptedHandler("odd", 0, () => answer)]).plan(n1, "fill", "red"))).toBe(
      "attribute handler failed: odd (handles must return a boolean)",
    );
  });
});

describe("AttributeDispatcher: the transaction rolls back every failure of steps 5–7", () => {
  /** A handler that changes `n1-a` first, then runs `then` (which may throw or answer something). */
  function partial(then: () => unknown): ScriptedHandler {
    return new ScriptedHandler("partial", 0, onComposite("fill"), (target, _attribute, value) => {
      target.part("n1-a").setAttribute("fill", value);
      target.part("n1-b").setAttribute("px", "99");
      return then();
    });
  }

  const cases: ReadonlyArray<readonly [string, () => unknown, string]> = [
    ["apply throws EditorError after a partial change → as is", () => { throw new EditorError("invalid value for fill: x"); }, "invalid value for fill: x"],
    ["apply throws Error after a partial change", () => { throw new Error("half done"); }, "attribute handler failed: partial (half done)"],
    ["apply throws a non-Error", () => { throw 42; }, "attribute handler failed: partial (42)"],
    ["apply answers undefined", () => undefined, "attribute handler failed: partial (apply must return an AttributeChange (appliedMessage and undoneMessage))"],
    ["apply answers an object without the methods", () => ({ appliedMessage: "x" }), "attribute handler failed: partial (apply must return an AttributeChange (appliedMessage and undoneMessage))"],
    ["appliedMessage throws Error", () => new ScriptedChange(() => { throw new Error("no echo"); }, "u"), "attribute handler failed: partial (no echo)"],
    ["undoneMessage throws EditorError → as is", () => new ScriptedChange("a", () => { throw new EditorError("no undo echo"); }), "no undo echo"],
    ["appliedMessage answers an empty string", () => new ScriptedChange("", "u"), "attribute handler failed: partial (appliedMessage must return a non-empty single line)"],
    ["appliedMessage answers two lines", () => new ScriptedChange("a\nb", "u"), "attribute handler failed: partial (appliedMessage must return a non-empty single line)"],
    ["undoneMessage answers a non-string", () => new ScriptedChange("a", () => 3), "attribute handler failed: partial (undoneMessage must return a non-empty single line)"],
  ];

  it.each(cases)("%s; the document is restored", (_name, then, message) => {
    const { n1, text } = fixture();
    const before = text();
    expect(failure(() => new AttributeDispatcher([partial(then)]).plan(n1, "fill", "red"))).toBe(message);
    expect(text()).toBe(before);
  });

  it("part() outside the target subtree → attribute handler failed, restored", () => {
    const { n1, text } = fixture();
    const before = text();
    const reachOut = new ScriptedHandler("reach", 0, onComposite("fill"), (target) => {
      target.part("n1-a").setAttribute("fill", "red");
      target.part("solo").setAttribute("fill", "red");
      return new ScriptedChange("a", "u");
    });
    expect(failure(() => new AttributeDispatcher([reachOut]).plan(n1, "fill", "red"))).toBe(
      "attribute handler failed: reach (solo is not in the subtree of composite#n1)",
    );
    expect(text()).toBe(before);
  });

  /** The error `plan` throws, which must be a programming error (not an `EditorError`). */
  function programmingError(run: () => unknown): string {
    try {
      run();
    } catch (error) {
      expect(error).toBeInstanceOf(Error);
      expect(error).not.toBeInstanceOf(EditorError);
      return (error as Error).message;
    }
    return "no error";
  }

  /** A handler that bypasses the interface to change the structure of `n1`, then runs `then`. */
  function cheat(change: (container: ContainerShape) => void, then: () => unknown): ScriptedHandler {
    return new ScriptedHandler("cheat", 0, onComposite("fill"), (target, _attribute, value) => {
      target.part("n1-a").setAttribute("fill", value);
      change(target.view() as unknown as ContainerShape);
      return then();
    });
  }

  const removeFirst = (container: ContainerShape) => container.remove(container.childList()[0] as FakeLeaf);
  const swapTwo = (container: ContainerShape) => {
    const first = container.childList()[0] as FakeLeaf;
    container.remove(first);
    container.insertAt(first, 1);
  };
  const echoes = () => new ScriptedChange("a", "u");
  const structure = "attribute handler cheat changed the structure of composite#n1";

  it("a handler that bypasses the interface to remove a part is a programming error, not an EditorError", () => {
    const { n1 } = fixture();
    expect(programmingError(() => new AttributeDispatcher([cheat(removeFirst, echoes)]).plan(n1, "fill", "red"))).toBe(structure);
  });

  it("only swapping two parts (same number of children) is a programming error too", () => {
    const { n1 } = fixture();
    expect(programmingError(() => new AttributeDispatcher([cheat(swapTwo, echoes)]).plan(n1, "fill", "red"))).toBe(structure);
    expect(n1.childList().map((child) => child.getId())).toEqual(["n1-b", "n1-a"]);
  });

  it("changing the structure, then throwing an EditorError, is still a programming error", () => {
    const { n1 } = fixture();
    const then = () => {
      throw new EditorError("invalid value for fill: red");
    };
    expect(programmingError(() => new AttributeDispatcher([cheat(swapTwo, then)]).plan(n1, "fill", "red"))).toBe(structure);
  });
});

describe("AttributeDispatcher: the planned edit", () => {
  it("one plan changing two parts: undo and redo each restore the whole subtree once; no plugin code runs again", () => {
    const { n1, text } = fixture();
    const original = text();
    const handler = new ScriptedHandler("h", 0, onComposite("fill"), fillBoth);
    const edit = new AttributeDispatcher([handler]).plan(n1, "fill", "red");
    if (edit === null) throw new Error("expected a planned edit");
    edit.redo();
    const changed = text();
    expect(changed).not.toBe(original);
    edit.undo();
    expect(text()).toBe(original);
    edit.redo();
    expect(text()).toBe(changed);
    expect(edit.appliedMessage()).toBe("composite#n1 fill red");
    expect(handler.calls()).toEqual({ handles: 1, apply: 1 });
  });

  it("a handler may target the shape itself and look parts up from any part", () => {
    const { n1, text } = fixture();
    const handler = new ScriptedHandler("h", 0, onComposite("stroke"), (target, _a, value) => {
      target.part("n1").setAttribute("stroke", value);
      target.part("n1-a").part("n1-b").setAttribute("stroke", value);
      return new ScriptedChange(`stroke ${target.part("n1-b").view().getId()}`, "u");
    });
    const edit = new AttributeDispatcher([handler]).plan(n1, "stroke", "blue");
    edit?.redo();
    expect(text()).toContain('<fake-group id="n1" stroke="blue">');
    expect(text()).toContain('<fake-leaf id="n1-b" px="0" py="0" stroke="blue"/>');
    expect(edit?.appliedMessage()).toBe("stroke n1-b");
  });
});

describe("EditableSubtree", () => {
  it("view() is the shape; part() finds the target itself and descendants only", () => {
    const { n1 } = fixture();
    const subtree = new EditableSubtree(n1);
    expect(subtree.view()).toBe(n1);
    expect(subtree.part("n1").view()).toBe(n1);
    expect(subtree.part("n1-b").view().getId()).toBe("n1-b");
    expect(() => subtree.part("solo")).toThrow("solo is not in the subtree of composite#n1");
    expect(() => subtree.part("missing")).toThrow("missing is not in the subtree of composite#n1");
    expect(() => subtree.part("solo")).not.toThrow(EditorError);
  });

  it("setAttribute goes through the whitelist; a rejected value changes nothing", () => {
    const { n1, text } = fixture();
    const before = text();
    const part = new EditableSubtree(n1).part("n1-a");
    expect(() => part.setAttribute("label", "x")).toThrow(EditorError);
    expect(() => part.setAttribute("fill", "")).toThrow(EditorError);
    expect(text()).toBe(before);
  });
});
