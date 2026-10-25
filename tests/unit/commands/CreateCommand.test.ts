import { describe, expect, it } from "vitest";
import { CommandRunner } from "./CommandRunner.js";

describe("create", () => {
  describe("echo and generated SVG (E1, §4.1)", () => {
    it.each([
      ["create rect r1 10 20 100 50 #eee", "rect#r1 created", '<rect id="r1" x="10" y="20" width="100" height="50" fill="#eee"/>'],
      ["create circle c1 100 100 20 red", "circle#c1 created", '<circle id="c1" cx="100" cy="100" r="20" fill="red"/>'],
      ["create ellipse e1 1 2 3 4", "ellipse#e1 created", '<ellipse id="e1" cx="1" cy="2" rx="3" ry="4"/>'],
      ["create line l1 0 0 10 10 black", "line#l1 created", '<line id="l1" x1="0" y1="0" x2="10" y2="10" stroke="black"/>'],
      ['create text t1 20 40 "My Diagram"', "text#t1 created", '<text id="t1" x="20" y="40">My Diagram</text>'],
      ["create g scene", "g#scene created", '<g id="scene"/>'],
    ])("%s", (line, echo, fragment) => {
      const runner = new CommandRunner();
      expect(runner.run(line)).toEqual([echo]);
      expect(runner.svg()).toContain(`\n  ${fragment}\n`);
    });

    it("omitted fill / stroke are not written (§4.1)", () => {
      const runner = CommandRunner.with("create rect r1 0 0 1 1", "create line l1 0 0 1 1");
      expect(runner.svg()).toContain('<rect id="r1" x="0" y="0" width="1" height="1"/>');
      expect(runner.svg()).toContain('<line id="l1" x1="0" y1="0" x2="1" y2="1"/>');
    });

    it("appends at the end of the root, in creation order", () => {
      const runner = CommandRunner.with("create g a", "create rect b 0 0 1 1", "create circle c 0 0 1");
      expect(runner.childIds()).toEqual(["a", "b", "c"]);
    });

    it("reproduces the §6.1 session with in clauses", () => {
      const runner = new CommandRunner();
      const lines = [
        ["create g flowchart", "g#flowchart created"],
        ["create g node1 in flowchart", "g#node1 created in g#flowchart"],
        ["create rect start 120 100 160 60 #4a90d9 in node1", "rect#start created in g#node1"],
        ['create text start-label 155 135 "开始" in node1', "text#start-label created in g#node1"],
        ["create g node2 in flowchart", "g#node2 created in g#flowchart"],
        ["create rect process 520 100 160 60 #f5a623 in node2", "rect#process created in g#node2"],
        ['create text process-label 545 135 "处理数据" in node2', "text#process-label created in g#node2"],
        ["create line arrow1 280 130 520 130 black in flowchart", "line#arrow1 created in g#flowchart"],
      ];
      for (const [line, echo] of lines) {
        expect(runner.run(line ?? "")).toEqual([echo]);
      }
      expect(runner.structure()).toEqual([
        "flowchart@svg[0]",
        "node1@g#flowchart[0]",
        "start@g#node1[0]",
        "start-label@g#node1[1]",
        "node2@g#flowchart[1]",
        "process@g#node2[0]",
        "process-label@g#node2[1]",
        "arrow1@g#flowchart[2]",
      ]);
      expect(runner.document().elementCount()).toBe(8);
    });
  });

  describe("text content (E3, R6, E2)", () => {
    it("accepts an empty and a single-word content", () => {
      const runner = new CommandRunner();
      expect(runner.run('create text t1 0 0 ""')).toEqual(["text#t1 created"]);
      expect(runner.run("create text t2 0 0 word")).toEqual(["text#t2 created"]);
      expect(runner.shape("t1").textContent()).toBe("");
      expect(runner.shape("t2").textContent()).toBe("word");
    });

    it('a quoted "in" is content, not the keyword', () => {
      const runner = CommandRunner.with("create g g1");
      expect(runner.run('create text t1 0 0 "in" in g1')).toEqual(["text#t1 created in g#g1"]);
      expect(runner.shape("t1").textContent()).toBe("in");
    });

    it('a quoted "in" as the last token is content', () => {
      const runner = new CommandRunner();
      expect(runner.run('create text t1 0 0 "in"')).toEqual(["text#t1 created"]);
      expect(runner.shape("t1").textContent()).toBe("in");
    });

    it("keeps an inline # as content (R2)", () => {
      const runner = new CommandRunner();
      expect(runner.run("create text t1 0 0 #1")).toEqual(["text#t1 created"]);
      expect(runner.shape("t1").textContent()).toBe("#1");
    });
  });

  describe("undo / redo", () => {
    it("at the root: undo removes the shape", () => {
      const runner = CommandRunner.with("create rect a 0 0 1 1");
      runner.expectRoundTrip("create circle c1 1 2 3 red", ["circle#c1 created"], ["circle#c1 removed"]);
      expect(runner.childIds()).toEqual(["a", "c1"]);
    });

    it("inside a container", () => {
      const runner = CommandRunner.with("create g g1", "create rect a 0 0 1 1 in g1");
      runner.expectRoundTrip("create rect b 0 0 1 1 in g1", ["rect#b created in g#g1"], ["rect#b removed"]);
      expect(runner.childIds("g1")).toEqual(["a", "b"]);
    });

    it("after undo the id is free again; a deleted id can be reused (E30)", () => {
      const runner = CommandRunner.with("create rect r1 0 0 1 1");
      runner.undo();
      expect(runner.run("create circle r1 0 0 1")).toEqual(["circle#r1 created"]);
      expect(runner.run("delete r1")).toEqual(["circle#r1 deleted"]);
      expect(runner.run("create rect r1 0 0 2 2")).toEqual(["rect#r1 created"]);
    });
  });

  describe("errors (§4.2) leave the document unchanged", () => {
    const runner = () => CommandRunner.with("create g node1", "create rect start 0 0 1 1 in node1");

    it("id already exists (also for an id inside a container)", () => {
      runner().expectRejected("create circle start 0 0 1", "id already exists: start");
      runner().expectRejected("create g node1", "id already exists: node1");
    });

    it("invalid id (F16)", () => {
      runner().expectRejected("create rect 1r 0 0 1 1", "invalid id: 1r");
      runner().expectRejected("create rect a/b 0 0 1 1", "invalid id: a/b");
    });

    it("unknown shape type, case-sensitive", () => {
      runner().expectRejected("create hexagon h1 1 2", "unknown shape type: hexagon (is the plugin loaded?)");
      runner().expectRejected("create Rect r1 0 0 1 1", "unknown shape type: Rect (is the plugin loaded?)");
      runner().expectRejected("create box n1 120 100 160 60 \"开始\"", "unknown shape type: box (is the plugin loaded?)");
    });

    it("usage without type or id", () => {
      runner().expectRejected("create", "usage: create <type> <id> [params…] [in <containerId>]");
      runner().expectRejected("create rect", "usage: create <type> <id> [params…] [in <containerId>]");
    });

    it.each([
      ["create rect r1 0 0 1", "usage: create rect <id> <x> <y> <w> <h> [fill] [in <containerId>]"],
      ["create rect r1 0 0 1 1 red extra", "usage: create rect <id> <x> <y> <w> <h> [fill] [in <containerId>]"],
      ["create circle c1 0 0", "usage: create circle <id> <cx> <cy> <r> [fill] [in <containerId>]"],
      ["create ellipse e1 0 0 1", "usage: create ellipse <id> <cx> <cy> <rx> <ry> [fill] [in <containerId>]"],
      ["create line l1 0 0 1", "usage: create line <id> <x1> <y1> <x2> <y2> [stroke] [in <containerId>]"],
      ["create text t1 0 0", 'usage: create text <id> <x> <y> "content" [in <containerId>]'],
      ['create text t1 0 0 "a" red', 'usage: create text <id> <x> <y> "content" [in <containerId>]'],
      ["create g g1 extra", "usage: create g <id> [in <containerId>]"],
    ])("usage of the type (R7): %s", (line, message) => {
      runner().expectRejected(line, message);
    });

    it("invalid number and value constraints (R8, E4)", () => {
      runner().expectRejected("create rect r1 0 0 abc 1", "invalid number: abc");
      runner().expectRejected("create rect r1 0x10 0 1 1", "invalid number: 0x10");
      runner().expectRejected("create rect r1 0 0 -5 1", "invalid value for width: -5");
      runner().expectRejected("create circle c1 0 0 -1", "invalid value for r: -1");
      runner().expectRejected('create rect r1 0 0 1 1 ""', 'invalid value for fill: ""');
    });

    it("type is checked before the count, the count before the id (R10)", () => {
      runner().expectRejected("create hexagon start", "unknown shape type: hexagon (is the plugin loaded?)");
      runner().expectRejected("create rect start 0", "usage: create rect <id> <x> <y> <w> <h> [fill] [in <containerId>]");
    });

    it("negative coordinates are fine (E4)", () => {
      expect(runner().run("create rect r1 -10 -20 0 0")).toEqual(["rect#r1 created"]);
    });

    describe("in clause", () => {
      it("container does not exist", () => {
        runner().expectRejected("create rect r1 0 0 1 1 in node9", "no such container: node9");
      });

      it("target is not a container", () => {
        runner().expectRejected("create rect r1 0 0 1 1 in start", "not a container: start");
        runner().expectRejected('create text t1 0 0 "x" in start', "not a container: start");
      });

      it("the new id names the container of its own in clause", () => {
        runner().expectRejected("create g g9 in g9", "no such container: g9");
      });

      it.each([
        ["create rect q 0 0 1 1 in", "usage: create rect <id> <x> <y> <w> <h> [fill] [in <containerId>]"],
        ["create rect r1 0 0 1 1 red in", "usage: create rect <id> <x> <y> <w> <h> [fill] [in <containerId>]"],
        ["create circle c1 0 0 1 in", "usage: create circle <id> <cx> <cy> <r> [fill] [in <containerId>]"],
        ["create line l1 0 0 1 1 in", "usage: create line <id> <x1> <y1> <x2> <y2> [stroke] [in <containerId>]"],
        ["create text t1 0 0 in", 'usage: create text <id> <x> <y> "content" [in <containerId>]'],
        ["create g g1 in", "usage: create g <id> [in <containerId>]"],
        ["create g g1 in in", "usage: create g <id> [in <containerId>]"],
      ])("an unquoted in as the last token is a clause without container id: %s", (line, message) => {
        runner().expectRejected(line, message);
      });

      it("the dangling in is reported after the type and before the id (R10, as for a wrong count)", () => {
        runner().expectRejected("create hexagon h1 in", "unknown shape type: hexagon (is the plugin loaded?)");
        runner().expectRejected("create rect start 0 0 1 1 in", "usage: create rect <id> <x> <y> <w> <h> [fill] [in <containerId>]");
      });

      it('a quoted "in" stays an ordinary value, also as the last token', () => {
        const r = runner();
        expect(r.run('create rect r1 0 0 1 1 "in"')).toEqual(["rect#r1 created"]);
        expect(r.shape("r1").styleEntries()).toEqual([["fill", "in"]]);
        expect(r.run('create rect r2 0 0 1 1 "in" in node1')).toEqual(["rect#r2 created in g#node1"]);
        expect(r.shape("r2").styleEntries()).toEqual([["fill", "in"]]);
      });

      it("id errors come before container errors (R10)", () => {
        runner().expectRejected("create rect start 0 0 1 1 in node9", "id already exists: start");
        runner().expectRejected("create rect 9 0 0 1 1 in start", "invalid id: 9");
      });

      it("container errors come before value errors (R10)", () => {
        runner().expectRejected("create rect r1 0 0 -1 1 in node9", "no such container: node9");
      });
    });
  });
});
