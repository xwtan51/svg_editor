import { describe, expect, it } from "vitest";
import { XmlAttributeDecoder } from "../../src/core/XmlAttributeDecoder.js";

const decoder = new XmlAttributeDecoder();

describe("XmlAttributeDecoder (VA17)", () => {
  it("decodes the five predefined entities", () => {
    expect(decoder.decode("a&amp;b &lt;&gt; &quot;&apos;")).toBe(`a&b <> "'`);
  });

  it("decodes decimal and hexadecimal character references", () => {
    expect(decoder.decode("&#65;&#x42;&#x1F600;")).toBe("AB😀");
  });

  it("decodes once: &amp;lt; is the text &lt;, not <", () => {
    expect(decoder.decode("&amp;lt;")).toBe("&lt;");
  });

  it("keeps unknown entities, invalid character references and a lone & literally", () => {
    expect(decoder.decode("&nbsp;")).toBe("&nbsp;");
    expect(decoder.decode("&#0;&#xD800;&#x110000;")).toBe("&#0;&#xD800;&#x110000;");
    expect(decoder.decode("a & b")).toBe("a & b");
    expect(decoder.decode("&amp")).toBe("&amp");
  });

  it("normalises literal tabs and line breaks to spaces, \\r\\n counting once", () => {
    expect(decoder.decode("a\tb\nc\r\nd\re")).toBe("a b c d e");
  });

  it("keeps a line feed written as a character reference", () => {
    expect(decoder.decode("a&#10;b")).toBe("a\nb");
  });
});
