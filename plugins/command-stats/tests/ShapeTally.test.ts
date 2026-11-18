import type { Shape } from "@svgframe/kernel";
import { describe, expect, it } from "vitest";
import { ShapeTally } from "../src/ShapeTally.js";
import { FakeContainer } from "./doubles/FakeContainer.js";
import { FakeLeaf } from "./doubles/FakeLeaf.js";

/** The counting rules of spec §2.1 (design §8.1, N16), on documents built from test doubles only. */
describe("ShapeTally", () => {
  const rect = (id: string) => new FakeLeaf(id, "rect");
  const circle = (id: string) => new FakeLeaf(id, "circle");
  const text = (id: string) => new FakeLeaf(id, "text");
  const g = (id: string, ...children: Shape[]) => new FakeContainer(id, children);

  function tally(shapes: readonly Shape[]): string {
    const counter = new ShapeTally();
    counter.visit(shapes);
    return counter.render();
  }

  it("an empty document gives exactly `(total 0, containers 0)`", () => {
    expect(tally([])).toBe("(total 0, containers 0)");
  });

  it("reproduces the spec example (the document is built so that depth-first meets rect, circle, text in that order)", () => {
    // depth-first: r1, g1, r2, c1, g2, t1, r3, t2
    const shapes = [rect("r1"), g("g1", rect("r2"), circle("c1"), g("g2", text("t1"), rect("r3"))), text("t2")];
    expect(tally(shapes)).toBe("rect: 3  circle: 1  text: 2  (total 6, containers 2)");
  });

  it("lists the types in first-seen order, not alphabetically", () => {
    expect(tally([text("t1"), rect("r1"), text("t2")])).toBe("text: 2  rect: 1  (total 3, containers 0)");
  });

  it("is depth-first: a container's leaves come before its later siblings", () => {
    // breadth-first would meet the circle first
    expect(tally([g("g1", text("t1")), circle("c1")])).toBe("text: 1  circle: 1  (total 2, containers 1)");
  });

  it("follows the current child order", () => {
    expect(tally([g("g1", circle("c1"), rect("r1"))])).toBe("circle: 1  rect: 1  (total 2, containers 1)");
    expect(tally([g("g1", rect("r1"), circle("c1"))])).toBe("rect: 1  circle: 1  (total 2, containers 1)");
  });

  it("counts the leaves inside a container as usual, and the container only as a container", () => {
    expect(tally([g("g1", rect("r1"), rect("r2"))])).toBe("rect: 2  (total 2, containers 1)");
  });

  it("counts containers nested in containers, and the leaves at the bottom", () => {
    expect(tally([g("g1", g("g2", g("g3", circle("c1"))))])).toBe("circle: 1  (total 1, containers 3)");
  });

  it("a composite container (kind name `box`) counts only under containers; its parts count as leaves", () => {
    const box = new FakeContainer("b1", [rect("b1-rect"), text("b1-label")], "box");
    expect(tally([box, rect("r1")])).toBe("rect: 2  text: 1  (total 3, containers 1)");
  });

  it("counts a leaf under its kind name, not its tag name", () => {
    expect(tally([new FakeLeaf("s1", "star", "polygon"), new FakeLeaf("s2", "star", "polygon")])).toBe(
      "star: 2  (total 2, containers 0)",
    );
  });

  it("only containers and no leaf gives `(total 0, containers N)`", () => {
    expect(tally([g("g1"), g("g2", g("g3"))])).toBe("(total 0, containers 3)");
  });
});
