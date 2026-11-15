import { describe, expect, it } from "vitest";
import { EditorError } from "../../src/model/EditorError.js";
import type { ElementView } from "../../src/model/ElementView.js";
import type { Shape } from "../../src/model/Shape.js";
import type { ShapeKit } from "../../src/model/ShapeKit.js";
import type { ShapeReader } from "../../src/model/ShapeReader.js";
import type { ShapeType } from "../../src/model/ShapeType.js";
import { StaticShapeProvider } from "../../src/model/StaticShapeProvider.js";
import { FakeElement } from "../doubles/FakeElement.js";
import { FakeLeaf } from "../doubles/FakeLeaf.js";

/** Adapter from a class's static side to the `ShapeProvider` extension point (design §2.1.2). */
describe("StaticShapeProvider", () => {
  const provider = new StaticShapeProvider(FakeLeaf);
  const noKit: ShapeKit = {
    build: () => {
      throw new Error("a static provider builds no parts");
    },
  };

  it("forwards typeName and params", () => {
    expect(provider.typeName).toBe("fake-leaf");
    expect(provider.params).toBe(FakeLeaf.params);
  });

  it("claims exactly the given id and has no creation detail", () => {
    expect(provider.claimedIds("p1")).toEqual(["p1"]);
    const shape = provider.create("p1", new Map([["px", "3"]]), noKit);
    expect(shape).toBeInstanceOf(FakeLeaf);
    expect(shape.getId()).toBe("p1");
    expect(shape.geometryEntries()).toEqual([["px", "3"], ["py", "0"]]);
    expect(shape.parentContainer()).toBeNull();
    expect(provider.creationDetail(shape)).toBe("");
  });

  it("passes the type's EditorError through", () => {
    expect(() => provider.create("p1", new Map([["px", "x"]]), noKit)).toThrow(new EditorError("invalid number: x"));
  });

  it("scores 1 for its own tag name and 0 otherwise", () => {
    expect(provider.matchScore(new FakeElement("fake-leaf"))).toBe(1);
    expect(provider.matchScore(new FakeElement("fake-leaf", [["data-kind", "x"]]))).toBe(1);
    expect(provider.matchScore(new FakeElement("Fake-leaf"))).toBe(0);
    expect(provider.matchScore(new FakeElement("g"))).toBe(0);
  });

  it("reads through the standard path of the reader", () => {
    const calls: Array<[ShapeType, ElementView]> = [];
    const built = new FakeLeaf("p");
    const reader = {
      readStandard(type: ShapeType, element: ElementView): Shape {
        calls.push([type, element]);
        return built;
      },
    } as Partial<ShapeReader> as ShapeReader;
    const element = new FakeElement("fake-leaf", [["id", "p"]]);
    expect(provider.read(element, reader)).toBe(built);
    expect(calls).toEqual([[FakeLeaf, element]]);
  });
});
