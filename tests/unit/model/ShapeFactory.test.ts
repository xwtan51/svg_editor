import { describe, expect, it } from "vitest";
import { Circle } from "../../../src/model/Circle.js";
import { EditorError } from "../../../src/model/EditorError.js";
import { Ellipse } from "../../../src/model/Ellipse.js";
import { Group } from "../../../src/model/Group.js";
import { LeafShape } from "../../../src/model/LeafShape.js";
import { Line } from "../../../src/model/Line.js";
import { Rect } from "../../../src/model/Rect.js";
import { ShapeFactory } from "../../../src/model/ShapeFactory.js";
import type { ShapeType } from "../../../src/model/ShapeType.js";
import { Text } from "../../../src/model/Text.js";

const BUILT_IN: Array<[string, ShapeType]> = [
  ["rect", Rect],
  ["circle", Circle],
  ["ellipse", Ellipse],
  ["line", Line],
  ["text", Text],
  ["g", Group],
];

function usage(type: ShapeType): string {
  return [`create ${type.typeName} <id>`, ...type.params.map((p) => p.usageToken())].join(" ");
}

describe("ShapeFactory", () => {
  it("registers exactly the six built-in types, in order", () => {
    expect(new ShapeFactory().typeNames()).toEqual(["rect", "circle", "ellipse", "line", "text", "g"]);
  });

  it.each(BUILT_IN)("lookup(%s) returns the class itself", (name, type) => {
    expect(new ShapeFactory().lookup(name)).toBe(type);
  });

  it("reports an unknown type with the exact §4.2 message", () => {
    const factory = new ShapeFactory();
    expect(() => factory.lookup("hexagon")).toThrow(EditorError);
    expect(() => factory.lookup("hexagon")).toThrow(new EditorError("unknown shape type: hexagon (is the plugin loaded?)"));
  });

  it.each(["box", "Rect", "RECT", "", "svg", "path"])("rejects %j (case-sensitive, box not built in)", (name) => {
    expect(() => new ShapeFactory().lookup(name)).toThrow(
      new EditorError(`unknown shape type: ${name} (is the plugin loaded?)`),
    );
  });

  it("accepts a new type through register() (plugin seam, §4.1)", () => {
    class Hexagon extends Group {
      static override readonly typeName = "hexagon";
    }
    const factory = new ShapeFactory();
    factory.register(Hexagon);
    expect(factory.lookup("hexagon")).toBe(Hexagon);
    expect(factory.typeNames()).toContain("hexagon");
  });

  it("registering a name twice is a programming error", () => {
    const factory = new ShapeFactory();
    let thrown: unknown;
    try {
      factory.register(Rect);
    } catch (error) {
      thrown = error;
    }
    expect(thrown).toBeInstanceOf(Error);
    expect(thrown).not.toBeInstanceOf(EditorError);
  });

  it("checks the static side at compile time", () => {
    const factory = new ShapeFactory();
    // Never executed: this only has to fail type-checking.
    const notAShapeType = () =>
      // @ts-expect-error LeafShape has no static typeName / params / create
      factory.register(LeafShape);
    expect(typeof notAShapeType).toBe("function");
  });

  it("instances are independent (no global registry)", () => {
    const a = new ShapeFactory();
    a.register(class Star extends Group {
      static override readonly typeName = "star";
    });
    expect(() => new ShapeFactory().lookup("star")).toThrow(EditorError);
  });
});

describe("ShapeType static sides", () => {
  it.each(BUILT_IN)("%s: typeName equals the SVG tag name of its instances", (name, type) => {
    expect(type.typeName).toBe(name);
    expect(type.create("x", new Map()).tagName()).toBe(name);
  });

  it("params produce the §4.1 create syntax", () => {
    expect(BUILT_IN.map(([, type]) => usage(type))).toEqual([
      "create rect <id> <x> <y> <w> <h> [fill]",
      "create circle <id> <cx> <cy> <r> [fill]",
      "create ellipse <id> <cx> <cy> <rx> <ry> [fill]",
      "create line <id> <x1> <y1> <x2> <y2> [stroke]",
      'create text <id> <x> <y> "content"',
      "create g <id>",
    ]);
  });

  it("only the last parameter may be optional, and only text has a content parameter", () => {
    for (const [name, type] of BUILT_IN) {
      const optional = type.params.map((p) => p.isOptional());
      expect(optional.slice(0, -1).every((o) => !o)).toBe(true);
      expect(type.params.some((p) => p.isContent())).toBe(name === "text");
    }
  });

  it.each(BUILT_IN)("%s: geometry params match the shape's geometry table, in order", (_name, type) => {
    const shape = type.create("x", new Map());
    const geometryNames = shape.geometryEntries().map(([attribute]) => attribute);
    const geometryParams = type.params
      .map((p) => p.attributeName())
      .filter((attribute) => geometryNames.includes(attribute));
    expect(geometryParams).toEqual(geometryNames);
    // Every other param is a style attribute or text content.
    for (const p of type.params) {
      if (!geometryNames.includes(p.attributeName())) {
        expect(["fill", "stroke", "text"]).toContain(p.attributeName());
      }
    }
  });
});

describe("ShapeType.create", () => {
  it("rect from §4.1", () => {
    const values = new Map([
      ["x", "10"],
      ["y", "20"],
      ["width", "100"],
      ["height", "50"],
      ["fill", "#eee"],
    ]);
    const r = Rect.create("r1", values);
    expect(r.svgAttributes()).toEqual([
      ["id", "r1"],
      ["x", "10"],
      ["y", "20"],
      ["width", "100"],
      ["height", "50"],
      ["fill", "#eee"],
    ]);
    expect(r.parentContainer()).toBeNull();
  });

  it("omitted optional fill stays unset (§4.1)", () => {
    const c = Circle.create("c1", new Map([["cx", "100"], ["cy", "100"], ["r", "20"]]));
    expect(c.styleEntries()).toEqual([]);
    expect(c.summary()).toBe("cx=100 cy=100 r=20");
  });

  it("line takes stroke, text takes content, g takes nothing", () => {
    const l = Line.create("arrow1", new Map([["x1", "280"], ["y1", "130"], ["x2", "520"], ["y2", "130"], ["stroke", "black"]]));
    const t = Text.create("t1", new Map([["x", "20"], ["y", "40"], ["text", "My Diagram"]]));
    const g = Group.create("scene", new Map());
    expect(l.styleEntries()).toEqual([["stroke", "black"]]);
    expect(t.textContent()).toBe("My Diagram");
    expect(g.svgAttributes()).toEqual([["id", "scene"]]);
  });

  it("absent geometry keeps the default 0 (F12, used by the importer)", () => {
    expect(Ellipse.create("e", new Map([["rx", "3"]])).summary()).toBe("cx=0 cy=0 rx=3 ry=0");
  });

  it("invalid values throw EditorError", () => {
    expect(() => Rect.create("r", new Map([["width", "-5"]]))).toThrow(new EditorError("invalid value for width: -5"));
    expect(() => Circle.create("c", new Map([["cx", "abc"]]))).toThrow(new EditorError("invalid number: abc"));
    expect(() => Rect.create("r", new Map([["fill", ""]]))).toThrow(new EditorError('invalid value for fill: ""'));
  });

  it("a value for a non-parameter is a programming error", () => {
    let thrown: unknown;
    try {
      Circle.create("c", new Map([["width", "3"]]));
    } catch (error) {
      thrown = error;
    }
    expect(thrown).toBeInstanceOf(Error);
    expect(thrown).not.toBeInstanceOf(EditorError);
  });
});
