import { describe, expect, it } from "vitest";
import { BoxShape } from "../src/BoxShape.js";
import { BoxTestbed } from "./doubles/BoxTestbed.js";
import { FakeRect } from "./doubles/FakeRect.js";

/** The Composite container of box (design §3.5–§3.7, §8.3). */
describe("BoxShape", () => {
  const testbed = BoxTestbed.create();

  it("is written as <g> but named box: echo box#n1, tree g#n1 (design §3.6)", () => {
    const box = testbed.box("n1", "120", "100", "160", "60", "开始");
    expect(box).toBeInstanceOf(BoxShape);
    expect(box.tagName()).toBe("g");
    expect(box.kindName()).toBe("box");
    expect(box.label()).toBe("box#n1");
    expect(box.treeLabel()).toBe("g#n1");
    expect(box.isContainer()).toBe(true);
  });

  it("refuses ungroup", () => {
    expect(new BoxShape("n1").canUngroup()).toBe(false);
  });

  it("keeps its frame and title, lets any other child go (design §3.7)", () => {
    const box = testbed.box("n1", "0", "0", "100", "50", "a");
    const container = box.asContainer()!;
    const nested = testbed.box("n3", "0", "0", "10", "10", "b");
    const extra = new FakeRect("r9");
    container.insertAt(nested, 2);
    container.insertAt(extra, 3);
    const [frame, label] = container.childList();
    expect(container.canRelease(frame!)).toBe(false);
    expect(container.canRelease(label!)).toBe(false);
    expect(container.canRelease(nested)).toBe(true);
    expect(container.canRelease(extra)).toBe(true);
    // the nested box's parts belong to the nested box, not to n1
    expect(container.canRelease(nested.asContainer()!.childList()[0]!)).toBe(true);
  });

  it("frame and title ids are derived from the box id", () => {
    const box = new BoxShape("node_7");
    expect(box.frameId()).toBe("node_7-rect");
    expect(box.labelId()).toBe("node_7-label");
  });

  it("writes data-kind right after id, exactly once", () => {
    expect(testbed.box("n1", "0", "0", "10", "10", "a").svgAttributes()).toEqual([["id", "n1"], ["data-kind", "box"]]);
  });

  it("keeps style and pass-through attributes after the marker, still with one data-kind", () => {
    const text = [
      '<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10">',
      '<g id="n1" class="node" data-kind="box" stroke="red">',
      '<rect id="n1-rect" x="0" y="0" width="1" height="1"/><text id="n1-label" x="0" y="0">a</text>',
      "</g></svg>",
    ].join("");
    const box = testbed.read(text).document.findById("n1")!;
    expect(box.kindName()).toBe("box");
    expect(box.svgAttributes()).toEqual([["id", "n1"], ["data-kind", "box"], ["stroke", "red"], ["class", "node"]]);
  });
});
