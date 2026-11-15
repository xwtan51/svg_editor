import { describe, expect, it } from "vitest";
import { CanvasSize } from "../../src/model/CanvasSize.js";
import { EditorError } from "../../src/model/EditorError.js";
import { SvgDocument } from "../../src/model/SvgDocument.js";
import type { TreeRowView } from "../../src/view/TreeRowView.js";
import { TreeRenderer } from "../../src/view/TreeRenderer.js";
import { FakeContainer } from "../doubles/FakeContainer.js";
import { FakeLeaf } from "../doubles/FakeLeaf.js";
import { ScriptedDecorator } from "../doubles/ScriptedDecorator.js";

/**
 * Tree decorators in `TreeRenderer` (design §2.3): asked on the root line,
 * the first line of `tree <id>` and every shape line, in registration order;
 * non-empty tags appended after one space, after the alignment; breaches →
 * `tree decorator failed`, no line at all.
 */
function sample(): { doc: SvgDocument; group: FakeContainer } {
  const doc = new SvgDocument(new CanvasSize(300, 200));
  const group = new FakeContainer("g1", "composite");
  const a = new FakeLeaf("a");
  const longer = new FakeLeaf("longer-id");
  doc.insertAt(group, 0);
  doc.insertAt(longer, 1);
  group.insertAt(a, 0);
  return { doc, group };
}

const PLAIN = ["svg (300x200)", "├── fake-group#g1", "│   └── fake-leaf#a      px=0 py=0", "└── fake-leaf#longer-id  px=0 py=0"];

const byId = (tags: Record<string, string>) => (row: TreeRowView) => tags[row.shape()?.getId() ?? "(root)"] ?? null;

describe("TreeRenderer with decorators: output", () => {
  it("without decorators the output is byte-for-byte the plain tree", () => {
    const { doc, group } = sample();
    expect(new TreeRenderer([]).renderDocument(doc)).toEqual(PLAIN);
    expect(new TreeRenderer().renderDocument(doc)).toEqual(PLAIN);
    expect(new TreeRenderer().renderSubtree(group, doc)).toEqual(["fake-group#g1", "└── fake-leaf#a  px=0 py=0"]);
  });

  it("decorators answering null or \"\" everywhere change nothing, not even a trailing space", () => {
    const { doc, group } = sample();
    const silent = new TreeRenderer([new ScriptedDecorator("none", () => null), new ScriptedDecorator("empty", () => "")]);
    expect(silent.renderDocument(doc)).toEqual(PLAIN);
    expect(silent.renderSubtree(group, doc)).toEqual(["fake-group#g1", "└── fake-leaf#a  px=0 py=0"]);
  });

  it("a single decorator: the tag after one space, on a line with or without summary and on the root line", () => {
    const { doc } = sample();
    const renderer = new TreeRenderer([new ScriptedDecorator("t", byId({ "(root)": "*", g1: "(composite)", a: "*" }))]);
    expect(renderer.renderDocument(doc)).toEqual([
      "svg (300x200) *",
      "├── fake-group#g1 (composite)",
      "│   └── fake-leaf#a      px=0 py=0 *",
      "└── fake-leaf#longer-id  px=0 py=0",
    ]);
  });

  it("two decorators: tags in registration order; an empty one in between leaves no extra space", () => {
    const { doc } = sample();
    const renderer = new TreeRenderer([
      new ScriptedDecorator("first", byId({ g1: "(composite)" })),
      new ScriptedDecorator("middle", () => ""),
      new ScriptedDecorator("second", byId({ g1: "*", "(root)": "*" })),
    ]);
    const lines = renderer.renderDocument(doc);
    expect(lines[0]).toBe("svg (300x200) *");
    expect(lines[1]).toBe("├── fake-group#g1 (composite) *");
    const swapped = new TreeRenderer([new ScriptedDecorator("second", byId({ g1: "*" })), new ScriptedDecorator("first", byId({ g1: "(composite)" }))]);
    expect(swapped.renderDocument(doc)[1]).toBe("├── fake-group#g1 * (composite)");
  });

  it("tags take no part in the column: a long tag moves no summary", () => {
    const { doc } = sample();
    const renderer = new TreeRenderer([new ScriptedDecorator("long", byId({ a: "(a-very-very-very-long-tag)" }))]);
    expect(renderer.renderDocument(doc)).toEqual([
      "svg (300x200)",
      "├── fake-group#g1",
      "│   └── fake-leaf#a      px=0 py=0 (a-very-very-very-long-tag)",
      "└── fake-leaf#longer-id  px=0 py=0",
    ]);
  });

  it("tree <id>: the first line (no connector) is asked as a shape line; there is no root line", () => {
    const { doc, group } = sample();
    const renderer = new TreeRenderer([new ScriptedDecorator("t", byId({ "(root)": "ROOT", g1: "(composite)", a: "*" }))]);
    expect(renderer.renderSubtree(group, doc)).toEqual(["fake-group#g1 (composite)", "└── fake-leaf#a  px=0 py=0 *"]);
  });
});

describe("TreeRenderer with decorators: what each decorator sees", () => {
  it("every line is asked of every decorator, in line order then registration order, with the right row", () => {
    const { doc, group } = sample();
    const asked: string[] = [];
    const record = (name: string) => (row: TreeRowView) => {
      asked.push(`${name}:${row.isDocumentRoot() ? "root" : (row.shape()?.getId() ?? "?")}:${row.document() === doc}`);
      return null;
    };
    const renderer = new TreeRenderer([new ScriptedDecorator("x", record("x")), new ScriptedDecorator("y", record("y"))]);
    renderer.renderDocument(doc);
    expect(asked).toEqual(["x:root:true", "y:root:true", "x:g1:true", "y:g1:true", "x:a:true", "y:a:true", "x:longer-id:true", "y:longer-id:true"]);
    asked.length = 0;
    renderer.renderSubtree(group, doc);
    expect(asked).toEqual(["x:g1:true", "y:g1:true", "x:a:true", "y:a:true"]);
  });

  it("the root row has no shape; a shape row's shape is the read-only view of that shape", () => {
    const { doc, group } = sample();
    const rows: TreeRowView[] = [];
    new TreeRenderer([new ScriptedDecorator("x", (row) => (rows.push(row), null))]).renderDocument(doc);
    expect(rows[0]?.shape()).toBeNull();
    expect(rows[1]?.isDocumentRoot()).toBe(false);
    expect(rows[1]?.shape()?.kindName()).toBe("composite");
    expect(rows[1]?.shape()).toBe(group);
  });
});

describe("TreeRenderer with decorators: breaches → tree decorator failed, no line", () => {
  function failure(tag: (row: TreeRowView) => unknown): string {
    const { doc } = sample();
    const renderer = new TreeRenderer([new ScriptedDecorator("ok", () => "fine"), new ScriptedDecorator("bad", tag)]);
    try {
      renderer.renderDocument(doc);
    } catch (error) {
      expect(error).toBeInstanceOf(EditorError);
      return (error as Error).message;
    }
    return "no error";
  }

  it.each([
    ["throws an Error (first line of its message)", () => { throw new Error("broken\nsecond line"); }, "broken"],
    ["throws an EditorError", () => { throw new EditorError("nope"); }, "nope"],
    ["throws a non-Error", () => { throw "plain string"; }, "plain string"],
    ["answers undefined", () => undefined, "tag must be a string or null"],
    ["answers a number", () => 7, "tag must be a string or null"],
    ["answers a line break", () => "a\nb", "tag must be a single line"],
    ["answers a carriage return", () => "a\rb", "tag must be a single line"],
    ["answers a leading space", () => " *", "tag must not start or end with white space"],
    ["answers a trailing tab", () => "*\t", "tag must not start or end with white space"],
    ["answers only white space", () => "  ", "tag must not start or end with white space"],
  ])("%s", (_name, tag, reason) => {
    expect(failure(tag)).toBe(`tree decorator failed: bad (${reason})`);
  });

  it("a breach on a later line still prints nothing (renderSubtree too)", () => {
    const { doc, group } = sample();
    const late = new ScriptedDecorator("late", (row) => (row.shape()?.getId() === "a" ? 1 : null));
    expect(() => new TreeRenderer([late]).renderDocument(doc)).toThrow("tree decorator failed: late (tag must be a string or null)");
    expect(() => new TreeRenderer([late]).renderSubtree(group, doc)).toThrow("tree decorator failed: late (tag must be a string or null)");
  });

  it("a tag with inner spaces is fine", () => {
    const { doc } = sample();
    expect(new TreeRenderer([new ScriptedDecorator("t", byId({ "(root)": "(two words)" }))]).renderDocument(doc)[0]).toBe(
      "svg (300x200) (two words)",
    );
  });
});
