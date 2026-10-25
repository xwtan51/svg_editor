import { createInterface, type Interface } from "node:readline";
import type { Readable, Writable } from "node:stream";
import type { Editor } from "../app/Editor.js";

/**
 * The read–eval–print loop (README §1.2): prints the banner, then hands every
 * input line unchanged to the `Editor` and writes the lines it returns. It
 * does no parsing of its own; comments and blank lines are the Editor's job (R2, R3).
 *
 * - The `svg> ` prompt is printed only for an interactive (TTY) input (R1).
 * - Errors and warnings are ordinary output lines on stdout (R12); after an
 *   error the loop goes on with the next line (R14).
 * - EOF or Ctrl-C ends the loop with exit code 0 (R13).
 * - An exception escaping the Editor is a programming error: the document may
 *   be half-changed, so the loop reports it on the error stream and stops with
 *   exit code 1 instead of letting the user go on editing (and saving) it.
 */
export class Repl {
  private static readonly BANNER = "svg-editor 0.1 — type 'help' for commands";
  private static readonly PROMPT = "svg> ";

  private readonly editor: Editor;
  private readonly input: Readable;
  private readonly output: Writable;
  private readonly errors: Writable;
  private readonly interactive: boolean;

  constructor(editor: Editor, input: Readable, output: Writable, errors: Writable, interactive: boolean) {
    this.editor = editor;
    this.input = input;
    this.output = output;
    this.errors = errors;
    this.interactive = interactive;
  }

  /** Runs until EOF, Ctrl-C or a programming error; resolves to the process exit code. */
  run(): Promise<number> {
    this.print(Repl.BANNER);
    const reader = this.interactive
      ? createInterface({ input: this.input, output: this.output, prompt: Repl.PROMPT, crlfDelay: Infinity })
      : createInterface({ input: this.input, terminal: false, crlfDelay: Infinity });

    return new Promise((resolve) => {
      let exitCode = 0;
      let stopped = false;
      const stop = () => {
        stopped = true;
        reader.close();
      };
      // A TTY in raw mode reports Ctrl-C to readline; otherwise it arrives as a signal.
      reader.on("SIGINT", stop);
      process.once("SIGINT", stop);

      reader.on("line", (line) => {
        // Lines already buffered when the loop stopped are dropped.
        if (stopped) {
          return;
        }
        try {
          this.editor.executeLine(line).forEach((outputLine) => this.print(outputLine));
        } catch (error) {
          this.errors.write(`internal error: ${error instanceof Error ? (error.stack ?? error.message) : String(error)}\n`);
          exitCode = 1;
          stop();
          return;
        }
        this.prompt(reader);
      });

      reader.on("close", () => {
        process.removeListener("SIGINT", stop);
        if (this.interactive) {
          // Ctrl-D leaves the cursor after the prompt; end that line.
          this.output.write("\n");
        }
        resolve(exitCode);
      });

      this.prompt(reader);
    });
  }

  private prompt(reader: Interface): void {
    if (this.interactive) {
      reader.prompt();
    }
  }

  private print(line: string): void {
    this.output.write(`${line}\n`);
  }
}
