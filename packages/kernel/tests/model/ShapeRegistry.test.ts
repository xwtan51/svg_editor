import { describe, expect, it } from "vitest";
import { EditorError } from "../../src/model/EditorError.js";
import { ShapeRegistry } from "../../src/model/ShapeRegistry.js";
import { StaticShapeProvider } from "../../src/model/StaticShapeProvider.js";
import { FakeContainer } from "../doubles/FakeContainer.js";
import { FakeLeaf } from "../doubles/FakeLeaf.js";

/** Name dispatch #1 with test doubles only (design §2.1.1, §2.1.2): no type is built in. */
describe("ShapeRegistry (kernel contract)", () => {
  const filled = () => {
    const registry = new ShapeRegistry();
    const leaf = new StaticShapeProvider(FakeLeaf);
    const group = new StaticShapeProvider(FakeContainer);
    registry.register(leaf);
    registry.register(group);
    return { registry, leaf, group };
  };

  it("starts empty: no built-in type", () => {
    const registry = new ShapeRegistry();
    expect(registry.typeNames()).toEqual([]);
    expect(registry.providers()).toEqual([]);
    expect(registry.has("rect")).toBe(false);
  });

  it("keeps registration order for names and providers", () => {
    const { registry, leaf, group } = filled();
    expect(registry.typeNames()).toEqual(["fake-leaf", "fake-group"]);
    expect(registry.providers()).toEqual([leaf, group]);
  });

  it("looks a provider up by its exact name", () => {
    const { registry, leaf } = filled();
    expect(registry.lookup("fake-leaf")).toBe(leaf);
    expect(registry.has("fake-group")).toBe(true);
    expect(registry.has("Fake-group")).toBe(false);
  });

  it.each(["rect", "Fake-leaf", "", "box"])("an unregistered name %j is `unknown shape type`", (name) => {
    expect(() => filled().registry.lookup(name)).toThrow(new EditorError(`unknown shape type: ${name} (is the plugin loaded?)`));
  });

  it("build(type, id, values) creates through the provider (ShapeKit)", () => {
    const { registry } = filled();
    const shape = registry.build("fake-leaf", "p", new Map([["px", "4"]]));
    expect(shape).toBeInstanceOf(FakeLeaf);
    expect(shape.geometryEntries()).toEqual([["px", "4"], ["py", "0"]]);
    expect(() => registry.build("nope", "p", new Map())).toThrow(new EditorError("unknown shape type: nope (is the plugin loaded?)"));
  });

  it("the lists it hands out are copies", () => {
    const { registry } = filled();
    (registry.typeNames() as string[]).pop();
    expect(registry.typeNames()).toHaveLength(2);
  });

  it("registering a name twice is a programming error", () => {
    const { registry } = filled();
    expect(() => registry.register(new StaticShapeProvider(FakeLeaf))).toThrow("shape type already registered: fake-leaf");
  });
});
