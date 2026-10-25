import { describe, expect, it } from "vitest";
import { ArgList } from "../../../src/commands/ArgList.js";
import { Tokenizer } from "../../../src/commands/Tokenizer.js";
import { EditorError } from "../../../src/model/EditorError.js";

const MOVE_USAGE = "move <id> <dx> <dy>";

function args(text: string, usage = MOVE_USAGE): ArgList {
  return new ArgList(new Tokenizer().tokenize(text), usage);
}

function errorOf(action: () => unknown): string {
  try {
    action();
  } catch (error) {
    expect(error).toBeInstanceOf(EditorError);
    return (error as Error).message;
  }
  throw new Error("no error");
}

describe("ArgList", () => {
  it("reads ids, numbers and raw values in order", () => {
    const list = args('c1 -1.5 1e3 "a b"');
    expect(list.remaining()).toBe(4);
    expect(list.nextId()).toBe("c1");
    expect(list.nextNumber()).toBe(-1.5);
    expect(list.nextNumber()).toBe(1000);
    expect(list.nextRaw()).toBe("a b");
    expect(list.remaining()).toBe(0);
    list.expectEnd();
  });

  it("reports a missing argument as a usage error with the command's syntax (R7)", () => {
    const list = args("c1 30");
    expect(errorOf(() => list.expectCount(3))).toBe("usage: move <id> <dx> <dy>");
    list.nextId();
    list.nextNumber();
    expect(errorOf(() => list.nextNumber())).toBe("usage: move <id> <dx> <dy>");
  });

  it("reports extra arguments as a usage error (R9)", () => {
    expect(errorOf(() => args("c1 30 0 7").expectCount(3))).toBe("usage: move <id> <dx> <dy>");
    expect(errorOf(() => args("3", "undo").expectEnd())).toBe("usage: undo");
  });

  it("expectAtLeast accepts more and rejects fewer", () => {
    const usage = "group <newGid> <id1> <id2>…";
    args("g a b c", usage).expectAtLeast(2);
    expect(errorOf(() => args("g", usage).expectAtLeast(2))).toBe("usage: group <newGid> <id1> <id2>…");
  });

  it("checking the count first reports the count before a bad number (R10)", () => {
    expect(errorOf(() => args("c1 abc").expectCount(3))).toBe("usage: move <id> <dx> <dy>");
  });

  it.each(["0x10", "Infinity", "-Infinity", "NaN", "1,5", "1e", "--1", "abc", "1e999", ""])(
    "rejects the number %j (R8)",
    (token) => {
      const list = new ArgList(new Tokenizer().tokenize(`"${token}"`), MOVE_USAGE);
      expect(errorOf(() => list.nextNumber())).toBe(`invalid number: ${token}`);
    },
  );

  it.each([
    ["-1.5", -1.5],
    [".5", 0.5],
    ["1e3", 1000],
    ["+2", 2],
    ["3.", 3],
    ["-0", -0],
  ])("accepts the number %s (R8)", (token, value) => {
    expect(args(token).nextNumber()).toBe(value);
  });

  it("rest() returns and consumes the remaining texts", () => {
    const list = args('rect r1 0 0 "x y"');
    list.nextRaw();
    expect(list.rest()).toEqual(["r1", "0", "0", "x y"]);
    expect(list.remaining()).toBe(0);
  });

  describe("in clause (E2, R6)", () => {
    it("takes an unquoted in as the second-to-last token", () => {
      const list = args("rect r1 0 0 1 1 in g1");
      expect(list.takeInClause()).toBe("g1");
      expect(list.rest()).toEqual(["rect", "r1", "0", "0", "1", "1"]);
    });

    it("ignores a quoted \"in\"", () => {
      const list = args('text t 0 0 "in" g1');
      expect(list.takeInClause()).toBeNull();
      expect(list.remaining()).toBe(6);
    });

    it("ignores in anywhere but second-to-last", () => {
      expect(args("text t 0 0 in").takeInClause()).toBeNull();
      expect(args("in g1 x").takeInClause()).toBeNull();
    });

    it("takes a clause whose container id is quoted", () => {
      expect(args('g a in "g1"').takeInClause()).toBe("g1");
    });

    it("takes the clause even when nothing precedes it", () => {
      const list = args("in g1");
      expect(list.takeInClause()).toBe("g1");
      expect(list.remaining()).toBe(0);
    });

    it("finds nothing in fewer than two tokens", () => {
      expect(args("in").takeInClause()).toBeNull();
      expect(args("").takeInClause()).toBeNull();
    });
  });
});
