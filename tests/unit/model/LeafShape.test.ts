import { describe, expect, it } from "vitest";
import { Circle } from "../../../src/model/Circle.js";
import { EditorError } from "../../../src/model/EditorError.js";
import { Ellipse } from "../../../src/model/Ellipse.js";
import { Line } from "../../../src/model/Line.js";
import { Rect } from "../../../src/model/Rect.js";
import type { Shape } from "../../../src/model/Shape.js";
import { Text } from "../../../src/model/Text.js";
import { build } from "./build.js";

describe("leaf tagName and label (V8)", () => {
  it.each([
    [new Rect("r1"), "rect", "rect#r1"],
    [new Circle("c1"), "circle", "circle#c1"],
    [new Ellipse("e1"), "ellipse", "ellipse#e1"],
    [new Line("l1"), "line", "line#l1"],
    [new Text("t1"), "text", "text#t1"],
  ])("%#: %s", (shape: Shape, tag, label) => {
    expect(shape.tagName()).toBe(tag);
    expect(shape.label()).toBe(label);
    expect(shape.getId()).toBe(label.split("#")[1]);
  });
});

describe("geometry defaults to 0 (F12)", () => {
  it("rect", () => {
    expect(new Rect("r").geometryEntries()).toEqual([
      ["x", "0"],
      ["y", "0"],
      ["width", "0"],
      ["height", "0"],
    ]);
  });
});

describe("moveBy on leaves: positions follow (dx, dy), extents do not", () => {
  it("rect", () => {
    const r = build(new Rect("r"), { x: "10", y: "20", width: "100", height: "50" });
    r.moveBy(5, -7);
    expect(r.geometryEntries()).toEqual([
      ["x", "15"],
      ["y", "13"],
      ["width", "100"],
      ["height", "50"],
    ]);
  });

  it("circle and ellipse", () => {
    const c = build(new Circle("c"), { cx: "100", cy: "100", r: "20" });
    const e = build(new Ellipse("e"), { cx: "1", cy: "2", rx: "3", ry: "4" });
    c.moveBy(30, 0);
    e.moveBy(-1, 1);
    expect(c.summary()).toBe("cx=130 cy=100 r=20");
    expect(e.summary()).toBe("cx=0 cy=3 rx=3 ry=4");
  });

  it("line moves both end points", () => {
    const l = build(new Line("l"), { x1: "0", y1: "0", x2: "10", y2: "20" });
    l.moveBy(1, 2);
    expect(l.summary()).toBe("(1,2) -> (11,22)");
  });

  it("text keeps its content", () => {
    const t = build(new Text("t"), { x: "20", y: "40", text: "hi" });
    t.moveBy(0, 10);
    expect(t.summary()).toBe('(20,50) "hi"');
  });
});

describe("scaleBy on leaves: every geometry attribute times factor, style untouched (E12)", () => {
  it("rect", () => {
    const r = build(new Rect("r"), { x: "10", y: "20", width: "100", height: "50", "stroke-width": "3" });
    r.scaleBy(2);
    expect(r.summary()).toBe("x=20 y=40 w=200 h=100");
    expect(r.styleEntries()).toEqual([["stroke-width", "3"]]);
  });

  it("line and text", () => {
    const l = build(new Line("l"), { x1: "1", y1: "2", x2: "3", y2: "4" });
    const t = build(new Text("t"), { x: "10", y: "20", text: "x" });
    l.scaleBy(0.5);
    t.scaleBy(3);
    expect(l.summary()).toBe("(0.5,1) -> (1.5,2)");
    expect(t.summary()).toBe('(30,60) "x"');
  });
});

describe("moveDescription anchors (E10)", () => {
  it.each([
    ["rect (x,y)", build(new Rect("r"), { x: "130", y: "20", width: "5", height: "5" }), "to (130,20)"],
    ["text (x,y)", build(new Text("t"), { x: "1.5", y: "-2" }), "to (1.5,-2)"],
    ["circle (cx,cy)", build(new Circle("c"), { cx: "130", cy: "100", r: "20" }), "to (130,100)"],
    ["ellipse (cx,cy)", build(new Ellipse("e"), { cx: "7", cy: "8", rx: "1", ry: "2" }), "to (7,8)"],
    ["line (x1,y1)", build(new Line("l"), { x1: "3", y1: "4", x2: "50", y2: "60" }), "to (3,4)"],
  ])("%s", (_name, shape: Shape, expected) => {
    expect(shape.moveDescription(99, 99)).toBe(expected);
  });

  it("formats the anchor with V3", () => {
    const c = build(new Circle("c"), { cx: "0.1", cy: "0", r: "1" });
    c.moveBy(0.2, 0);
    expect(c.moveDescription(0.2, 0)).toBe("to (0.3,0)");
  });
});

describe("summary() matches the tree lines of §5.1, §6 and §6.1", () => {
  it.each([
    // §5.1 / §6 main session
    [build(new Rect("bg"), { x: "0", y: "0", width: "800", height: "600", fill: "#ffffff" }), "x=0 y=0 w=800 h=600 fill=#ffffff"],
    [build(new Text("title"), { x: "20", y: "40", text: "My Diagram" }), '(20,40) "My Diagram"'],
    [build(new Circle("c1"), { cx: "100", cy: "100", r: "20", fill: "red" }), "cx=100 cy=100 r=20 fill=red"],
    [build(new Rect("box"), { x: "200", y: "80", width: "60", height: "60", fill: "#3366ff" }), "x=200 y=80 w=60 h=60 fill=#3366ff"],
    // §6 after `read other.svg`
    [build(new Rect("rect1"), { x: "0", y: "0", width: "400", height: "300", fill: "#ffffff" }), "x=0 y=0 w=400 h=300 fill=#ffffff"],
    [build(new Text("t1"), { x: "10", y: "290", text: "imported" }), '(10,290) "imported"'],
    [build(new Circle("c1"), { cx: "50", cy: "50", r: "10" }), "cx=50 cy=50 r=10"],
    [build(new Rect("r2"), { x: "0", y: "0", width: "10", height: "10" }), "x=0 y=0 w=10 h=10"],
    [build(new Circle("c2"), { cx: "5", cy: "5", r: "2" }), "cx=5 cy=5 r=2"],
    [build(new Ellipse("e1"), { cx: "1", cy: "2", rx: "3", ry: "4" }), "cx=1 cy=2 rx=3 ry=4"],
    // §6.1 flowchart
    [build(new Rect("start"), { x: "120", y: "100", width: "160", height: "60", fill: "#4a90d9" }), "x=120 y=100 w=160 h=60 fill=#4a90d9"],
    [build(new Text("start-label"), { x: "155", y: "135", text: "开始" }), '(155,135) "开始"'],
    [build(new Rect("process"), { x: "520", y: "100", width: "160", height: "60", fill: "#f5a623" }), "x=520 y=100 w=160 h=60 fill=#f5a623"],
    [build(new Text("process-label"), { x: "545", y: "135", text: "处理数据" }), '(545,135) "处理数据"'],
    [build(new Line("arrow1"), { x1: "280", y1: "130", x2: "520", y2: "130", stroke: "black" }), "(280,130) -> (520,130)"],
  ])("%#: %s", (shape: Shape, expected) => {
    expect(shape.summary()).toBe(expected);
  });

  it("ellipse shows fill; line and text never show style (V2)", () => {
    expect(build(new Ellipse("e"), { rx: "1", ry: "1", fill: "blue" }).summary()).toBe("cx=0 cy=0 rx=1 ry=1 fill=blue");
    expect(build(new Line("l"), { fill: "red", "stroke-width": "2" }).summary()).toBe("(0,0) -> (0,0)");
    expect(build(new Text("t"), { fill: "red", text: "a b" }).summary()).toBe('(0,0) "a b"');
  });

  it("rect, circle: stroke is not shown (V2)", () => {
    expect(build(new Circle("c"), { r: "1", stroke: "black" }).summary()).toBe("cx=0 cy=0 r=1");
  });

  it("shows the empty text content", () => {
    expect(new Text("t").summary()).toBe('(0,0) ""');
  });
});

describe("setAttribute whitelist per type (§4.1, E7)", () => {
  const STYLE = ["fill", "stroke", "stroke-width"];
  const ALL_GEOMETRY = ["x", "y", "width", "height", "cx", "cy", "r", "rx", "ry", "x1", "y1", "x2", "y2"];

  it.each([
    ["rect", () => new Rect("s"), ["x", "y", "width", "height"]],
    ["circle", () => new Circle("s"), ["cx", "cy", "r"]],
    ["ellipse", () => new Ellipse("s"), ["cx", "cy", "rx", "ry"]],
    ["line", () => new Line("s"), ["x1", "y1", "x2", "y2"]],
    ["text", () => new Text("s"), ["x", "y"]],
  ])("%s accepts its own geometry and the style attributes", (_type, make: () => Shape, geometry: string[]) => {
    const shape = make();
    for (const name of geometry) {
      shape.setAttribute(name, "7");
    }
    for (const name of STYLE) {
      shape.setAttribute(name, name === "stroke-width" ? "2" : "red");
    }
    expect(shape.geometryEntries()).toEqual(geometry.map((name) => [name, "7"]));
    expect(shape.styleEntries()).toEqual([
      ["fill", "red"],
      ["stroke", "red"],
      ["stroke-width", "2"],
    ]);
  });

  it.each([
    ["rect", () => new Rect("s"), ["x", "y", "width", "height"]],
    ["circle", () => new Circle("s"), ["cx", "cy", "r"]],
    ["ellipse", () => new Ellipse("s"), ["cx", "cy", "rx", "ry"]],
    ["line", () => new Line("s"), ["x1", "y1", "x2", "y2"]],
    ["text", () => new Text("s"), ["x", "y"]],
  ])("%s rejects other geometry, text-less content, and unknown names", (_type, make: () => Shape, geometry: string[]) => {
    const shape = make();
    const before = shape.svgAttributes();
    const foreign = ALL_GEOMETRY.filter((name) => !geometry.includes(name));
    const rejected = [...foreign, "id", "opacity", "transform", "Fill", ...(shape.tagName() === "text" ? [] : ["text"])];
    for (const name of rejected) {
      expect(() => shape.setAttribute(name, "1")).toThrow(new EditorError(`unknown attribute: ${name}`));
    }
    expect(shape.svgAttributes()).toEqual(before);
  });

  it("examples from E7", () => {
    expect(() => new Circle("c1").setAttribute("width", "3")).toThrow(new EditorError("unknown attribute: width"));
    expect(() => new Rect("r1").setAttribute("text", "x")).toThrow(new EditorError("unknown attribute: text"));
  });

  it("text sets its content, including an empty string (E3)", () => {
    const t = build(new Text("t"), { text: "My Diagram v2" });
    expect(t.textContent()).toBe("My Diagram v2");
    t.setAttribute("text", "");
    expect(t.textContent()).toBe("");
  });

  it("non-text leaves have no text content", () => {
    expect(new Rect("r").textContent()).toBeNull();
  });
});

describe("setAttribute rejects invalid values and leaves the shape unchanged", () => {
  it.each([
    ["rect width -5", () => new Rect("s"), "width", "-5", "invalid value for width: -5"],
    ["rect height tiny negative", () => new Rect("s"), "height", "-1e-9", "invalid value for height: -1e-9"],
    ["circle r -1", () => new Circle("s"), "r", "-1", "invalid value for r: -1"],
    ["ellipse rx -0.5", () => new Ellipse("s"), "rx", "-0.5", "invalid value for rx: -0.5"],
    ["rect x abc", () => new Rect("s"), "x", "abc", "invalid number: abc"],
    ["line x2 0x10", () => new Line("s"), "x2", "0x10", "invalid number: 0x10"],
    ["text y Infinity", () => new Text("s"), "y", "Infinity", "invalid number: Infinity"],
    ["circle fill empty", () => new Circle("s"), "fill", "", 'invalid value for fill: ""'],
    ["rect stroke-width -1", () => new Rect("s"), "stroke-width", "-1", "invalid value for stroke-width: -1"],
    ["line stroke-width px", () => new Line("s"), "stroke-width", "2px", "invalid number: 2px"],
  ])("%s", (_case, make: () => Shape, name, raw, message) => {
    const shape = make();
    // Give every attribute a non-default value first, so "unchanged" is meaningful.
    for (const [geometryName] of shape.geometryEntries()) {
      shape.setAttribute(geometryName, "3");
    }
    shape.setAttribute("fill", "red");
    shape.setAttribute("stroke-width", "4");
    const before = shape.svgAttributes();
    expect(() => shape.setAttribute(name, raw)).toThrow(new EditorError(message));
    expect(shape.svgAttributes()).toEqual(before);
  });
});

describe("leaves are not containers", () => {
  it.each([new Rect("r"), new Circle("c"), new Ellipse("e"), new Line("l"), new Text("t")])("%#", (shape: Shape) => {
    expect(shape.asContainer()).toBeNull();
    expect(shape.isAncestorOf(new Rect("other"))).toBe(false);
    expect(shape.isAncestorOf(shape)).toBe(false);
  });
});

describe("svgAttributes order (F18): id, geometry, style, pass-through", () => {
  it("rect", () => {
    const r = build(new Rect("r1"), { "stroke-width": "2", height: "50", fill: "#eee", x: "10", y: "20", width: "100", stroke: "black" });
    r.addExtraAttribute("transform", "translate(1,2)");
    r.addExtraAttribute("data-x", "y");
    expect(r.svgAttributes()).toEqual([
      ["id", "r1"],
      ["x", "10"],
      ["y", "20"],
      ["width", "100"],
      ["height", "50"],
      ["fill", "#eee"],
      ["stroke", "black"],
      ["stroke-width", "2"],
      ["transform", "translate(1,2)"],
      ["data-x", "y"],
    ]);
    expect(r.extraEntries()).toEqual([
      ["transform", "translate(1,2)"],
      ["data-x", "y"],
    ]);
  });

  it("text content is not an attribute", () => {
    const t = build(new Text("t1"), { x: "20", y: "40", text: "My Diagram" });
    expect(t.svgAttributes()).toEqual([
      ["id", "t1"],
      ["x", "20"],
      ["y", "40"],
    ]);
  });

  it("pass-through attributes cannot be set (F7)", () => {
    const t = new Text("t");
    t.addExtraAttribute("font-size", "16");
    expect(() => t.setAttribute("font-size", "20")).toThrow(new EditorError("unknown attribute: font-size"));
    expect(t.extraEntries()).toEqual([["font-size", "16"]]);
  });
});
