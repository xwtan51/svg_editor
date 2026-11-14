import { describe, expect, it } from "vitest";
import { XmlEndTag } from "../../src/core/XmlEndTag.js";
import { XmlStartTag } from "../../src/core/XmlStartTag.js";
import { XmlSyntaxError } from "../../src/core/XmlSyntaxError.js";
import { XmlTokenizer } from "../../src/core/XmlTokenizer.js";

type Token = XmlStartTag | XmlEndTag;

function tokens(text: string): Token[] {
  const tokenizer = new XmlTokenizer(text);
  const all: Token[] = [];
  for (let token = tokenizer.next(); token !== undefined; token = tokenizer.next()) {
    all.push(token);
  }
  return all;
}

/** `<name` / `</name` / `<name/` plus the source text of the token's span. */
function describeTokens(text: string): string[] {
  return tokens(text).map((t) => {
    const source = text.slice(t.span().start(), t.span().end());
    if (t instanceof XmlEndTag) return `</${t.name()} ${source}`;
    return `<${t.name()}${t.isSelfClosing() ? "/" : ""} ${source}`;
  });
}

function errorOf(text: string): XmlSyntaxError {
  try {
    tokens(text);
  } catch (error) {
    if (error instanceof XmlSyntaxError) return error;
    throw error;
  }
  throw new Error(`no syntax error in ${JSON.stringify(text)}`);
}

describe("XmlTokenizer: what it reports", () => {
  it("start, empty-element and end tags with exact spans", () => {
    expect(describeTokens('<svg a="1">\n  <rect/>\n</svg>')).toEqual([
      '<svg <svg a="1">',
      "<rect/ <rect/>",
      "</svg </svg>",
    ]);
  });

  it("the name span covers exactly the tag name", () => {
    const text = '  <svg:rect id="x"/>';
    const [tag] = tokens(text) as [XmlStartTag];
    expect(text.slice(tag.nameSpan().start(), tag.nameSpan().end())).toBe("svg:rect");
  });

  it("white space inside tags: around =, before > and />, after the end-tag name", () => {
    expect(describeTokens("<g\n\tid = 'a'\n></g >")).toEqual(["<g <g\n\tid = 'a'\n>", "</g </g >"]);
    expect(tokens("<g id = 'a' />").map((t) => (t as XmlStartTag).attribute("id"))).toEqual(["a"]);
  });

  it("'>' and the other quote inside an attribute value do not end the tag", () => {
    const [tag] = tokens(`<text data-x="a > b" title='say "hi"'>`) as [XmlStartTag];
    expect(tag.attribute("data-x")).toBe("a > b");
    expect(tag.attribute("title")).toBe('say "hi"');
  });

  it("attribute values are decoded; the first of duplicate attributes wins", () => {
    const [tag] = tokens('<rect id="a&amp;b" id="second"/>') as [XmlStartTag];
    expect(tag.attribute("id")).toBe("a&b");
  });

  it("attribute lookup is exact: svg:id and ID are not id", () => {
    const [tag] = tokens('<rect svg:id="a" ID="b"/>') as [XmlStartTag];
    expect(tag.attribute("id")).toBeUndefined();
  });

  it("names: XML Name characters, including non-ASCII, '.', '-' and digits after the first", () => {
    expect(tokens("<é.x-1_a:b/>").map((t) => t.name())).toEqual(["é.x-1_a:b"]);
  });
});

describe("XmlTokenizer: what it skips (VA21)", () => {
  it("XML declaration, processing instructions, comments, CDATA and text", () => {
    const text = [
      '<?xml version="1.0" encoding="UTF-8"?>',
      "<?xml-stylesheet href='a.css'?>",
      "<!-- <rect id='commented'/> -->",
      "<svg>",
      "  text & more > text",
      "  <![CDATA[ <rect id='cdata'/> ]]>",
      "  <?pi <rect/> ?>",
      "</svg>",
    ].join("\n");
    expect(tokens(text).map((t) => t.name())).toEqual(["svg", "svg"]);
  });

  it("DOCTYPE with public id, quoted '>' and an internal subset with '>' , comments and quotes", () => {
    const text = [
      '<!DOCTYPE svg PUBLIC "-//W3C//DTD SVG 1.1//EN" "http://www.w3.org/Graphics/SVG/1.1/DTD/svg11.dtd" [',
      '  <!ENTITY arrow "->">',
      "  <!-- a comment with ] and > and ' -->",
      "  <?pi ] > ?>",
      "  <!ATTLIST rect x CDATA '>'>",
      "]>",
      "<svg/>",
    ].join("\n");
    expect(tokens(text).map((t) => t.name())).toEqual(["svg"]);
  });

  it("a BOM before the root is just text", () => {
    expect(tokens("﻿<svg/>").map((t) => t.name())).toEqual(["svg"]);
  });

  it("empty text and text without markup yield no tokens", () => {
    expect(tokens("")).toEqual([]);
    expect(tokens("just text > here")).toEqual([]);
  });
});

describe("XmlTokenizer: syntax errors at the start of the broken construct (VA16)", () => {
  const cases: [string, string, RegExp][] = [
    ["unterminated comment", "<svg><!-- no end", /unterminated comment/],
    ["'<!-->' is not a complete comment", "<svg><!-->", /unterminated comment/],
    ["unterminated CDATA", "<svg><![CDATA[ x ]>", /unterminated CDATA/],
    ["unterminated processing instruction", "<svg><?pi ", /unterminated processing instruction/],
    ["unknown <! declaration", "<svg><!ELEMENT x>", /unknown markup declaration/],
    ["'<' followed by a space", "<svg>< rect/>", /tag name after '<'/],
    ["'<' followed by a digit", "<svg><1/>", /tag name after '<'/],
    ["start tag cut off", "<svg><rect x=\"1\"", /unterminated start tag <rect/],
    ["attribute without white space before it", '<svg><rect x="1"y="2"/>', /expected white space/],
    ["attribute without value", "<svg><rect hidden/>", /has no value/],
    ["unquoted value", "<svg><rect x=1/>", /not quoted/],
    ["value cut off at the next tag", '<svg><rect id="a/>\n<circle/>', /not terminated/],
    ["value cut off at the end", '<svg><rect id="a', /not terminated/],
    ["end tag without name", "<svg></ >", /tag name after '<\/'/],
    ["end tag cut off", "<svg></svg", /unterminated end tag/],
  ];

  it.each(cases)("%s", (_title, text, message) => {
    const error = errorOf(text);
    expect(error.message).toMatch(message);
    expect(error.offset()).toBe(5);
  });

  it("a DOCTYPE error points at <!DOCTYPE: open subset, open literal, open comment in the subset", () => {
    for (const text of ["xx<!DOCTYPE svg [ <!ENTITY a '>'> ", 'xx<!DOCTYPE svg "unclosed', "xx<!DOCTYPE svg [ <!-- ]> "]) {
      const error = errorOf(text);
      expect(error.message).toMatch(/unterminated DOCTYPE/);
      expect(error.offset()).toBe(2);
    }
  });
});
