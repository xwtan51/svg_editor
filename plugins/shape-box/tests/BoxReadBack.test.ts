import { EditorError } from "@svgframe/kernel";
import { describe, expect, it } from "vitest";
import { BoxShape } from "../src/BoxShape.js";
import { BoxTestbed } from "./doubles/BoxTestbed.js";
import { FakeElement } from "./doubles/FakeElement.js";
import { FakeGroup } from "./doubles/FakeGroup.js";
import { FakeRect } from "./doubles/FakeRect.js";

/**
 * Read-back through the real `SvgImporter` (design §2.1.3, §2.1.4, §3.8,
 * ADR-2, X6, X7, T1): with box installed a `<g data-kind="box">` comes back as
 * a box; without it, or when its parts are not as expected, as a plain `g`
 * that writes `data-kind` back unchanged.
 */
describe("BoxProvider: read-back", () => {
  const withBox = BoxTestbed.create();
  const withoutBox = BoxTestbed.create(false);

  /** The file of P1 spec §6.1B without the line (no stand-in for it). */
  const FLOWCHART = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<svg xmlns="http://www.w3.org/2000/svg" width="800" height="600" viewBox="0 0 800 600">',
    '  <g id="flowchart">',
    '    <g id="n1" data-kind="box">',
    '      <rect id="n1-rect" x="120" y="100" width="160" height="60" fill="#4a90d9"/>',
    '      <text id="n1-label" x="140" y="135">开始</text>',
    "    </g>",
    '    <g id="n2" data-kind="box">',
    '      <rect id="n2-rect" x="520" y="100" width="160" height="60" fill="#f5a623"/>',
    '      <text id="n2-label" x="540" y="135">处理数据</text>',
    "    </g>",
    "  </g>",
    "</svg>",
    "",
  ].join("\n");

  /** A file whose root holds `body`. */
  function file(body: string): string {
    return `<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100">${body}</svg>`;
  }

  const PARTS = '<rect id="n1-rect" x="0" y="0" width="10" height="10"/><text id="n1-label" x="1" y="2">a</text>';

  function rejection(text: string): unknown {
    try {
      withBox.read(text);
    } catch (error) {
      return error;
    }
    return null;
  }

  it("the serialized spec document is the expected file", () => {
    const flowchart = new FakeGroup("flowchart");
    const n1 = withBox.box("n1", "120", "100", "160", "60", "开始");
    const n2 = withBox.box("n2", "520", "100", "160", "60", "处理数据");
    n2.asContainer()!.childList()[0]!.setAttribute("fill", "#f5a623");
    flowchart.insertAt(n1, 0);
    flowchart.insertAt(n2, 1);
    const document = withBox.document(flowchart);
    document.resize(withBox.read(FLOWCHART).document.canvasSize());
    expect(withBox.serialize(document)).toBe(FLOWCHART);
  });

  it("read → save → read → save gives the same bytes, with boxes read as boxes", () => {
    const first = withBox.read(FLOWCHART);
    expect(first.warnings).toEqual([]);
    const saved = withBox.serialize(first.document);
    expect(saved).toBe(FLOWCHART);
    const second = withBox.read(saved);
    expect(withBox.serialize(second.document)).toBe(FLOWCHART);
    for (const id of ["n1", "n2"]) {
      const box = second.document.findById(id)!;
      expect(box).toBeInstanceOf(BoxShape);
      expect(box.label()).toBe(`box#${id}`);
      expect(box.asContainer()!.childList().map((part) => part.treeLabel())).toEqual([`rect#${id}-rect`, `text#${id}-label`]);
    }
    expect(second.document.findById("flowchart")!.kindName()).toBe("g");
  });

  it("matchScore: 2 for <g data-kind=\"box\">, beating the 1 of g; 0 for anything else", () => {
    const shapes = withBox.registry().shapes();
    const box = shapes.lookup("box");
    const g = shapes.lookup("g");
    const marked = new FakeElement("g", { id: "n1", "data-kind": "box" });
    expect(box.matchScore(marked)).toBe(2);
    expect(g.matchScore(marked)).toBe(1);
    expect(box.matchScore(new FakeElement("g", { id: "n1" }))).toBe(0);
    expect(box.matchScore(new FakeElement("g", { "data-kind": "Box" }))).toBe(0);
    expect(box.matchScore(new FakeElement("g", { "data-kind": "other" }))).toBe(0);
    expect(box.matchScore(new FakeElement("rect", { "data-kind": "box" }))).toBe(0);
  });

  it("without box the same file is read as plain g and written back byte for byte, data-kind included", () => {
    const read = withoutBox.read(FLOWCHART);
    expect(read.warnings).toEqual([]);
    const n1 = read.document.findById("n1")!;
    expect(n1).toBeInstanceOf(FakeGroup);
    expect(n1.label()).toBe("g#n1");
    expect(n1.extraEntries()).toEqual([["data-kind", "box"]]);
    expect(withoutBox.serialize(read.document)).toBe(FLOWCHART);
    expect(withoutBox.tree(read.document)).toContain("    ├── g#n1");
    // and box reads that output as boxes again
    expect(withBox.read(withoutBox.serialize(read.document)).document.findById("n1")).toBeInstanceOf(BoxShape);
  });

  describe("incomplete or wrong parts: warning, then a plain g (X6, X7)", () => {
    const cases: ReadonlyArray<readonly [string, string, readonly string[]]> = [
      [
        "title missing",
        '<g id="n1" data-kind="box"><rect id="n1-rect" x="0" y="0" width="10" height="10"/></g>',
        ["box n1 read as plain g: missing n1-label"],
      ],
      [
        "frame missing",
        '<g id="n1" data-kind="box"><text id="n1-label" x="1" y="2">a</text></g>',
        ["box n1 read as plain g: missing n1-rect"],
      ],
      [
        "the frame is a <circle>",
        '<g id="n1" data-kind="box"><circle id="n1-rect" cx="0" cy="0" r="1"/><text id="n1-label" x="1" y="2">a</text></g>',
        ["box n1 read as plain g: n1-rect is <circle>, expected <rect>", "skipped unsupported element <circle>"],
      ],
      [
        "the title is a <rect>",
        '<g id="n1" data-kind="box"><rect id="n1-rect" x="0" y="0" width="1" height="1"/><rect id="n1-label" x="0" y="0" width="1" height="1"/></g>',
        ["box n1 read as plain g: n1-label is <rect>, expected <text>"],
      ],
      [
        "the box has no id",
        `<g data-kind="box">${PARTS}</g>`,
        ["box (no id) read as plain g: no id", "assigned id g1 to unnamed <g>"],
      ],
      [
        "the box has an empty id",
        `<g id="" data-kind="box">${PARTS}</g>`,
        ["box (no id) read as plain g: no id", "assigned id g1 to unnamed <g>"],
      ],
      [
        "the parts have no ids (assigned rect1, text1)",
        '<g id="n1" data-kind="box"><rect x="0" y="0" width="10" height="10"/><text x="1" y="2">a</text></g>',
        ["box n1 read as plain g: missing n1-rect", "assigned id rect1 to unnamed <rect>", "assigned id text1 to unnamed <text>"],
      ],
      [
        "the parts are not direct children",
        `<g id="n1" data-kind="box"><g id="inner">${PARTS}</g></g>`,
        ["box n1 read as plain g: missing n1-rect"],
      ],
      [
        "two frames, one of them skipped, so the read itself succeeds",
        `<g id="n1" data-kind="box"><path id="n1-rect" d="M0 0"/>${PARTS}</g>`,
        ["box n1 read as plain g: 2 children with id n1-rect", "skipped unsupported element <path>"],
      ],
    ];

    it.each(cases)("%s", (_name, body, warnings) => {
      const read = withBox.read(file(body));
      expect(read.warnings).toEqual(warnings.map((message) => `warning: ${message}`));
      const top = read.document.childList()[0]!;
      expect(top).toBeInstanceOf(FakeGroup);
      expect(top.kindName()).toBe("g");
      expect(top.extraEntries()).toEqual([["data-kind", "box"]]);
      // degraded, it is written back with its marker, so box can try again later
      expect(withBox.serialize(read.document)).toContain('data-kind="box"');
    });
  });

  describe("parts found by id, not by position (X7)", () => {
    it("title before frame: still a box, children in file order", () => {
      const read = withBox.read(file('<g id="n1" data-kind="box"><text id="n1-label" x="1" y="2">a</text><rect id="n1-rect" x="0" y="0" width="10" height="10"/></g>'));
      expect(read.warnings).toEqual([]);
      const box = read.document.findById("n1")!;
      expect(box).toBeInstanceOf(BoxShape);
      expect(box.asContainer()!.childList().map((part) => part.getId())).toEqual(["n1-label", "n1-rect"]);
    });

    it("an extra child and a nested box: both boxes, all children kept", () => {
      const nested = '<g id="n3" data-kind="box"><rect id="n3-rect" x="0" y="0" width="1" height="1"/><text id="n3-label" x="0" y="0">b</text></g>';
      const text = file(`<g id="n1" data-kind="box"><rect id="r0" x="0" y="0" width="1" height="1"/>${PARTS}${nested}</g>`);
      const read = withBox.read(text);
      expect(read.warnings).toEqual([]);
      const box = read.document.findById("n1")!;
      expect(box).toBeInstanceOf(BoxShape);
      expect(box.asContainer()!.childList().map((part) => part.getId())).toEqual(["r0", "n1-rect", "n1-label", "n3"]);
      expect(read.document.findById("n3")).toBeInstanceOf(BoxShape);
      expect(read.document.findById("r0")).toBeInstanceOf(FakeRect);
    });
  });

  describe("duplicate ids reject the whole read (T1), with the scope of F14", () => {
    it("another <rect id=\"n1-rect\"> elsewhere in the file", () => {
      const error = rejection(file(`<g id="n1" data-kind="box">${PARTS}</g><rect id="n1-rect" x="0" y="0" width="1" height="1"/>`));
      expect(error).toEqual(new EditorError("cannot parse file: in.svg (duplicate id n1-rect)"));
    });

    it("an element elsewhere using the box id's derived title id, before the box", () => {
      const error = rejection(file(`<text id="n1-label" x="0" y="0">x</text><g id="n1" data-kind="box">${PARTS}</g>`));
      expect(error).toEqual(new EditorError("cannot parse file: in.svg (duplicate id n1-label)"));
    });

    it("two <rect id=\"n1-rect\"> inside the box: it degrades, and is still rejected", () => {
      const error = rejection(file(`<g id="n1" data-kind="box"><rect id="n1-rect" x="0" y="0" width="1" height="1"/>${PARTS}</g>`));
      expect(error).toEqual(new EditorError("cannot parse file: in.svg (duplicate id n1-rect)"));
    });

    it("a skipped <path id=\"n1-rect\"> elsewhere does not count: read as a box", () => {
      const read = withBox.read(file(`<path id="n1-rect" d="M0 0"/><g id="n1" data-kind="box">${PARTS}</g>`));
      expect(read.warnings).toEqual(["warning: skipped unsupported element <path>"]);
      expect(read.document.findById("n1")).toBeInstanceOf(BoxShape);
    });

    it("the same id nested inside a skipped element does not count either", () => {
      const read = withBox.read(file(`<a id="link"><rect id="n1-rect" x="0" y="0" width="1" height="1"/></a><g id="n1" data-kind="box">${PARTS}</g>`));
      expect(read.warnings).toEqual(["warning: skipped unsupported element <a>"]);
      expect(read.document.findById("n1")).toBeInstanceOf(BoxShape);
    });
  });
});
