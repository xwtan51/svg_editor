import { describe, expect, it } from "vitest";
import type { ImportResult } from "../../src/io/ImportResult.js";
import { SvgImporter } from "../../src/io/SvgImporter.js";
import { EditorError } from "../../src/model/EditorError.js";
import type { Shape } from "../../src/model/Shape.js";
import type { ShapeProvider } from "../../src/model/ShapeProvider.js";
import { ShapeRegistry } from "../../src/model/ShapeRegistry.js";
import { StaticShapeProvider } from "../../src/model/StaticShapeProvider.js";
import { FakeCompositeProvider } from "../doubles/FakeCompositeProvider.js";
import { FakeContainer } from "../doubles/FakeContainer.js";
import { FakeFileSystem } from "../doubles/FakeFileSystem.js";
import { FakeLeaf } from "../doubles/FakeLeaf.js";
import { ScriptedProvider } from "../doubles/ScriptedProvider.js";

/**
 * Read-back through shape providers (design §2.1.3, §2.1.4, §3.8), with test
 * doubles only: matchScore dispatch, ties, skipping, degradation, the
 * `requireUnique` scope, consumed attributes and contract breaches.
 */

const leaf = () => new StaticShapeProvider(FakeLeaf);
const group = () => new StaticShapeProvider(FakeContainer);

function catalog(...providers: ShapeProvider[]): ShapeRegistry {
  const registry = new ShapeRegistry();
  providers.forEach((provider) => registry.register(provider));
  return registry;
}

function svg(body: string): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="100" height="50">${body}</svg>`;
}

function read(body: string, ...providers: ShapeProvider[]): ImportResult {
  const shapes = providers.length === 0 ? catalog(leaf(), group()) : catalog(...providers);
  return new SvgImporter(shapes).read(new FakeFileSystem({ "a.svg": svg(body) }), "a.svg");
}

function errorOf(action: () => unknown): string {
  try {
    action();
  } catch (error) {
    expect(error).toBeInstanceOf(EditorError);
    return (error as EditorError).message;
  }
  throw new Error("no error");
}

/** `label kind/extras` of every shape, depth first. */
function outline(result: ImportResult): string[] {
  const lines: string[] = [];
  const visit = (shapes: readonly Shape[], depth: number) => {
    for (const shape of shapes) {
      const extras = shape.extraEntries().map(([name, value]) => ` ${name}=${value}`).join("");
      lines.push(`${"  ".repeat(depth)}${shape.label()}${extras}`);
      visit(shape.asContainer()?.childList() ?? [], depth + 1);
    }
  };
  visit(result.document().childList(), 0);
  return lines;
}

const COMPOSITE = '<fake-group id="c" data-kind="composite" fill="red"><fake-leaf id="c-part" px="1" py="2"/></fake-group>';

describe("read-back dispatch by matchScore", () => {
  it("nothing is built in: with an empty catalog every element is skipped", () => {
    const result = new SvgImporter(new ShapeRegistry()).read(
      new FakeFileSystem({ "a.svg": svg('<fake-leaf id="a"/><rect id="r"/>') }),
      "a.svg",
    );
    expect(outline(result)).toEqual([]);
    expect(result.warnings()).toEqual([
      "warning: skipped unsupported element <fake-leaf>",
      "warning: skipped unsupported element <rect>",
    ]);
  });

  it("a tag-name match (score 1) reads the element through the standard path", () => {
    const result = read('<fake-group id="g"><fake-leaf id="a" px="3" py="4" stroke="blue" data-x="1"/></fake-group>');
    expect(outline(result)).toEqual(["fake-group#g", "  fake-leaf#a data-x=1"]);
    const a = result.document().findById("a");
    expect(a?.geometryEntries()).toEqual([["px", "3"], ["py", "4"]]);
    expect(a?.styleEntries()).toEqual([["stroke", "blue"]]);
  });

  it("the highest score wins: the composite (2) over the tag-name match (1), whatever the registration order", () => {
    for (const providers of [[group(), new FakeCompositeProvider(), leaf()], [new FakeCompositeProvider(), group(), leaf()]]) {
      const result = read(COMPOSITE, ...providers);
      expect(outline(result)).toEqual(["composite#c", "  fake-leaf#c-part"]);
      expect(result.document().findById("c")?.styleEntries()).toEqual([["fill", "red"]]);
      expect(result.warnings()).toEqual([]);
    }
  });

  it("without the composite provider the same element is a plain container and keeps data-kind as pass-through", () => {
    expect(outline(read(COMPOSITE))).toEqual(["fake-group#c data-kind=composite", "  fake-leaf#c-part"]);
  });

  it("a tie at the top score rejects the whole read, naming the providers in registration order", () => {
    const twin = new ScriptedProvider("twin", (e) => (e.name() === "fake-leaf" ? 1 : 0));
    expect(errorOf(() => read('<fake-leaf id="a"/>', twin, leaf(), group()))).toBe(
      "cannot parse file: a.svg (ambiguous shape providers for fake-leaf: twin, fake-leaf)",
    );
  });

  it("a tie below the top score does not matter", () => {
    const twin = new ScriptedProvider("twin", (e) => (e.name() === "fake-group" ? 1 : 0));
    expect(outline(read(COMPOSITE, group(), twin, new FakeCompositeProvider(), leaf()))[0]).toBe("composite#c");
  });

  it("all scores 0: the element is skipped with its whole subtree, with one warning (F6)", () => {
    const result = read('<path id="p"><fake-leaf id="inner"/></path><fake-leaf id="a"/>');
    expect(outline(result)).toEqual(["fake-leaf#a"]);
    expect(result.warnings()).toEqual(["warning: skipped unsupported element <path>"]);
  });
});

describe("read-back: degradation with readWithNext", () => {
  it("hands the element to the next best untried provider, after the provider's own warning", () => {
    const result = read('<fake-group id="c" data-kind="composite"><fake-leaf id="other"/></fake-group>', group(), new FakeCompositeProvider(), leaf());
    expect(result.warnings()).toEqual(["warning: composite c read as plain fake-group: missing part"]);
    expect(outline(result)).toEqual(["fake-group#c data-kind=composite", "  fake-leaf#other"]);
  });

  it("with no provider left the element is skipped like an unsupported one", () => {
    const loner = new ScriptedProvider("loner", (e) => (e.name() === "odd" ? 1 : 0), (e, reader) => reader.readWithNext(e));
    const result = read('<odd id="o"/><fake-leaf id="a"/>', loner, leaf());
    expect(outline(result)).toEqual(["fake-leaf#a"]);
    expect(result.warnings()).toEqual(["warning: skipped unsupported element <odd>"]);
  });

  it("every element starts a fresh dispatch: providers tried for one element are not skipped for the next", () => {
    const body = '<fake-group id="c1" data-kind="composite"/><fake-group id="c2" data-kind="composite"><fake-leaf id="c2-part"/></fake-group>';
    const result = read(body, group(), new FakeCompositeProvider(), leaf());
    expect(outline(result)).toEqual(["fake-group#c1 data-kind=composite", "composite#c2", "  fake-leaf#c2-part"]);
  });
});

describe("read-back: requireUnique counts only imported elements, checked at the end", () => {
  const providers = () => [group(), new FakeCompositeProvider(), leaf()];

  it("a declared id that another imported element also has rejects the read", () => {
    const body = `${COMPOSITE}<fake-leaf id="c-part"/>`;
    expect(errorOf(() => read(body, ...providers()))).toBe("cannot parse file: a.svg (duplicate id c-part)");
  });

  it("the same duplicate without a declaration is renamed with a warning (F14 unchanged)", () => {
    const result = read('<fake-leaf id="a"/><fake-leaf id="a"/>');
    expect(outline(result)).toEqual(["fake-leaf#a", "fake-leaf#fake-leaf1"]);
    expect(result.warnings()).toEqual(["warning: duplicate id a, reassigned to fake-leaf1"]);
  });

  it("an earlier imported element counts too (the check waits for the end of the read)", () => {
    const body = `<fake-leaf id="c"/>${COMPOSITE}`;
    expect(errorOf(() => read(body, ...providers()))).toBe("cannot parse file: a.svg (duplicate id c)");
  });

  it("a skipped unsupported element, or anything in its subtree, does not count", () => {
    const body = `${COMPOSITE}<path id="c-part"/><unknown><fake-leaf id="c"/></unknown>`;
    const result = read(body, ...providers());
    expect(outline(result)).toEqual(["composite#c", "  fake-leaf#c-part"]);
  });

  it("a child element that a leaf drops does not count", () => {
    const body = `${COMPOSITE}<fake-leaf id="x"><fake-leaf id="c-part"/></fake-leaf>`;
    const result = read(body, ...providers());
    expect(outline(result)).toEqual(["composite#c", "  fake-leaf#c-part", "fake-leaf#x"]);
    expect(result.warnings()).toEqual(["warning: skipped unsupported element <fake-leaf>"]);
  });

  it("degradation does not exempt: the declarations made before readWithNext still hold", () => {
    const body = '<fake-group id="c" data-kind="composite"/><fake-leaf id="c"/>';
    expect(errorOf(() => read(body, ...providers()))).toBe("cannot parse file: a.svg (duplicate id c)");
  });

  it("an element read after degradation is imported and counts", () => {
    const body = `<fake-group id="d" data-kind="composite"><fake-leaf id="c-part"/></fake-group>${COMPOSITE}`;
    expect(errorOf(() => read(body, ...providers()))).toBe("cannot parse file: a.svg (duplicate id c-part)");
  });

  it("with several breaches the first declaration is reported", () => {
    const body = `${COMPOSITE}<fake-leaf id="c-part"/><fake-leaf id="c"/>`;
    expect(errorOf(() => read(body, ...providers()))).toBe("cannot parse file: a.svg (duplicate id c)");
  });
});

describe("read-back: ShapeReader services", () => {
  it("applyAttributes skips id and the consumed names; style goes through setAttribute", () => {
    const shape = read(COMPOSITE, group(), new FakeCompositeProvider(), leaf()).document().findById("c");
    expect(shape?.extraEntries()).toEqual([]);
    expect(shape?.styleEntries()).toEqual([["fill", "red"]]);
  });

  it("an invalid style value rejects the read naming the attribute and element", () => {
    const body = '<fake-group id="c" data-kind="composite" stroke-width="-1"><fake-leaf id="c-part"/></fake-group>';
    expect(errorOf(() => read(body, group(), new FakeCompositeProvider(), leaf()))).toBe(
      'cannot parse file: a.svg (invalid value stroke-width="-1" on <fake-group>)',
    );
  });

  it("reject(detail) is the error that rejects the read; an EditorError from read passes unchanged", () => {
    const refuser = new ScriptedProvider("refuser", () => 1, (_e, reader) => {
      throw reader.reject("refused here");
    });
    expect(errorOf(() => read("<x/>", refuser))).toBe("cannot parse file: a.svg (refused here)");
    const plain = new ScriptedProvider("plain", () => 1, () => {
      throw new EditorError("own message");
    });
    expect(errorOf(() => read("<x/>", plain))).toBe("own message");
  });

  it("warn adds to the warnings in document order, allocateId follows F13", () => {
    const noter = new ScriptedProvider("noter", (e) => (e.name() === "x" ? 1 : 0), (e, reader) => {
      reader.warn("first");
      const shape = new FakeLeaf(reader.allocateId(e));
      reader.warn("second");
      return shape;
    });
    const result = read('<x/><fake-leaf id="x1"/>', noter, leaf());
    expect(result.warnings()).toEqual(["warning: first", "warning: assigned id x2 to unnamed <x>", "warning: second"]);
    expect(outline(result)).toEqual(["fake-leaf#x2", "fake-leaf#x1"]);
  });
});

describe("read-back: provider contract breaches reject the read", () => {
  const breaching = (score: (e: unknown) => unknown, readBack?: () => unknown) =>
    new ScriptedProvider("bad", score, readBack ?? (() => new FakeLeaf("never")));

  it.each<[string, unknown]>([
    ["negative", -1],
    ["fractional", 1.5],
    ["NaN", Number.NaN],
    ["a string", "2"],
    ["infinite", Number.POSITIVE_INFINITY],
  ])("matchScore returning %s", (_case, score) => {
    expect(errorOf(() => read("<x/>", breaching(() => score)))).toBe(
      `cannot parse file: a.svg (shape provider bad failed: matchScore returned ${String(score)})`,
    );
  });

  it("matchScore throwing", () => {
    const provider = breaching(() => {
      throw new Error("lost\nmore");
    });
    expect(errorOf(() => read("<x/>", provider))).toBe("cannot parse file: a.svg (shape provider bad failed: lost)");
  });

  it("read throwing a non-EditorError", () => {
    const provider = breaching(
      () => 1,
      () => {
        throw new TypeError("oops");
      },
    );
    expect(errorOf(() => read("<x/>", provider))).toBe("cannot parse file: a.svg (shape provider bad failed: oops)");
  });

  it("read returning something that is not a shape", () => {
    expect(errorOf(() => read("<x/>", breaching(() => 1, () => "shape")))).toBe(
      "cannot parse file: a.svg (shape provider bad failed: read must return a shape or null)",
    );
  });

  it("read returning an attached shape", () => {
    const attached = () => {
      const holder = new FakeContainer("h");
      const shape = new FakeLeaf("a");
      holder.insertAt(shape, 0);
      return shape;
    };
    expect(errorOf(() => read("<x/>", breaching(() => 1, attached)))).toBe(
      "cannot parse file: a.svg (shape provider bad failed: read returned an attached shape)",
    );
  });
});
