import { describe, expect, it } from "vitest";
import { SvgSerializer } from "../../src/io/SvgSerializer.js";
import { CanvasSize } from "../../src/model/CanvasSize.js";
import { SvgDocument } from "../../src/model/SvgDocument.js";
import { FakeContainer } from "../doubles/FakeContainer.js";
import { FakeDocumentView } from "../doubles/FakeDocumentView.js";
import { FakeLeaf } from "../doubles/FakeLeaf.js";
import { FakeShapeView } from "../doubles/FakeShapeView.js";

/**
 * `SvgSerializer.serialize(DocumentView)` (design §2.3.5, §3.6.1): it reads
 * only the read-only views, so a hand-written view that is neither an
 * `SvgDocument` nor made of `Shape`s serializes like the real thing.
 */
describe("SvgSerializer over read-only views", () => {
  const expected = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<svg xmlns="http://www.w3.org/2000/svg" width="300" height="200" viewBox="0 0 300 200">',
    '  <fake-group id="n1" data-kind="composite">',
    '    <fake-leaf id="p" px="1" py="2" fill="red"/>',
    '    <note id="t">a &lt;b&gt; &amp; &quot;c&quot;</note>',
    "  </fake-group>",
    '  <fake-leaf id="q" px="3" py="4"/>',
    "</svg>",
    "",
  ].join("\n");

  it("serializes a hand-written DocumentView using only the view methods", () => {
    const view = new FakeDocumentView(new CanvasSize(300, 200), [
      new FakeShapeView(
        "fake-group",
        [
          ["id", "n1"],
          ["data-kind", "composite"],
        ],
        [
          new FakeShapeView("fake-leaf", [
            ["id", "p"],
            ["px", "1"],
            ["py", "2"],
            ["fill", "red"],
          ]),
          new FakeShapeView("note", [["id", "t"]], [], 'a <b> & "c"'),
        ],
      ),
      new FakeShapeView("fake-leaf", [
        ["id", "q"],
        ["px", "3"],
        ["py", "4"],
      ]),
    ]);
    expect(new SvgSerializer().serialize(view)).toBe(expected);
  });

  it("gives the same text for an SvgDocument as for an equal hand-written view", () => {
    const doc = new SvgDocument(new CanvasSize(300, 200));
    const group = new FakeContainer("n1");
    const leaf = new FakeLeaf("p");
    leaf.setAttribute("px", "1");
    leaf.setAttribute("py", "2");
    doc.insertAt(group, 0);
    group.insertAt(leaf, 0);
    const view = new FakeDocumentView(new CanvasSize(300, 200), [
      new FakeShapeView("fake-group", [["id", "n1"]], [new FakeShapeView("fake-leaf", [["id", "p"], ["px", "1"], ["py", "2"]])]),
    ]);
    expect(new SvgSerializer().serialize(doc)).toBe(new SvgSerializer().serialize(view));
  });

  it("writes an empty document as a self-closed root", () => {
    const view = new FakeDocumentView(new CanvasSize(10, 20), []);
    expect(new SvgSerializer().serialize(view).split("\n")[1]).toBe(
      '<svg xmlns="http://www.w3.org/2000/svg" width="10" height="20" viewBox="0 0 10 20"/>',
    );
  });
});
