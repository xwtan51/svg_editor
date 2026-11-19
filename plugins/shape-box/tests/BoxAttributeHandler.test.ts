import { EditorError } from "@svgframe/kernel";
import { describe, expect, it } from "vitest";
import { BoxAttributeHandler } from "../src/BoxAttributeHandler.js";
import { BoxFillChange } from "../src/BoxFillChange.js";
import { BoxLabelChange } from "../src/BoxLabelChange.js";
import { BoxTestbed } from "./doubles/BoxTestbed.js";
import { FakeGroup } from "./doubles/FakeGroup.js";
import { FakeRect } from "./doubles/FakeRect.js";

/**
 * `set <box> fill` and `set <box> label` (design §2.4, §8.3): which attributes
 * the handler takes, and the edit the kernel's pipeline plans from it
 * (`EditorSession.attributeEdits().plan`), applied with `redo()` and taken
 * back with `undo()` — what `set`, `undo` and `redo` do with it.
 */
describe("BoxAttributeHandler", () => {
  const testbed = BoxTestbed.create();
  const handler = new BoxAttributeHandler();

  it("handles fill and label on a box only", () => {
    const box = testbed.box("n1", "0", "0", "10", "10", "a");
    expect(handler.handles(box, "fill")).toBe(true);
    expect(handler.handles(box, "label")).toBe(true);
    expect(handler.handles(box, "stroke")).toBe(false);
    expect(handler.handles(box, "text")).toBe(false);
    expect(handler.handles(box, "x")).toBe(false);
    expect(handler.handles(new FakeGroup("g1"), "fill")).toBe(false);
    expect(handler.handles(new FakeGroup("g1"), "label")).toBe(false);
    expect(handler.handles(new FakeRect("r1"), "fill")).toBe(false);
    expect(handler.handles(box.asContainer()!.childList()[0]!, "fill")).toBe(false);
  });

  it("is the registered handler, with priority 0", () => {
    const handlers = testbed.registry().attributeHandlers();
    expect(handlers).toHaveLength(1);
    expect(handlers[0]).toBeInstanceOf(BoxAttributeHandler);
    expect(handlers[0]?.name).toBe("box-attributes");
    expect(handlers[0]?.priority).toBe(0);
  });

  /** A document with box n2 (the spec's second node) under the root, and its session. */
  function scene() {
    const box = testbed.box("n2", "520", "100", "160", "60", "处理数据");
    const document = testbed.document(box);
    const session = testbed.session(document);
    const svg = () => testbed.serialize(document);
    return { box, document, session, svg, before: svg() };
  }

  it("set fill: only the frame changes; one edit with the echoes propagated to / restored on", () => {
    const { box, session, svg, before } = scene();
    const edit = session.attributeEdits().plan(box, "fill", "#f5a623")!;
    expect(svg()).toBe(before);
    expect(edit.appliedMessage()).toBe("box#n2 fill propagated to n2-rect");
    expect(edit.undoneMessage()).toBe("box#n2 fill restored on n2-rect");
    edit.redo();
    expect(svg()).toBe(before.replace('fill="#4a90d9"', 'fill="#f5a623"'));
    expect(box.styleEntries()).toEqual([]);
    edit.undo();
    expect(svg()).toBe(before);
    edit.redo();
    expect(svg()).toBe(before.replace('fill="#4a90d9"', 'fill="#f5a623"'));
  });

  it("set label: only the title changes; the undo echo names the previous text", () => {
    const { session, box, svg, before } = scene();
    const edit = session.attributeEdits().plan(box, "label", "处理数据 v2")!;
    expect(svg()).toBe(before);
    expect(edit.appliedMessage()).toBe('box#n2 label updated: "处理数据 v2"');
    expect(edit.undoneMessage()).toBe('box#n2 label restored: "处理数据"');
    edit.redo();
    expect(svg()).toBe(before.replace(">处理数据<", ">处理数据 v2<"));
    edit.undo();
    expect(svg()).toBe(before);
  });

  it("an empty label is a valid text", () => {
    const { session, box, svg, before } = scene();
    const edit = session.attributeEdits().plan(box, "label", "")!;
    edit.redo();
    expect(svg()).toBe(before.replace('y="135">处理数据</text>', 'y="135"/>'));
    expect(edit.appliedMessage()).toBe('box#n2 label updated: ""');
  });

  it("an invalid fill is rejected with rect's wording and changes nothing", () => {
    const { session, box, svg, before } = scene();
    expect(() => session.attributeEdits().plan(box, "fill", "")).toThrow(new EditorError('invalid value for fill: ""'));
    expect(svg()).toBe(before);
  });

  it("other attributes of a box are not this handler's (the whitelist applies)", () => {
    const { session, box } = scene();
    expect(session.attributeEdits().plan(box, "stroke", "red")).toBeNull();
  });

  it("the two changes word their echoes as in design §2.4.6", () => {
    const fill = new BoxFillChange("box#n2", "n2-rect");
    expect(fill.appliedMessage()).toBe("box#n2 fill propagated to n2-rect");
    expect(fill.undoneMessage()).toBe("box#n2 fill restored on n2-rect");
    const label = new BoxLabelChange("box#n2", "v2", "v1");
    expect(label.appliedMessage()).toBe('box#n2 label updated: "v2"');
    expect(label.undoneMessage()).toBe('box#n2 label restored: "v1"');
  });
});
