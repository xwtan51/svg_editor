import { describe, expect, it } from "vitest";
import { BoxTypeLabel } from "../src/BoxTypeLabel.js";
import { BoxTestbed } from "./doubles/BoxTestbed.js";
import { FakeGroup } from "./doubles/FakeGroup.js";
import { FakeRect } from "./doubles/FakeRect.js";
import { FakeRow } from "./doubles/FakeRow.js";

/** The tree tag `(box)` (design §2.3, §8.3). */
describe("BoxTypeLabel", () => {
  const testbed = BoxTestbed.create();
  const label = new BoxTypeLabel();

  it("tags box rows only", () => {
    const box = testbed.box("n1", "0", "0", "10", "10", "a");
    expect(label.tagFor(FakeRow.of(box))).toBe("(box)");
    expect(label.tagFor(FakeRow.root())).toBeNull();
    expect(label.tagFor(FakeRow.of(new FakeGroup("g1")))).toBeNull();
    expect(label.tagFor(FakeRow.of(new FakeRect("r1")))).toBeNull();
    expect(label.tagFor(FakeRow.of(box.asContainer()!.childList()[1]!))).toBeNull();
  });

  it("is the registered decorator", () => {
    const decorators = testbed.registry().treeDecorators();
    expect(decorators).toHaveLength(1);
    expect(decorators[0]).toBeInstanceOf(BoxTypeLabel);
    expect(decorators[0]?.name).toBe("box-type-label");
  });

  it("the whole tree: g#n1 (box) after the alignment of the summaries, nested boxes too", () => {
    const flowchart = new FakeGroup("flowchart");
    const n1 = testbed.box("n1", "120", "100", "160", "60", "开始");
    const n3 = testbed.box("n3", "0", "0", "8", "8", "x");
    n1.asContainer()!.insertAt(n3, 2);
    flowchart.insertAt(n1, 0);
    expect(testbed.tree(testbed.document(flowchart))).toEqual([
      "svg (800x600)",
      "└── g#flowchart",
      "    └── g#n1 (box)",
      "        ├── rect#n1-rect       x=120 y=100 w=160 h=60 fill=#4a90d9",
      "        ├── text#n1-label      (140,135) \"开始\"",
      "        └── g#n3 (box)",
      "            ├── rect#n3-rect   x=0 y=0 w=8 h=8 fill=#4a90d9",
      "            └── text#n3-label  (1,9) \"x\"",
    ]);
  });

  it("without box, the same kind of tree has no tag", () => {
    const bare = BoxTestbed.create(false);
    const read = bare.read(testbed.serialize(testbed.document(testbed.box("n1", "0", "0", "8", "8", "x"))));
    expect(bare.tree(read.document)).toEqual([
      "svg (800x600)",
      "└── g#n1",
      "    ├── rect#n1-rect   x=0 y=0 w=8 h=8 fill=#4a90d9",
      "    └── text#n1-label  (1,9) \"x\"",
    ]);
  });
});
