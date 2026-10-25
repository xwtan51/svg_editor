import { afterEach, describe, expect, it, vi } from "vitest";
import { XmlDomAdapter } from "../../../src/io/XmlDomAdapter.js";
import { EditorError } from "../../../src/model/EditorError.js";

function parse(text: string) {
  return new XmlDomAdapter().parse(text);
}

describe("XmlDomAdapter", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("converts elements with local names, attributes in document order and child elements", () => {
    const root = parse('<svg xmlns="http://www.w3.org/2000/svg" b="2" a="1"><s:rect xmlns:s="http://www.w3.org/2000/svg" z="&amp;&lt;" id="r"/><g/></svg>');
    expect(root.name()).toBe("svg");
    expect(root.attributes()).toEqual([
      ["xmlns", "http://www.w3.org/2000/svg"],
      ["b", "2"],
      ["a", "1"],
    ]);
    expect(root.children().map((c) => c.name())).toEqual(["rect", "g"]);
    expect(root.children()[0]?.attributes()).toEqual([
      ["xmlns:s", "http://www.w3.org/2000/svg"],
      ["z", "&<"],
      ["id", "r"],
    ]);
    expect(root.children()[0]?.attribute("id")).toBe("r");
    expect(root.children()[0]?.attribute("missing")).toBeUndefined();
  });

  it("collects text and CDATA of the whole subtree in order, dropping comments and processing instructions", () => {
    const root = parse("<text>a<!-- c --><?pi x?><b>b<i>i</i></b><![CDATA[<c>]]>&#x4e2d;</text>");
    expect(root.text()).toBe("abi<c>中");
    expect(root.children()[0]?.text()).toBe("bi");
  });

  it("knows the prefixes in scope at each element", () => {
    const root = parse('<svg xmlns:a="urn:a"><g xmlns:b="urn:b" xmlns:a="urn:a2"><rect/></g><circle/></svg>');
    const [g, circle] = root.children();
    expect(root.namespaceUri("a")).toBe("urn:a");
    expect(g?.children()[0]?.namespaceUri("a")).toBe("urn:a2");
    expect(g?.children()[0]?.namespaceUri("b")).toBe("urn:b");
    expect(circle?.namespaceUri("b")).toBeUndefined();
  });

  it("lists the root and all descendants in document order", () => {
    const root = parse("<a><b><c/></b><d/></a>");
    expect(root.descendantsAndSelf().map((e) => e.name())).toEqual(["a", "b", "c", "d"]);
  });

  it("accepts a DOCTYPE and an XML declaration", () => {
    expect(parse('<?xml version="1.0" encoding="UTF-8"?>\n<!DOCTYPE svg>\n<svg/>').name()).toBe("svg");
  });

  it("ignores library warnings (an unquoted attribute value is only a warning in xmldom)", () => {
    expect(parse("<svg a=1/>").attribute("a")).toBe("1");
  });

  it("turns library errors into an EditorError without printing anything", () => {
    const spies = (["log", "info", "warn", "error", "debug"] as const).map((m) =>
      vi.spyOn(console, m).mockImplementation(() => {}),
    );
    for (const text of ["<svg><rect></svg>", "", "<svg>&foo;</svg>", "<svg/>x", '<svg a="1" a="2"/>']) {
      expect(() => parse(text)).toThrow(EditorError);
      expect(() => parse(text)).toThrow(/^malformed XML: /);
    }
    for (const spy of spies) {
      expect(spy).not.toHaveBeenCalled();
    }
  });
});
