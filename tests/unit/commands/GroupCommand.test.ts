import { describe, expect, it } from "vitest";
import { CommandRunner } from "./CommandRunner.js";

/** The §6 document just before `group markers c1 box`. */
function spec6BeforeGroup(): CommandRunner {
  return CommandRunner.with(
    "create rect bg 0 0 800 600 #ffffff",
    'create text title 20 40 "My Diagram"',
    "create circle c1 100 100 20 red",
    "create rect box 200 80 60 60 #3366ff",
  );
}

describe("group", () => {
  it("§6: group markers c1 box; one undo restores everything", () => {
    const runner = spec6BeforeGroup();
    runner.expectRoundTrip("group markers c1 box", ["g#markers created with 2 children"], ["g#markers removed, 2 children restored"]);
    expect(runner.structure()).toEqual(["bg@svg[0]", "title@svg[1]", "markers@svg[2]", "c1@g#markers[0]", "box@g#markers[1]"]);
    expect(runner.undo()).toEqual(["g#markers removed, 2 children restored"]);
    expect(runner.structure()).toEqual(["bg@svg[0]", "title@svg[1]", "c1@svg[2]", "box@svg[3]"]);
    expect(runner.document().findById("markers")).toBeNull();
  });

  it("members follow document order, not argument order (E16)", () => {
    const runner = spec6BeforeGroup();
    runner.expectRoundTrip("group g box bg c1", ["g#g created with 3 children"], ["g#g removed, 3 children restored"]);
    expect(runner.childIds("g")).toEqual(["bg", "c1", "box"]);
    expect(runner.childIds()).toEqual(["g", "title"]);
  });

  it("the new group takes the place of the first member in document order (E17)", () => {
    const runner = CommandRunner.with(
      "create rect a 0 0 1 1",
      "create rect b 0 0 1 1",
      "create rect c 0 0 1 1",
      "create rect d 0 0 1 1",
    );
    runner.expectRoundTrip("group n d b", ["g#n created with 2 children"], ["g#n removed, 2 children restored"]);
    expect(runner.childIds()).toEqual(["a", "n", "c"]);
    expect(runner.childIds("n")).toEqual(["b", "d"]);
  });

  it("members from different containers; the group goes into the first member's container (E17, E18)", () => {
    const runner = CommandRunner.with(
      "create rect a 0 0 1 1",
      "create g g1",
      "create rect b 0 0 1 1 in g1",
      "create rect c 0 0 1 1 in g1",
      "create g g2",
      "create rect e 0 0 1 1 in g2",
      "create rect d 0 0 1 1",
    );
    runner.expectRoundTrip("group n d e c", ["g#n created with 3 children"], ["g#n removed, 3 children restored"]);
    expect(runner.structure()).toEqual([
      "a@svg[0]",
      "g1@svg[1]",
      "b@g#g1[0]",
      "n@g#g1[1]",
      "c@g#n[0]",
      "e@g#n[1]",
      "d@g#n[2]",
      "g2@svg[2]",
    ]);
  });

  it("a member nested deeper than the others is first when it comes first in document order", () => {
    const runner = CommandRunner.with("create g g1", "create rect b 0 0 1 1 in g1", "create rect a 0 0 1 1");
    runner.expectRoundTrip("group n a b", ["g#n created with 2 children"], ["g#n removed, 2 children restored"]);
    expect(runner.structure()).toEqual(["g1@svg[0]", "n@g#g1[0]", "b@g#n[0]", "a@g#n[1]"]);
  });

  it("a container member keeps its subtree", () => {
    const runner = CommandRunner.spec6();
    runner.expectRoundTrip("group all markers bg", ["g#all created with 2 children"], ["g#all removed, 2 children restored"]);
    expect(runner.structure()).toEqual(["all@svg[0]", "bg@g#all[0]", "markers@g#all[1]", "c1@g#markers[0]", "box@g#markers[1]", "title@svg[1]"]);
  });

  it("a single member is enough (E18)", () => {
    const runner = spec6BeforeGroup();
    runner.expectRoundTrip("group solo title", ["g#solo created with 1 children"], ["g#solo removed, 1 children restored"]);
    expect(runner.structure()).toEqual(["bg@svg[0]", "solo@svg[1]", "title@g#solo[0]", "c1@svg[2]", "box@svg[3]"]);
  });

  it("the new group has no attributes of its own", () => {
    const runner = spec6BeforeGroup();
    runner.run("group markers c1 box");
    expect(runner.svg()).toContain('  <g id="markers">\n    <circle id="c1"');
  });

  describe("errors (§4.2, E18)", () => {
    it("§6: group bad c1 markers names the container", () => {
      CommandRunner.spec6().expectRejected("group bad c1 markers", "cannot group a container into its own descendant: markers");
    });

    it("the container is named whatever the argument order or depth", () => {
      const runner = CommandRunner.with("create g outer", "create g inner in outer", "create rect deep 0 0 1 1 in inner", "create rect x 0 0 1 1");
      runner.expectRejected("group bad markers2", "no such shape: markers2");
      runner.expectRejected("group bad outer deep", "cannot group a container into its own descendant: outer");
      runner.expectRejected("group bad x deep inner", "cannot group a container into its own descendant: inner");
      runner.expectRejected("group bad deep x outer", "cannot group a container into its own descendant: outer");
    });

    it("new id: invalid, or already exists (including a member's id)", () => {
      const runner = CommandRunner.spec6();
      runner.expectRejected("group 9g c1", "invalid id: 9g");
      runner.expectRejected("group bg c1", "id already exists: bg");
      runner.expectRejected("group c1 c1", "id already exists: c1");
    });

    it("unknown member and duplicates", () => {
      const runner = CommandRunner.spec6();
      runner.expectRejected("group g c1 r9", "no such shape: r9");
      runner.expectRejected("group g c1 box c1", "duplicate id in arguments: c1");
    });

    it("checks from left to right: id, members, then ancestry (R10)", () => {
      const runner = CommandRunner.spec6();
      runner.expectRejected("group bg r9", "id already exists: bg");
      runner.expectRejected("group bad markers c1 r9", "no such shape: r9");
      runner.expectRejected("group bad markers c1 markers", "duplicate id in arguments: markers");
    });

    it("usage", () => {
      const runner = CommandRunner.spec6();
      runner.expectRejected("group", "usage: group <newGid> <id1> <id2>…");
      runner.expectRejected("group g", "usage: group <newGid> <id1> <id2>…");
    });
  });

  it("undo then a new edit clears the redo of the group", () => {
    const runner = spec6BeforeGroup();
    runner.run("group markers c1 box");
    runner.undo();
    runner.run("move c1 1 1");
    expect(runner.redo()).toEqual(["error: nothing to redo"]);
  });
});
