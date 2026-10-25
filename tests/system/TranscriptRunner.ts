import { readFileSync } from "node:fs";
import { Editor } from "../../src/app/Editor.js";
import { EditorSession } from "../../src/app/EditorSession.js";
import { CommandRegistry } from "../../src/commands/CommandRegistry.js";
import { ShapeFactory } from "../../src/model/ShapeFactory.js";
import { MemoryFileSystem } from "../unit/io/MemoryFileSystem.js";

/** One line of a transcript file, with its 1-based line number. */
export interface TranscriptLine {
  readonly lineNumber: number;
  readonly text: string;
}

/** One `svg> ` input and the output lines that follow it (format: tests/transcripts/README.md). */
export interface TranscriptStep {
  readonly input: TranscriptLine;
  readonly expected: readonly TranscriptLine[];
}

/**
 * Plays a transcript of tests/transcripts/ against a real `Editor` assembled
 * from an `EditorSession` on an in-memory file system that already holds
 * `other.svg` (the fixture of spec §6). Each step is run on its own, in file
 * order, so a test framework can report every input as a separate case.
 */
export class TranscriptRunner {
  static readonly DIRECTORY = new URL("../transcripts/", import.meta.url);
  static readonly PROMPT = "svg> ";

  /** `other.svg` of spec §6, copied verbatim. */
  static readonly OTHER_SVG = readFileSync(new URL("fixtures/other.svg", TranscriptRunner.DIRECTORY), "utf8");

  readonly name: string;
  readonly steps: readonly TranscriptStep[];
  readonly files: MemoryFileSystem;
  readonly session: EditorSession;
  private readonly editor: Editor;

  constructor(name: string, text: string) {
    this.name = name;
    this.steps = TranscriptRunner.parse(name, text);
    this.files = new MemoryFileSystem({ "other.svg": TranscriptRunner.OTHER_SVG });
    this.session = new EditorSession(this.files, new CommandRegistry(), new ShapeFactory());
    this.editor = new Editor(this.session);
  }

  /** A runner for `tests/transcripts/<name>`. */
  static load(name: string): TranscriptRunner {
    return new TranscriptRunner(name, readFileSync(new URL(name, TranscriptRunner.DIRECTORY), "utf8"));
  }

  /**
   * Splits the file into steps: a line starting with `svg> ` is an input, the
   * lines up to the next one are its expected output. The file must end with a
   * newline and start with an input; a blank line is rejected because the format
   * has none (an output line can never be empty in this phase).
   */
  static parse(name: string, text: string): TranscriptStep[] {
    if (!text.endsWith("\n")) {
      throw new Error(`${name}: does not end with a newline`);
    }
    const steps: { input: TranscriptLine; expected: TranscriptLine[] }[] = [];
    text
      .slice(0, -1)
      .split("\n")
      .forEach((line, i) => {
        const lineNumber = i + 1;
        if (line.startsWith(TranscriptRunner.PROMPT)) {
          steps.push({ input: { lineNumber, text: line.slice(TranscriptRunner.PROMPT.length) }, expected: [] });
          return;
        }
        if (line === "" || line.includes("\r")) {
          throw new Error(`${name}:${lineNumber}: blank line or CR, not allowed by the transcript format`);
        }
        const current = steps[steps.length - 1];
        if (current === undefined) {
          throw new Error(`${name}:${lineNumber}: output before the first input`);
        }
        current.expected.push({ lineNumber, text: line });
      });
    return steps;
  }

  /** Every input line of the transcript, in order (what a user would type). */
  inputs(): string[] {
    return this.steps.map((step) => step.input.text);
  }

  /** Every expected output line of the transcript, in order. */
  outputs(): string[] {
    return this.steps.flatMap((step) => step.expected.map((line) => line.text));
  }

  /** Hands the step's input to `Editor.executeLine` and returns what it printed. */
  run(step: TranscriptStep): string[] {
    return this.editor.executeLine(step.input.text);
  }

  /**
   * `null` when `actual` equals the step's expected output line for line;
   * otherwise a message naming the first differing line by its line number in
   * the transcript file.
   */
  mismatch(step: TranscriptStep, actual: readonly string[]): string | null {
    const where = (lineNumber: number) => `${this.name}:${lineNumber}`;
    const count = Math.max(actual.length, step.expected.length);
    for (let i = 0; i < count; i++) {
      const expected = step.expected[i];
      const got = actual[i];
      if (expected === undefined) {
        return `${where(step.input.lineNumber)} (${TranscriptRunner.PROMPT}${step.input.text}): unexpected extra output line ${i + 1}: ${JSON.stringify(got)}`;
      }
      if (got === undefined) {
        return `${where(expected.lineNumber)}: missing output line, expected ${JSON.stringify(expected.text)}`;
      }
      if (got !== expected.text) {
        return `${where(expected.lineNumber)}: expected ${JSON.stringify(expected.text)}, got ${JSON.stringify(got)}`;
      }
    }
    return null;
  }
}
