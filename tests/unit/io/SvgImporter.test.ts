import { afterEach, describe, expect, it, vi } from "vitest";
import type { ImportResult } from "../../../src/io/ImportResult.js";
import { SvgImporter } from "../../../src/io/SvgImporter.js";
import { SvgSerializer } from "../../../src/io/SvgSerializer.js";
import { CanvasSize } from "../../../src/model/CanvasSize.js";
import { EditorError } from "../../../src/model/EditorError.js";
import type { Shape } from "../../../src/model/Shape.js";
import { SvgDocument } from "../../../src/model/SvgDocument.js";
import { Text } from "../../../src/model/Text.js";
import { build } from "../model/build.js";
import { MemoryFileSystem } from "./MemoryFileSystem.js";

/** `other.svg` of spec §6, verbatim. */
const OTHER_SVG = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="400" height="300" viewBox="0 0 400 300">
  <rect x="0" y="0" width="400" height="300" fill="#ffffff"/>
  <text id="t1" x="10" y="290">imported</text>
  <circle id="c1" cx="50" cy="50" r="10"/>
  <g id="g1">
    <rect id="r2" x="0" y="0" width="10" height="10"/>
    <circle id="c2" cx="5" cy="5" r="2"/>
  </g>
  <ellipse id="e1" cx="1" cy="2" rx="3" ry="4"/>
</svg>
`;

/** The second example of spec §0.1, verbatim (comments included). */
const DIAGRAM_SVG = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="400" height="200" viewBox="0 0 400 200">
  <!-- 外层 <g>：一次性把整组向右下平移 (60,40)，子元素坐标无需修改 -->
  <g id="diagram" transform="translate(60,40)">
    <rect id="a" x="0" y="0" width="120" height="60" fill="#4a90d9"/>
    <line id="e" x1="120" y1="30" x2="200" y2="30" stroke="black"/>
    <!-- 嵌套 <g>：只把右端节点整体缩小并平移 -->
    <g id="nodeB" transform="translate(200,0) scale(0.8)">
      <rect x="0" y="0" width="120" height="60" fill="#f5a623"/>
      <text x="60" y="38" text-anchor="middle" font-size="16" fill="white">End</text>
    </g>
  </g>
</svg>
`;

function read(text: string, path = "in.svg"): ImportResult {
  return new SvgImporter().read(new MemoryFileSystem({ [path]: text }), path);
}

/** An `<svg>` file around `body` with an explicit canvas size. */
function svg(body: string): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100">${body}</svg>`;
}

function shape(result: ImportResult, id: string): Shape {
  const found = result.document().findById(id);
  if (found === null) {
    throw new Error(`no shape ${id}`);
  }
  return found;
}

/** Structure and every attribute, one line per shape, indented by depth. */
function dump(doc: SvgDocument): string[] {
  const lines = [`svg ${doc.canvasSize().toString()}`];
  const visit = (shapes: readonly Shape[], depth: number): void => {
    for (const s of shapes) {
      const attributes = s.svgAttributes().map(([k, v]) => `${k}=${JSON.stringify(v)}`).join(" ");
      lines.push(`${"  ".repeat(depth)}${s.tagName()} ${attributes} text=${JSON.stringify(s.textContent())}`);
      visit(s.asContainer()?.childList() ?? [], depth + 1);
    }
  };
  visit(doc.childList(), 1);
  return lines;
}

function serialize(doc: SvgDocument): string {
  return new SvgSerializer().serialize(doc);
}

/** The exact `EditorError` message thrown by `action`. */
function errorOf(action: () => unknown): string {
  try {
    action();
  } catch (error) {
    expect(error).toBeInstanceOf(EditorError);
    return (error as EditorError).message;
  }
  throw new Error("expected an EditorError");
}

function expectParseError(text: string, message: string): void {
  expect(errorOf(() => read(text, "bad.svg"))).toBe(message);
}

describe("SvgImporter: spec examples", () => {
  it("reads other.svg of §6: one id warning, 7 elements, the tree of §6", () => {
    const result = read(OTHER_SVG, "other.svg");
    const doc = result.document();

    expect(result.warnings()).toEqual(["warning: assigned id rect1 to unnamed <rect>"]);
    expect(doc.elementCount()).toBe(7);
    expect(doc.canvasSize().toString()).toBe("400x300");
    expect(doc.allShapes().map((s) => [s.label(), s.summary()])).toEqual([
      ["rect#rect1", "x=0 y=0 w=400 h=300 fill=#ffffff"],
      ["text#t1", '(10,290) "imported"'],
      ["circle#c1", "cx=50 cy=50 r=10"],
      ["g#g1", ""],
      ["rect#r2", "x=0 y=0 w=10 h=10"],
      ["circle#c2", "cx=5 cy=5 r=2"],
      ["ellipse#e1", "cx=1 cy=2 rx=3 ry=4"],
    ]);
    expect(shape(result, "r2").parentContainer()).toBe(shape(result, "g1"));
    expect(doc.childList().map((s) => s.getId())).toEqual(["rect1", "t1", "c1", "g1", "e1"]);
  });

  it("reads other.svg of §6 preceded by a UTF-8 byte order mark", () => {
    const plain = read(OTHER_SVG, "other.svg");
    const withBom = read(`\uFEFF${OTHER_SVG}`, "other.svg");
    expect(withBom.warnings()).toEqual(["warning: assigned id rect1 to unnamed <rect>"]);
    expect(withBom.document().elementCount()).toBe(7);
    expect(dump(withBom.document())).toEqual(dump(plain.document()));
  });

  it("reads the second example of §0.1: ids for the unnamed rect and text, pass-through kept", () => {
    const result = read(DIAGRAM_SVG);

    expect(result.warnings()).toEqual([
      "warning: assigned id rect1 to unnamed <rect>",
      "warning: assigned id text1 to unnamed <text>",
    ]);
    expect(shape(result, "diagram").extraEntries()).toEqual([["transform", "translate(60,40)"]]);
    expect(shape(result, "nodeB").extraEntries()).toEqual([["transform", "translate(200,0) scale(0.8)"]]);
    const text = shape(result, "text1");
    expect(text.parentContainer()).toBe(shape(result, "nodeB"));
    expect(text.textContent()).toBe("End");
    expect(text.styleEntries()).toEqual([["fill", "white"]]);
    expect(text.extraEntries()).toEqual([
      ["text-anchor", "middle"],
      ["font-size", "16"],
    ]);

    // Comments are dropped; fill moves to its F18 slot before the pass-through attributes.
    expect(serialize(result.document())).toBe(`<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="400" height="200" viewBox="0 0 400 200">
  <g id="diagram" transform="translate(60,40)">
    <rect id="a" x="0" y="0" width="120" height="60" fill="#4a90d9"/>
    <line id="e" x1="120" y1="30" x2="200" y2="30" stroke="black"/>
    <g id="nodeB" transform="translate(200,0) scale(0.8)">
      <rect id="rect1" x="0" y="0" width="120" height="60" fill="#f5a623"/>
      <text id="text1" x="60" y="38" fill="white" text-anchor="middle" font-size="16">End</text>
    </g>
  </g>
</svg>
`);
  });
});

describe("SvgImporter: ids (F13, F14, F16)", () => {
  it("F13: skips an id that an explicit element later in the file already uses", () => {
    const result = read(svg('<rect/><g id="g"><rect id="rect1"/></g><rect/>'));
    expect(result.warnings()).toEqual([
      "warning: assigned id rect2 to unnamed <rect>",
      "warning: assigned id rect3 to unnamed <rect>",
    ]);
    expect(result.document().allShapes().map((s) => s.getId())).toEqual(["rect2", "g", "rect1", "rect3"]);
  });

  it("F13: numbers each tag separately, starting at 1", () => {
    const result = read(svg("<circle/><rect/><circle/>"));
    expect(result.document().allShapes().map((s) => s.getId())).toEqual(["circle1", "rect1", "circle2"]);
  });

  it("F13: also reserves ids found on skipped unsupported elements", () => {
    const result = read(svg('<path id="rect1"/><rect/>'));
    expect(result.document().allShapes().map((s) => s.getId())).toEqual(["rect2"]);
  });

  it("F14: the first holder keeps a duplicate id, later ones are reassigned with a warning", () => {
    const result = read(svg('<rect id="r1"/><g id="g"><circle id="r1"/></g><rect id="r1"/>'));
    expect(result.warnings()).toEqual([
      "warning: duplicate id r1, reassigned to circle1",
      "warning: duplicate id r1, reassigned to rect1",
    ]);
    expect(result.document().allShapes().map((s) => s.label())).toEqual(["rect#r1", "g#g", "circle#circle1", "rect#rect1"]);
  });

  it("F16: an empty id counts as missing; other ids are taken as they are", () => {
    const result = read(svg('<rect id=""/><rect id="1 odd"/>'));
    expect(result.warnings()).toEqual(["warning: assigned id rect1 to unnamed <rect>"]);
    expect(result.document().allShapes().map((s) => s.getId())).toEqual(["rect1", "1 odd"]);
  });
});

describe("SvgImporter: unsupported content (F6, F15)", () => {
  it("F6: skips <path> together with its subtree, with one warning", () => {
    const result = read(svg('<path id="p" d="M0 0"><rect id="inner"/></path><rect id="r"/>'));
    expect(result.warnings()).toEqual(["warning: skipped unsupported element <path>"]);
    expect(result.document().elementCount()).toBe(1);
    expect(result.document().findById("inner")).toBeNull();
    expect(result.document().findById("p")).toBeNull();
  });

  it("F6: skipped elements nested in a group do not count and leave no unnamed-id warning", () => {
    const result = read(svg('<g id="g"><defs><rect/></defs><title>t</title><circle id="c"/></g>'));
    expect(result.warnings()).toEqual([
      "warning: skipped unsupported element <defs>",
      "warning: skipped unsupported element <title>",
    ]);
    expect(result.document().allShapes().map((s) => s.label())).toEqual(["g#g", "circle#c"]);
  });

  it("F6: child elements of a leaf without content are skipped", () => {
    const result = read(svg('<rect id="r"><title>x</title></rect>'));
    expect(result.warnings()).toEqual(["warning: skipped unsupported element <title>"]);
    expect(shape(result, "r").summary()).toBe("x=0 y=0 w=0 h=0");
  });

  it("F15: text content is all character data, trimmed; child elements are flattened with a warning", () => {
    const result = read(svg('<text id="t1">\n   Hello <tspan>big <tspan>wide</tspan></tspan> &amp; <![CDATA[<world>]]>\n</text>'));
    expect(result.warnings()).toEqual(["warning: flattened <tspan> in text#t1"]);
    expect(shape(result, "t1").textContent()).toBe("Hello big wide & <world>");
  });

  it("F15: an element without content reads as empty text", () => {
    expect(shape(read(svg('<text id="t"/>')), "t").textContent()).toBe("");
  });

  it("F15 known limitation: leading and trailing spaces of text content are lost on save → read", () => {
    const doc = new SvgDocument();
    doc.insertAt(build(new Text("t"), { x: "0", y: "0", text: "  a  " }), 0);
    const saved = serialize(doc);
    expect(saved).toContain(">  a  </text>");
    expect(shape(read(saved), "t").textContent()).toBe("a");
  });
});

describe("SvgImporter: attributes (F7, F12)", () => {
  it("F7: keeps pass-through attributes in document order, separated from whitelisted ones", () => {
    const result = read(
      svg('<circle data-a="1" id="c" r="5" xlink:href="#x" stroke="red" style="opacity:.5" cx="1" xmlns:xlink="http://www.w3.org/1999/xlink"/>'),
    );
    const c = shape(result, "c");
    expect(c.geometryEntries()).toEqual([["cx", "1"], ["cy", "0"], ["r", "5"]]);
    expect(c.styleEntries()).toEqual([["stroke", "red"]]);
    expect(c.extraEntries()).toEqual([
      ["data-a", "1"],
      ["xlink:href", "#x"],
      ["style", "opacity:.5"],
      ["xmlns:xlink", "http://www.w3.org/1999/xlink"],
    ]);
  });

  it("F7: an attribute that is geometry for one type is pass-through for another", () => {
    const result = read(svg('<g id="g" x="5" fill="blue"/><line id="l" width="3" fill="none" stroke-width="2"/>'));
    expect(shape(result, "g").extraEntries()).toEqual([["x", "5"]]);
    expect(shape(result, "g").styleEntries()).toEqual([["fill", "blue"]]);
    expect(shape(result, "l").extraEntries()).toEqual([["width", "3"]]);
    expect(shape(result, "l").styleEntries()).toEqual([["fill", "none"], ["stroke-width", "2"]]);
  });

  it("F12: missing geometry defaults to 0", () => {
    expect(shape(read(svg('<ellipse id="e" rx="3"/>')), "e").summary()).toBe("cx=0 cy=0 rx=3 ry=0");
  });

  it.each([
    ['<rect id="r" width="50%"/>', 'invalid value width="50%" on <rect>'],
    ['<circle id="c" r="-1"/>', 'invalid value r="-1" on <circle>'],
    ['<line id="l" x1="1e999"/>', 'invalid value x1="1e999" on <line>'],
    ['<rect id="r" stroke-width="-2"/>', 'invalid value stroke-width="-2" on <rect>'],
    ['<g id="g"><rect id="r" fill=""/></g>', 'invalid value fill="" on <rect>'],
  ])("F12: %s → cannot parse file with the offending attribute", (body, detail) => {
    expectParseError(svg(body), `cannot parse file: bad.svg (${detail})`);
  });
});

describe("SvgImporter: namespace prefixes of pass-through attributes", () => {
  const INKSCAPE = "http://www.inkscape.org/namespaces/inkscape";

  it("copies a prefix declared on the dropped root onto the element that uses it, so the saved file parses", () => {
    const result = read(
      `<svg xmlns="http://www.w3.org/2000/svg" xmlns:inkscape="${INKSCAPE}" width="10" height="10">` +
        '<g id="layer1" data-x="1" inkscape:label="Layer 1" inkscape:groupmode="layer"/></svg>',
    );
    expect(shape(result, "layer1").extraEntries()).toEqual([
      ["data-x", "1"],
      ["xmlns:inkscape", INKSCAPE],
      ["inkscape:label", "Layer 1"],
      ["inkscape:groupmode", "layer"],
    ]);
    const saved = serialize(result.document());
    const again = read(saved);
    expect(dump(again.document())).toEqual(dump(result.document()));
    expect(serialize(again.document())).toBe(saved);
  });

  it("adds nothing when the element declares the prefix itself, or for xml:", () => {
    const result = read(svg(`<rect id="r" inkscape:label="x" xmlns:inkscape="${INKSCAPE}" xml:space="preserve"/>`));
    expect(shape(result, "r").extraEntries()).toEqual([
      ["inkscape:label", "x"],
      ["xmlns:inkscape", INKSCAPE],
      ["xml:space", "preserve"],
    ]);
  });
});

describe("SvgImporter: canvas size (F10)", () => {
  const sizeOf = (attributes: string) => read(`<svg ${attributes}/>`).document().canvasSize().toString();

  it("takes width / height, allowing a px suffix and surrounding space", () => {
    expect(sizeOf('width="400px" height=" 300.5 "')).toBe("400x300.5");
  });

  it("falls back to the viewBox size per missing dimension", () => {
    expect(sizeOf('viewBox="10 20 640 480"')).toBe("640x480");
    expect(sizeOf('width="100" viewBox="0,0,640,480"')).toBe("100x480");
  });

  it("ignores a different viewBox when width and height are present", () => {
    expect(sizeOf('width="100" height="50" viewBox="0 0 1 1"')).toBe("100x50");
  });

  it("uses 800x600 with a warning when no size is given", () => {
    const result = read("<svg><rect/></svg>");
    expect(result.document().canvasSize()).toBe(CanvasSize.DEFAULT);
    expect(result.warnings()).toEqual([
      "warning: missing canvas size, using 800x600",
      "warning: assigned id rect1 to unnamed <rect>",
    ]);
  });

  it.each([
    ['width="50%" height="10"', 'invalid value width="50%" on <svg>'],
    ['width="10mm" height="10"', 'invalid value width="10mm" on <svg>'],
    ['width="10" viewBox="0 0 10"', 'invalid value viewBox="0 0 10" on <svg>'],
    ['width="0" height="10"', "canvas size must be positive"],
  ])("rejects %s", (attributes, detail) => {
    expectParseError(`<svg ${attributes}/>`, `cannot parse file: bad.svg (${detail})`);
  });
});

describe("SvgImporter: failures (F9)", () => {
  const consoleMethods = ["log", "info", "warn", "error", "debug", "trace"] as const;

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it.each([
    ["unclosed tag", "<svg><rect></svg>"],
    ["mismatched tag", "<svg></g>"],
    ["not XML at all", "hello"],
    ["empty file", ""],
    ["undefined entity", "<svg>&nbsp;</svg>"],
    ["content after the root", "<svg/><svg/>"],
    ["root is not svg", '<html xmlns="http://www.w3.org/2000/svg"><rect id="r"/></html>'],
    ["root is a prefixed non-svg", '<x:g xmlns:x="http://www.w3.org/2000/svg"/>'],
  ])("%s → cannot parse file: <path>, and nothing is printed", (_name, text) => {
    const spies = consoleMethods.map((method) => vi.spyOn(console, method).mockImplementation(() => {}));
    expect(errorOf(() => read(text, "bad.svg"))).toBe("cannot parse file: bad.svg");
    for (const spy of spies) {
      expect(spy).not.toHaveBeenCalled();
    }
  });

  it("a missing file → cannot read file: <path>", () => {
    expect(errorOf(() => new SvgImporter().read(new MemoryFileSystem(), "nope.svg"))).toBe("cannot read file: nope.svg");
  });

  it("accepts a root svg element with a namespace prefix", () => {
    const result = read('<s:svg xmlns:s="http://www.w3.org/2000/svg" width="1" height="2"><s:rect id="r"/></s:svg>');
    expect(result.document().allShapes().map((s) => s.label())).toEqual(["rect#r"]);
  });
});

describe("SvgImporter: round trip", () => {
  /** Every supported type, nesting, style, pass-through, escapes, non-integer numbers, no edge spaces in text. */
  const RICH_SVG = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE svg>
<svg xmlns="http://www.w3.org/2000/svg" width="640.5" height="480" viewBox="0 0 1 1" version="1.1">
  <title>ignored</title>
  <rect id="bg" x="0" y="0" width="640.5" height="480" fill="#fff" stroke="black" stroke-width="0.25" rx="4"/>
  <g id="outer" transform="translate(10,10)" fill="red" data-kind="box">
    <circle id="c" cx="1.125" cy="-2" r="3" opacity="0.5"/>
    <g id="inner" stroke="blue">
      <ellipse id="e" cx="1" cy="2" rx="3" ry="4" style="fill: none"/>
      <line x1="0" y1="0" x2="1e2" y2=".5" stroke="green"/>
      <g id="empty"/>
    </g>
    <text id="t" x="5" y="6" font-size="12" text-anchor="end">Tom &amp; "Jerry" &lt;3 中文</text>
  </g>
  <text id="blank" x="0" y="0"></text>
  <path d="M0 0"/>
</svg>
`;

  it("read → save → read gives the same structure and attributes, and the same file again", () => {
    const first = read(RICH_SVG);
    const saved = serialize(first.document());
    const second = read(saved);

    expect(second.warnings()).toEqual([]);
    expect(dump(second.document())).toEqual(dump(first.document()));
    expect(serialize(second.document())).toBe(saved);
    // spot checks that the dump really carries the data
    expect(dump(first.document())).toContain(
      '    text id="t" x="5" y="6" font-size="12" text-anchor="end" text="Tom & \\"Jerry\\" <3 中文"',
    );
    expect(first.warnings()).toEqual([
      "warning: skipped unsupported element <title>",
      "warning: assigned id line1 to unnamed <line>",
      "warning: skipped unsupported element <path>",
    ]);
  });

  it("round-trips the §6 other.svg and the §0.1 diagram", () => {
    for (const text of [OTHER_SVG, DIAGRAM_SVG]) {
      const first = read(text);
      const second = read(serialize(first.document()));
      expect(second.warnings()).toEqual([]);
      expect(dump(second.document())).toEqual(dump(first.document()));
    }
  });
});
