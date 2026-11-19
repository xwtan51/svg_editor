import { EditorError } from "@svgframe/kernel";
import { describe, expect, it } from "vitest";
import { DirCommand } from "../src/DirCommand.js";
import { DirectoryEntry } from "../src/DirectoryEntry.js";
import { FakeDirectoryLister } from "./doubles/FakeDirectoryLister.js";
import { FakeWorkingDirectory } from "./doubles/FakeWorkingDirectory.js";
import { TestEditor } from "./doubles/TestEditor.js";
import { UntouchableContext } from "./doubles/UntouchableContext.js";

/**
 * The Client of the Adapter pattern against stand-ins for both Targets (spec
 * §2.2, §2.3; design §8.2): output format, order, empty directory, hidden
 * entries and the read failure. The context is a double that throws on every
 * call, so each of these runs also shows that `execute` never touches it.
 */
describe("DirCommand", () => {
  const CWD = "/work/project";

  function dir(lister: FakeDirectoryLister, cwd: string = CWD): string[] {
    return new DirCommand(lister, new FakeWorkingDirectory(cwd)).execute(new UntouchableContext()).lines();
  }

  function entries(names: readonly string[], directory: boolean): DirectoryEntry[] {
    return names.map((name) => new DirectoryEntry(name, directory));
  }

  it("prints the example of spec §2.2 byte for byte", () => {
    const lister = FakeDirectoryLister.holding(["plugins", "docs"], ["package.json", "demo.svg"]);
    expect(dir(lister).join("\n")).toBe(["[DIR]  docs", "[DIR]  plugins", "[FILE] demo.svg", "[FILE] package.json"].join("\n"));
  });

  it("lists the working directory the port answers, once", () => {
    const lister = FakeDirectoryLister.holding([], ["a"]);
    dir(lister, "/somewhere/else");
    expect(lister.paths()).toEqual(["/somewhere/else"]);
  });

  it("puts directories before files whatever order they come in", () => {
    const mixed = [
      new DirectoryEntry("b.txt", false),
      new DirectoryEntry("src", true),
      new DirectoryEntry("a.txt", false),
      new DirectoryEntry("assets", true),
      new DirectoryEntry("z", false),
    ];
    expect(dir(FakeDirectoryLister.listing(mixed))).toEqual(["[DIR]  assets", "[DIR]  src", "[FILE] a.txt", "[FILE] b.txt", "[FILE] z"]);
  });

  it("an empty directory gives `(empty directory)`", () => {
    expect(dir(FakeDirectoryLister.listing([]))).toEqual(["(empty directory)"]);
  });

  it("lists hidden entries, files and directories alike", () => {
    expect(dir(FakeDirectoryLister.holding([".git", "src"], [".hidden", "a.svg"]))).toEqual([
      "[DIR]  .git",
      "[DIR]  src",
      "[FILE] .hidden",
      "[FILE] a.svg",
    ]);
  });

  it("a failed read is the EditorError `cannot read directory: <path>`, with the path the port gave", () => {
    const run = () => dir(FakeDirectoryLister.failing(), "/no/such/dir");
    expect(run).toThrow(EditorError);
    expect(run).toThrow(/^cannot read directory: \/no\/such\/dir$/);
  });

  it("the message carries no `error:` prefix; the editor adds it and goes on with the next line (P7)", () => {
    const editor = TestEditor.create(FakeDirectoryLister.failing(), new FakeWorkingDirectory("/x"));
    expect(editor.run("dir")).toEqual(["error: cannot read directory: /x"]);
    expect(editor.run("add a")).toEqual(["error: no document. use 'init' or 'read' first"]);
  });

  it("sorts each group by UTF-16 code unit, not by localeCompare", () => {
    const names = ["demo.svg", "README.md", ".hidden", "b", "Zeta", "_x", "a-b", "a.b", "aB", "ab"];
    const output = dir(FakeDirectoryLister.listing([...entries(names, true), ...entries(names, false)]));
    const order = [".hidden", "README.md", "Zeta", "_x", "a-b", "a.b", "aB", "ab", "b", "demo.svg"];
    expect(output).toEqual([...order.map((name) => `[DIR]  ${name}`), ...order.map((name) => `[FILE] ${name}`)]);
    const byLocale = [...names].sort((a, b) => a.localeCompare(b));
    expect(byLocale).not.toEqual(order);
  });

  it("non-ASCII names: code units, not code points and not the locale", () => {
    // "ｚ" is U+FF5A; "😀" is U+1F600, stored as the surrogates D83D DE00, so it sorts before "ｚ" by code unit
    // although its code point is larger. "é" (U+00E9) sorts after every ASCII letter.
    const names = ["ｚ", "é", "😀", "e", "Z"];
    expect(dir(FakeDirectoryLister.holding([], names))).toEqual(["[FILE] Z", "[FILE] e", "[FILE] é", "[FILE] 😀", "[FILE] ｚ"]);
  });

  it("the same entries in any order give the same output (stable)", () => {
    const all = [
      ...entries(["docs", "Plugins", ".config", "b"], true),
      ...entries(["demo.svg", "README.md", ".hidden", "package.json", "_"], false),
    ];
    const expected = dir(FakeDirectoryLister.listing(all));
    let seed = 7;
    for (let round = 0; round < 25; round++) {
      const shuffled = [...all];
      for (let i = shuffled.length - 1; i > 0; i--) {
        seed = (seed * 1103515245 + 12345) % 2147483648;
        const j = seed % (i + 1);
        [shuffled[i], shuffled[j]] = [shuffled[j] as DirectoryEntry, shuffled[i] as DirectoryEntry];
      }
      expect(dir(FakeDirectoryLister.listing(shuffled))).toEqual(expected);
    }
    expect(dir(FakeDirectoryLister.listing([...all].reverse()))).toEqual(expected);
  });

  it("aligns the names: `[DIR]` plus two spaces, `[FILE]` plus one, so every name starts at index 7 (X27, T2)", () => {
    const output = dir(FakeDirectoryLister.holding(["d"], ["f"]));
    expect(output).toEqual(["[DIR]  d", "[FILE] f"]);
    for (const line of output) {
      expect(line.slice(0, 7)).toMatch(/^\[(DIR\] |FILE\])\s$/);
      expect(line.slice(7)).not.toMatch(/^\s/);
    }
  });

  it("names are printed as they are: spaces, brackets and leading dashes stay", () => {
    expect(dir(FakeDirectoryLister.holding(["my dir"], [" lead", "-x", "[FILE] y"]))).toEqual([
      "[DIR]  my dir",
      "[FILE]  lead",
      "[FILE] -x",
      "[FILE] [FILE] y",
    ]);
  });

  it("takes no argument: `dir x` is `usage: dir`", () => {
    const editor = TestEditor.create(FakeDirectoryLister.holding([], ["a"]), new FakeWorkingDirectory(CWD));
    expect(editor.run("dir x")).toEqual(["error: usage: dir"]);
    expect(editor.run("dir 1 2")).toEqual(["error: usage: dir"]);
    expect(editor.run("dir")).toEqual(["[FILE] a"]);
  });

  it("execute calls no method of the context, also when the read fails", () => {
    const failing = new DirCommand(FakeDirectoryLister.failing(), new FakeWorkingDirectory(CWD));
    expect(() => failing.execute(new UntouchableContext())).toThrow(EditorError);
    expect(dir(FakeDirectoryLister.holding(["d"], []))).toEqual(["[DIR]  d"]);
    expect(dir(FakeDirectoryLister.listing([]))).toEqual(["(empty directory)"]);
  });
});
