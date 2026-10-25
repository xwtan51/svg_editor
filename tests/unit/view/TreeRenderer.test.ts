import { describe, expect, it } from "vitest";
import { CanvasSize } from "../../../src/model/CanvasSize.js";
import { Circle } from "../../../src/model/Circle.js";
import { Ellipse } from "../../../src/model/Ellipse.js";
import { Group } from "../../../src/model/Group.js";
import { Line } from "../../../src/model/Line.js";
import { Rect } from "../../../src/model/Rect.js";
import type { Shape } from "../../../src/model/Shape.js";
import type { ShapeContainer } from "../../../src/model/ShapeContainer.js";
import { SvgDocument } from "../../../src/model/SvgDocument.js";
import { Text } from "../../../src/model/Text.js";
import { TreeRenderer } from "../../../src/view/TreeRenderer.js";
import { build } from "../model/build.js";

function append(container: ShapeContainer, ...shapes: Shape[]): void {
  for (const shape of shapes) {
    container.insertAt(shape, container.childList().length);
  }
}

function rect(id: string, x: string, y: string, w: string, h: string, fill?: string): Rect {
  const shape = build(new Rect(id), { x, y, width: w, height: h });
  return fill === undefined ? shape : build(shape, { fill });
}

function circle(id: string, cx: string, cy: string, r: string, fill?: string): Circle {
  const shape = build(new Circle(id), { cx, cy, r });
  return fill === undefined ? shape : build(shape, { fill });
}

function text(id: string, x: string, y: string, content: string): Text {
  return build(new Text(id), { x, y, text: content });
}

function group(id: string, ...children: Shape[]): Group {
  const g = new Group(id);
  append(g, ...children);
  return g;
}

/** The document of §5.1 / the first `tree` of §6. */
function markersDocument(): { doc: SvgDocument; markers: Group; c1: Circle } {
  const doc = new SvgDocument(new CanvasSize(800, 600));
  const c1 = circle("c1", "100", "100", "20", "red");
  const markers = group("markers", c1, rect("box", "200", "80", "60", "60", "#3366ff"));
  append(doc, rect("bg", "0", "0", "800", "600", "#ffffff"), text("title", "20", "40", "My Diagram"), markers);
  return { doc, markers, c1 };
}

/** The document of §6.1 version A, built with `create … in …` as the transcript does. */
function flowchartDocument(): SvgDocument {
  const doc = new SvgDocument(new CanvasSize(800, 600));
  const node1 = group("node1", rect("start", "120", "100", "160", "60", "#4a90d9"), text("start-label", "155", "135", "开始"));
  const node2 = group(
    "node2",
    rect("process", "520", "100", "160", "60", "#f5a623"),
    text("process-label", "545", "135", "处理数据"),
  );
  const arrow = build(new Line("arrow1"), { x1: "280", y1: "130", x2: "520", y2: "130", stroke: "black" });
  append(doc, group("flowchart", node1, node2, arrow));
  return doc;
}

const renderer = new TreeRenderer();

describe("TreeRenderer: the examples of the spec", () => {
  it("§5.1 / §6 first tree, verbatim", () => {
    // Copied from doc/spec/phase_cli_1.md §5.1 (identical to the first `tree` in §6).
    const expected = [
      "svg (800x600)",
      "├── rect#bg        x=0 y=0 w=800 h=600 fill=#ffffff",
      '├── text#title     (20,40) "My Diagram"',
      "└── g#markers",
      "    ├── circle#c1  cx=100 cy=100 r=20 fill=red",
      "    └── rect#box   x=200 y=80 w=60 h=60 fill=#3366ff",
    ];
    expect(renderer.renderDocument(markersDocument().doc)).toEqual(expected);
  });

  it("§6 tree after `read other.svg`, verbatim", () => {
    // The tree other.svg imports into (rect1 is the id assigned by the importer).
    const doc = new SvgDocument(new CanvasSize(400, 300));
    append(
      doc,
      rect("rect1", "0", "0", "400", "300", "#ffffff"),
      text("t1", "10", "290", "imported"),
      circle("c1", "50", "50", "10"),
      group("g1", rect("r2", "0", "0", "10", "10"), circle("c2", "5", "5", "2")),
      build(new Ellipse("e1"), { cx: "1", cy: "2", rx: "3", ry: "4" }),
    );
    // Copied from doc/spec/phase_cli_1.md §6, the last `tree`.
    const expected = [
      "svg (400x300)",
      "├── rect#rect1     x=0 y=0 w=400 h=300 fill=#ffffff",
      '├── text#t1        (10,290) "imported"',
      "├── circle#c1      cx=50 cy=50 r=10",
      "├── g#g1",
      "│   ├── rect#r2    x=0 y=0 w=10 h=10",
      "│   └── circle#c2  cx=5 cy=5 r=2",
      "└── ellipse#e1     cx=1 cy=2 rx=3 ry=4",
    ];
    expect(renderer.renderDocument(doc)).toEqual(expected);
  });

  it("§6.1 version A: the spec's alignment is irregular; V1 puts every summary in column 32", () => {
    // The spec aligns rect#start / text#start-label at column 29, lets
    // text#process-label overflow it and puts line#arrow1 at 29 as well — no
    // single column reproduces it. By V1 the widest head is
    // "    │   └── text#process-label" (30), so every summary starts at 32.
    const expected = [
      "svg (800x600)",
      "└── g#flowchart",
      "    ├── g#node1",
      "    │   ├── rect#start          x=120 y=100 w=160 h=60 fill=#4a90d9",
      '    │   └── text#start-label    (155,135) "开始"',
      "    ├── g#node2",
      "    │   ├── rect#process        x=520 y=100 w=160 h=60 fill=#f5a623",
      '    │   └── text#process-label  (545,135) "处理数据"',
      "    └── line#arrow1             (280,130) -> (520,130)",
    ];
    const lines = renderer.renderDocument(flowchartDocument());
    expect(lines).toEqual(expected);
    // Every line with a summary (all but svg and the three g lines) has it at index 32.
    const withSummary = lines.slice(1).filter((l) => !l.includes("g#"));
    expect(withSummary).toHaveLength(5);
    for (const line of withSummary) {
      expect(line.charAt(31)).toBe(" ");
      expect(line.charAt(32)).not.toBe(" ");
    }
  });

  it("§4.4 `tree n1` with n1 as a plain g: V1 puts both summaries in column 18", () => {
    // box is not part of this phase, so the line reads `g#n1` without "(box)".
    // The spec separates rect#n1-rect by 2 spaces and text#n1-label by 1
    // (both at column 17); by V1 the widest head "└── text#n1-label" (16) + 2 = 18.
    const n1 = group("n1", rect("n1-rect", "120", "100", "160", "60", "#4a90d9"), text("n1-label", "140", "135", "开始"));
    append(new SvgDocument(), n1);
    expect(renderer.renderSubtree(n1)).toEqual([
      "g#n1",
      "├── rect#n1-rect   x=120 y=100 w=160 h=60 fill=#4a90d9",
      '└── text#n1-label  (140,135) "开始"',
    ]);
  });
});

describe("TreeRenderer: V1 alignment", () => {
  it("column = widest prefix + label + 2, shared by all depths", () => {
    const doc = new SvgDocument();
    append(doc, rect("a", "1", "2", "3", "4"), group("g", circle("long-circle-id", "5", "6", "7")));
    expect(renderer.renderDocument(doc)).toEqual([
      "svg (800x600)",
      "├── rect#a                     x=1 y=2 w=3 h=4",
      "└── g#g",
      "    └── circle#long-circle-id  cx=5 cy=6 r=7",
    ]);
  });

  it("g lines are not padded, but a long g label still widens the column", () => {
    const doc = new SvgDocument();
    append(doc, group("a-very-long-group-name"), rect("r", "0", "0", "1", "1"));
    const lines = renderer.renderDocument(doc);
    expect(lines).toEqual(["svg (800x600)", "├── g#a-very-long-group-name", "└── rect#r                    x=0 y=0 w=1 h=1"]);
    expect(lines[1]).not.toMatch(/ $/);
  });

  it("the `svg (…)` line takes no part in the alignment", () => {
    const doc = new SvgDocument(new CanvasSize(1024, 768));
    append(doc, rect("r", "0", "0", "1", "1"));
    expect(renderer.renderDocument(doc)).toEqual(["svg (1024x768)", "└── rect#r  x=0 y=0 w=1 h=1"]);
  });

  it("uses │ under a non-last branch and blanks under a last one, at any depth", () => {
    const doc = new SvgDocument();
    append(doc, group("a", group("b", rect("r", "0", "0", "1", "1")), rect("s", "0", "0", "1", "1")), group("c", group("d")));
    expect(renderer.renderDocument(doc)).toEqual([
      "svg (800x600)",
      "├── g#a",
      "│   ├── g#b",
      "│   │   └── rect#r  x=0 y=0 w=1 h=1",
      "│   └── rect#s      x=0 y=0 w=1 h=1",
      "└── g#c",
      "    └── g#d",
    ]);
  });
});

describe("TreeRenderer: tree <id> (V4) and the empty document (V5)", () => {
  it("starts at the subtree root, which has no connector", () => {
    const { markers } = markersDocument();
    expect(renderer.renderSubtree(markers)).toEqual([
      "g#markers",
      "├── circle#c1  cx=100 cy=100 r=20 fill=red",
      "└── rect#box   x=200 y=80 w=60 h=60 fill=#3366ff",
    ]);
  });

  it("indents deeper levels from the subtree root, not from the document", () => {
    const inner = group("inner", rect("r", "0", "0", "1", "1"));
    const outer = group("outer", inner, circle("c", "0", "0", "1"));
    append(new SvgDocument(), group("top", outer));
    expect(renderer.renderSubtree(outer)).toEqual([
      "g#outer",
      "├── g#inner",
      "│   └── rect#r  x=0 y=0 w=1 h=1",
      "└── circle#c    cx=0 cy=0 r=1",
    ]);
  });

  it("a leaf gives one line: label, two spaces, summary", () => {
    const { c1 } = markersDocument();
    expect(renderer.renderSubtree(c1)).toEqual(["circle#c1  cx=100 cy=100 r=20 fill=red"]);
  });

  it("an empty group gives its label only", () => {
    const g = new Group("empty");
    append(new SvgDocument(), g);
    expect(renderer.renderSubtree(g)).toEqual(["g#empty"]);
  });

  it("an empty document gives `svg (800x600)` only", () => {
    expect(renderer.renderDocument(new SvgDocument())).toEqual(["svg (800x600)"]);
  });
});
