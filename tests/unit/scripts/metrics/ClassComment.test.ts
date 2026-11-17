import { describe, expect, it } from "vitest";
import { ClassComment } from "../../../../scripts/metrics/ClassComment.js";

const sentence = (comment: string) => ClassComment.of(`${comment}\nexport class X {}\n`)?.firstSentence();

describe("ClassComment.of: which comment is the class comment", () => {
  it("the /** */ block right above the first export declaration", () => {
    const source = 'import { A } from "./A.js";\n\n/** Not this one. */\nconst helper = 1;\n\n/** The class. */\nexport abstract class X {}\n/** Later. */\nexport class Y {}\n';
    expect(ClassComment.of(source)?.firstSentence()).toBe("The class.");
  });

  it("works for interfaces, types and default-exported classes", () => {
    expect(ClassComment.of("/** I. */\nexport interface I {}\n")?.firstSentence()).toBe("I.");
    expect(ClassComment.of("/** T. */\nexport type T = string;\n")?.firstSentence()).toBe("T.");
    expect(ClassComment.of("/** P. */\nexport default class P {}\n")?.firstSentence()).toBe("P.");
  });

  it("no comment, a blank line in between, a // comment, a /* */ comment, or a comment after code: none", () => {
    expect(ClassComment.of("export class X {}\n")).toBeNull();
    expect(ClassComment.of("/** Doc. */\n\nexport class X {}\n")).toBeNull();
    expect(ClassComment.of("// Doc.\nexport class X {}\n")).toBeNull();
    expect(ClassComment.of("/* Doc. */\nexport class X {}\n")).toBeNull();
    expect(ClassComment.of("/** Doc. */\n// more\nexport class X {}\n")).toBeNull();
    expect(ClassComment.of("const a = 1; /** Doc. */\nexport class X {}\n")).toBeNull();
  });

  it("text such as plugins/* or /** inside the comment does not confuse it", () => {
    expect(ClassComment.of("/**\n * Scans `plugins/*` and `/**` blocks.\n */\nexport class X {}\n")?.firstSentence()).toBe(
      "Scans `plugins/*` and `/**` blocks.",
    );
  });

  it("a file without export declarations: the /** */ block it starts with", () => {
    expect(ClassComment.of('/** Entry. */\nexport { A } from "./A.js";\nexport type { B } from "./B.js";\n')?.firstSentence()).toBe("Entry.");
    expect(ClassComment.of('/**\n * Program entry point.\n */\nimport { A } from "./A.js";\nnew A();\n')?.firstSentence()).toBe("Program entry point.");
    expect(ClassComment.of('// Entry.\nexport { A } from "./A.js";\n')).toBeNull();
    expect(ClassComment.of('\n/** Entry. */\nexport * from "./A.js";\n')).toBeNull();
  });
});

describe("ClassComment.firstSentence", () => {
  it("ends at a period followed by white space", () => {
    expect(sentence("/** One line. Two lines. */")).toBe("One line.");
  });

  it("ends at a period at the end of the comment, or takes the whole text without one", () => {
    expect(sentence("/** Only one. */")).toBe("Only one.");
    expect(sentence("/** No period at all */")).toBe("No period at all");
  });

  it("joins the lines of a paragraph with single spaces", () => {
    expect(sentence("/**\n * A long sentence\n *   over two lines. Rest.\n */")).toBe("A long sentence over two lines.");
  });

  it("ends at a blank line", () => {
    expect(sentence("/**\n * Title without period\n *\n * Body. More.\n */")).toBe("Title without period");
  });

  it("a period inside backticks does not end it", () => {
    expect(sentence("/** Entry of `api.ts`, see `Editor.run`. Rest. */")).toBe("Entry of `api.ts`, see `Editor.run`.");
    expect(sentence("/** Calls `a. b` here. */")).toBe("Calls `a. b` here.");
  });

  it("abbreviations such as e.g. and i.e. do not end it", () => {
    expect(sentence("/** A size (e.g. width), i.e. a number. Rest. */")).toBe("A size (e.g. width), i.e. a number.");
  });

  it("a period not followed by white space (§5.3, 1.5, file.ts) does not end it", () => {
    expect(sentence("/** See §5.3 and file.ts now. Rest. */")).toBe("See §5.3 and file.ts now.");
  });

  it("a Markdown list starts a new block; a @tag line ends the text", () => {
    expect(sentence("/**\n * The detail (V6):\n * 1. first;\n * 2. second.\n */")).toBe("The detail (V6):");
    expect(sentence("/**\n * Splits a line:\n * - one;\n * - two.\n */")).toBe("Splits a line:");
    expect(sentence("/**\n * Summary without period\n * @param a the a\n */")).toBe("Summary without period");
  });
});
