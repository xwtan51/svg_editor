import { describe, expect, it } from "vitest";
import { Group } from "../../../src/model/Group.js";
import { CommandRunner } from "./CommandRunner.js";

/** scene { a, inner { b, c }, d } */
function nested(): CommandRunner {
  return CommandRunner.with(
    "create g scene",
    "create rect a 0 0 1 1 in scene",
    "create g inner in scene",
    "create rect b 0 0 1 1 in inner",
    "create circle c 0 0 1 in inner",
    "create rect d 0 0 1 1 in scene",
  );
}

/** A composite shape type such as the future `box` (§4.4). */
class CompositeGroup extends Group {
  override canUngroup(): boolean {
    return false;
  }
}

describe("ungroup", () => {
  it("children take the container's place, in order (E20, E23)", () => {
    const runner = nested();
    runner.expectRoundTrip("ungroup inner", ["g#inner ungrouped (2 children promoted)"], ["g#inner regrouped with 2 children"]);
    expect(runner.childIds("scene")).toEqual(["a", "b", "c", "d"]);
    expect(runner.document().findById("inner")).toBeNull();
    runner.undo();
    expect(runner.structure()).toEqual(["scene@svg[0]", "a@g#scene[0]", "inner@g#scene[1]", "b@g#inner[0]", "c@g#inner[1]", "d@g#scene[2]"]);
  });

  it("an empty container is simply removed (E22)", () => {
    const runner = CommandRunner.with("create g scene", "create rect a 0 0 1 1 in scene", "create g e in scene");
    runner.expectRoundTrip("ungroup e", ["g#e ungrouped (0 children promoted)"], ["g#e regrouped with 0 children"]);
    expect(runner.childIds("scene")).toEqual(["a"]);
  });

  it("a nested container child is promoted with its subtree", () => {
    const runner = CommandRunner.with("create g scene", "create g mid in scene", "create g leafg in mid", "create rect r 0 0 1 1 in leafg");
    runner.expectRoundTrip("ungroup mid", ["g#mid ungrouped (1 children promoted)"], ["g#mid regrouped with 1 children"]);
    expect(runner.structure()).toEqual(["scene@svg[0]", "leafg@g#scene[0]", "r@g#leafg[0]"]);
  });

  it("warns about the container's own attributes, also on redo (E21)", () => {
    const runner = nested();
    runner.run("set inner fill red");
    runner.run("set inner stroke-width 2");
    runner.shape("inner").addExtraAttribute("transform", "translate(1,2)");
    const echo = ["warning: attributes of g#inner discarded: fill, stroke-width, transform", "g#inner ungrouped (2 children promoted)"];
    runner.expectRoundTrip("ungroup inner", echo, ["g#inner regrouped with 2 children"]);
    runner.undo();
    expect(runner.svg()).toContain('<g id="inner" fill="red" stroke-width="2" transform="translate(1,2)">');
  });

  describe("errors (§4.2, E20)", () => {
    it("a top-level container, also one just made by group", () => {
      const runner = nested();
      runner.expectRejected("ungroup scene", "cannot ungroup top-level container: scene");
      const spec = CommandRunner.spec6();
      spec.expectRejected("ungroup markers", "cannot ungroup top-level container: markers");
    });

    it("not a container, or no such shape", () => {
      const runner = nested();
      runner.expectRejected("ungroup b", "not a container: b");
      runner.expectRejected("ungroup zz", "no such shape: zz");
    });

    it("a composite shape, checked before the top-level rule (E20)", () => {
      const runner = nested();
      const doc = runner.document();
      doc.insertAt(new CompositeGroup("n1"), doc.childList().length);
      runner.shape("scene").asContainer()?.insertAt(new CompositeGroup("n2"), 0);
      runner.expectRejected("ungroup n1", "cannot ungroup composite shape: n1");
      runner.expectRejected("ungroup n2", "cannot ungroup composite shape: n2");
    });

    it("usage", () => {
      const runner = nested();
      runner.expectRejected("ungroup", "usage: ungroup <gid>");
      runner.expectRejected("ungroup inner scene", "usage: ungroup <gid>");
    });
  });
});
