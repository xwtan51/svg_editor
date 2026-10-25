import { readdirSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { SvgImporter } from "../../src/io/SvgImporter.js";
import { SvgSerializer } from "../../src/io/SvgSerializer.js";
import { TranscriptRunner } from "./TranscriptRunner.js";

/** Every transcript in tests/transcripts/, in name order. */
const NAMES = readdirSync(TranscriptRunner.DIRECTORY)
  .filter((name) => name.endsWith(".txt"))
  .sort();

/** Files each transcript saves, with the element count its `saved to …` line reports (F17). */
const SAVED: Readonly<Record<string, readonly (readonly [string, number])[]>> = {
  "spec-6.txt": [["demo.svg", 5]],
  "spec-6-1.txt": [["flowchart.svg", 8]],
};

describe("transcript files", () => {
  it("include the sessions of spec §6 and §6.1", () => {
    expect(NAMES).toEqual(expect.arrayContaining(["spec-6.txt", "spec-6-1.txt"]));
  });

  it.each(NAMES)("%s starts with an input and has no blank lines", (name) => {
    expect(TranscriptRunner.load(name).steps.length).toBeGreaterThan(0);
  });

  it("the parser reports where the format is broken", () => {
    expect(() => TranscriptRunner.parse("x.txt", "svg> init")).toThrow("x.txt: does not end with a newline");
    expect(() => TranscriptRunner.parse("x.txt", "out\n")).toThrow("x.txt:1: output before the first input");
    expect(() => TranscriptRunner.parse("x.txt", "svg> init\n\nout\n")).toThrow("x.txt:2: blank line");
    expect(TranscriptRunner.parse("x.txt", "svg> # c\nsvg> init\na\nb\n")).toEqual([
      { input: { lineNumber: 1, text: "# c" }, expected: [] },
      {
        input: { lineNumber: 2, text: "init" },
        expected: [
          { lineNumber: 3, text: "a" },
          { lineNumber: 4, text: "b" },
        ],
      },
    ]);
  });
});

// Each input is one test case; the cases of a file share one editor and run in file order.
describe.each(NAMES)("%s through Editor.executeLine", (name) => {
  const runner = TranscriptRunner.load(name);

  for (const step of runner.steps) {
    it(`line ${step.input.lineNumber}: ${TranscriptRunner.PROMPT}${step.input.text}`, () => {
      const actual = runner.run(step);
      expect(actual, runner.mismatch(step, actual) ?? undefined).toEqual(step.expected.map((line) => line.text));
    });
  }

  for (const [path, count] of SAVED[name] ?? []) {
    it(`${path} written by save can be read back by SvgImporter`, () => {
      const saved = runner.files.readText(path);
      const imported = new SvgImporter().read(runner.files, path);
      expect(imported.warnings()).toEqual([]);
      expect(imported.document().elementCount()).toBe(count);
      // Reading back loses nothing: writing the imported document gives the same bytes.
      expect(new SvgSerializer().serialize(imported.document())).toBe(saved);
    });
  }
});
