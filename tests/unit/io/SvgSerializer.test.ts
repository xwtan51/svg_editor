import { describe, expect, it } from "vitest";
import { SvgSerializer } from "../../../src/io/SvgSerializer.js";
import { CanvasSize } from "../../../src/model/CanvasSize.js";
import { Circle } from "../../../src/model/Circle.js";
import { Group } from "../../../src/model/Group.js";
import { Line } from "../../../src/model/Line.js";
import { Rect } from "../../../src/model/Rect.js";
import type { Shape } from "../../../src/model/Shape.js";
import { SvgDocument } from "../../../src/model/SvgDocument.js";
import { Text } from "../../../src/model/Text.js";
import { build } from "../model/build.js";

const DECLARATION = '<?xml version="1.0" encoding="UTF-8"?>';

/** The first example of spec §0.1, verbatim. */
const FLOW_SVG = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="400" height="200" viewBox="0 0 400 200">
  <g id="flow">
    <rect id="start" x="30" y="70" width="120" height="60" fill="#4a90d9"/>
    <line id="edge" x1="150" y1="100" x2="250" y2="100" stroke="black"/>
    <rect id="end" x="250" y="70" width="120" height="60" fill="#f5a623"/>
  </g>
</svg>
`;

function serialize(doc: SvgDocument): string {
  return new SvgSerializer().serialize(doc);
}

/** Lines of the output between the `<svg>` line and `</svg>`. */
function body(doc: SvgDocument): string[] {
  return serialize(doc).split("\n").slice(2, -2);
}

function append(doc: SvgDocument, ...shapes: Shape[]): void {
  for (const shape of shapes) {
    doc.insertAt(shape, doc.childList().length);
  }
}

describe("SvgSerializer", () => {
  it("reproduces the first example of §0.1 byte for byte", () => {
    // init 400 200, then create … in flow, as the spec describes.
    const doc = new SvgDocument(new CanvasSize(400, 200));
    const flow = new Group("flow");
    append(doc, flow);
    flow.insertAt(Rect.create("start", new Map([["x", "30"], ["y", "70"], ["width", "120"], ["height", "60"], ["fill", "#4a90d9"]])), 0);
    flow.insertAt(Line.create("edge", new Map([["x1", "150"], ["y1", "100"], ["x2", "250"], ["y2", "100"], ["stroke", "black"]])), 1);
    flow.insertAt(Rect.create("end", new Map([["x", "250"], ["y", "70"], ["width", "120"], ["height", "60"], ["fill", "#f5a623"]])), 2);

    expect(serialize(doc)).toBe(FLOW_SVG);
  });

  it("writes an empty group self-closed", () => {
    const doc = new SvgDocument();
    append(doc, new Group("x"));
    expect(body(doc)).toEqual(['  <g id="x"/>']);
  });

  it("nests groups with two spaces per level", () => {
    const doc = new SvgDocument();
    const outer = new Group("outer");
    const inner = new Group("inner");
    append(doc, outer);
    outer.insertAt(inner, 0);
    inner.insertAt(build(new Circle("c"), { r: "1" }), 0);
    expect(body(doc)).toEqual([
      '  <g id="outer">',
      '    <g id="inner">',
      '      <circle id="c" cx="0" cy="0" r="1"/>',
      "    </g>",
      "  </g>",
    ]);
  });

  it("writes text content inline and escapes & < > \" in content and attribute values", () => {
    const doc = new SvgDocument();
    append(doc, build(new Text("t1"), { x: "20", y: "40", text: 'a & b < c > d "e"', fill: 'url("#p")&<>' }));
    expect(body(doc)).toEqual([
      '  <text id="t1" x="20" y="40" fill="url(&quot;#p&quot;)&amp;&lt;&gt;">a &amp; b &lt; c &gt; d &quot;e&quot;</text>',
    ]);
  });

  it("escapes pass-through attribute values and ids too", () => {
    const doc = new SvgDocument();
    const g = new Group("a&b");
    g.addExtraAttribute("data-note", '<"x">');
    append(doc, g);
    expect(body(doc)).toEqual(['  <g id="a&amp;b" data-note="&lt;&quot;x&quot;&gt;"/>']);
  });

  it("self-closes a text with empty content", () => {
    const doc = new SvgDocument();
    append(doc, build(new Text("t"), { x: "1", y: "2", text: "" }));
    expect(body(doc)).toEqual(['  <text id="t" x="1" y="2"/>']);
  });

  it("makes viewBox follow the canvas size", () => {
    const doc = new SvgDocument(new CanvasSize(400, 200));
    doc.resize(new CanvasSize(1024, 768.5));
    expect(serialize(doc).split("\n")[1]).toBe(
      '<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="768.5" viewBox="0 0 1024 768.5"/>',
    );
  });

  it("writes an empty document as declaration plus a self-closed root and a final newline", () => {
    expect(serialize(new SvgDocument())).toBe(
      `${DECLARATION}\n<svg xmlns="http://www.w3.org/2000/svg" width="800" height="600" viewBox="0 0 800 600"/>\n`,
    );
  });

  it("orders attributes id → geometry → fill, stroke, stroke-width → pass-through in original order", () => {
    const doc = new SvgDocument();
    const rect = new Rect("r1");
    // set in a scrambled order: the output order must not depend on it
    build(rect, { "stroke-width": "2", height: "4", stroke: "blue", x: "1", fill: "red", width: "3", y: "2" });
    rect.addExtraAttribute("transform", "rotate(45)");
    rect.addExtraAttribute("data-z", "9");
    rect.addExtraAttribute("opacity", "0.5");
    append(doc, rect);
    expect(body(doc)).toEqual([
      '  <rect id="r1" x="1" y="2" width="3" height="4" fill="red" stroke="blue" stroke-width="2" transform="rotate(45)" data-z="9" opacity="0.5"/>',
    ]);
  });

  it("writes pass-through attributes of a group after its style, before its children", () => {
    const doc = new SvgDocument();
    const g = build(new Group("nodeB"), { fill: "white" });
    g.addExtraAttribute("transform", "translate(200,0) scale(0.8)");
    append(doc, g);
    g.insertAt(new Rect("r"), 0);
    expect(body(doc)).toEqual([
      '  <g id="nodeB" fill="white" transform="translate(200,0) scale(0.8)">',
      '    <rect id="r" x="0" y="0" width="0" height="0"/>',
      "  </g>",
    ]);
  });

  it("formats numbers with V3 (at most 6 decimals, no -0)", () => {
    const doc = new SvgDocument();
    const circle = build(new Circle("c"), { cx: "0.1", cy: "-0.0000001", r: "1e3" });
    circle.moveBy(0.2, 0);
    append(doc, circle);
    expect(body(doc)).toEqual(['  <circle id="c" cx="0.3" cy="0" r="1000"/>']);
  });
});
