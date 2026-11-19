import { EditorError, IdSyntax } from "@svgframe/kernel";
import type { Shape } from "@svgframe/kernel";
import { describe, expect, it } from "vitest";
import { BoxProvider } from "../src/BoxProvider.js";
import { BoxTestbed } from "./doubles/BoxTestbed.js";

/** Creating a box through the registry: `BoxProvider.create` with the real `ShapeKit` and the stand-in rect / text (design §2.1.5, §2.1.6, X3). */
describe("BoxProvider: create", () => {
  const testbed = BoxTestbed.create();
  const provider = testbed.registry().shapes().lookup("box");

  /** Every id in the subtree, depth first. */
  function ids(shape: Shape): string[] {
    return [shape.getId(), ...(shape.asContainer()?.childList() ?? []).flatMap(ids)];
  }

  function parts(box: Shape): Shape[] {
    return [...box.asContainer()!.childList()];
  }

  it("is the registered box provider", () => {
    expect(provider).toBeInstanceOf(BoxProvider);
    expect(provider.typeName).toBe("box");
  });

  it("claims the box id and the two derived ids, the box id first", () => {
    expect(provider.claimedIds("n1")).toEqual(["n1", "n1-rect", "n1-label"]);
  });

  it("derived ids of a valid id are valid ids", () => {
    for (const id of ["n1", "A", "_x", "a.b", "a:b", "a-b"]) {
      expect(IdSyntax.isValid(id)).toBe(true);
      for (const claimed of provider.claimedIds(id)) {
        expect(IdSyntax.isValid(claimed), claimed).toBe(true);
      }
    }
  });

  it("builds g + rect + text whose ids are exactly the claimed ids", () => {
    const box = testbed.box("n1", "120", "100", "160", "60", "开始");
    expect(ids(box)).toEqual([...provider.claimedIds("n1")]);
    expect(parts(box).map((part) => part.treeLabel())).toEqual(["rect#n1-rect", "text#n1-label"]);
    expect(box.parentContainer()).toBeNull();
  });

  it("the frame takes the four values as given and the fill #4a90d9", () => {
    const [frame] = parts(testbed.box("n1", "120", "100", "160", "60", "开始"));
    expect(frame!.svgAttributes()).toEqual([
      ["id", "n1-rect"], ["x", "120"], ["y", "100"], ["width", "160"], ["height", "60"], ["fill", "#4a90d9"],
    ]);
  });

  it("the title of the spec boxes sits at (x + 20, y + 35)", () => {
    const [, first] = parts(testbed.box("n1", "120", "100", "160", "60", "开始"));
    const [, second] = parts(testbed.box("n2", "520", "100", "160", "60", "处理数据"));
    expect(first!.summary()).toBe('(140,135) "开始"');
    expect(second!.summary()).toBe('(540,135) "处理数据"');
  });

  it("the title sits at (x + w/8, y + h/2 + 5) also when w is not 160 (X3)", () => {
    const [, small] = parts(testbed.box("n1", "0", "0", "10", "10", "a"));
    const [, odd] = parts(testbed.box("n3", "0.5", "0", "3", "7", "q"));
    const [, wide] = parts(testbed.box("n4", "-40", "20", "400", "0", ""));
    expect(small!.svgAttributes()).toEqual([["id", "n1-label"], ["x", "1.25"], ["y", "10"]]);
    expect(odd!.svgAttributes()).toEqual([["id", "n3-label"], ["x", "0.875"], ["y", "8.5"]]);
    expect(wide!.summary()).toBe('(10,25) ""');
    expect(small!.textContent()).toBe("a");
  });

  it("the creation detail lists the tree names of the box and its parts", () => {
    const box = testbed.box("n1", "120", "100", "160", "60", "开始");
    expect(provider.creationDetail(box)).toBe(" (g#n1 + rect#n1-rect + text#n1-label)");
  });

  it("its parameters give the usage <x> <y> <w> <h> \"label\", keyed by x, y, width, height, label", () => {
    expect(provider.params.map((spec) => spec.usageToken()).join(" ")).toBe('<x> <y> <w> <h> "label"');
    expect(provider.params.map((spec) => spec.attributeName())).toEqual(["x", "y", "width", "height", "label"]);
    expect(provider.params.map((spec) => spec.isOptional())).toEqual([false, false, false, false, false]);
  });

  it("an invalid size is reported by rect, with its own wording", () => {
    expect(() => testbed.box("bad", "1", "1", "-1", "5", "x")).toThrow(new EditorError("invalid value for width: -1"));
    expect(() => testbed.box("bad", "1", "1", "5", "-2", "x")).toThrow(new EditorError("invalid value for height: -2"));
  });

  it("a value that is not a number is rejected as such", () => {
    expect(() => testbed.box("bad", "a", "1", "5", "5", "x")).toThrow(new EditorError("invalid number: a"));
    expect(() => testbed.box("bad", "1", "1", "5", "five", "x")).toThrow(EditorError);
  });
});
