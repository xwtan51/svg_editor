import { PassThrough, Writable } from "node:stream";
import { describe, expect, it } from "vitest";
import { Editor } from "../../../src/app/Editor.js";
import { EditorSession } from "../../../src/app/EditorSession.js";
import { Repl } from "../../../src/cli/Repl.js";
import { CommandRegistry } from "../../../src/commands/CommandRegistry.js";
import type { CommandResult } from "../../../src/commands/CommandResult.js";
import { QueryCommand } from "../../../src/commands/QueryCommand.js";
import { ShapeFactory } from "../../../src/model/ShapeFactory.js";
import { SvgDocument } from "../../../src/model/SvgDocument.js";
import { MemoryFileSystem } from "../io/MemoryFileSystem.js";

// In-process tests of the loop itself, on in-memory streams. The real entry
// point in a child process is covered by main.test.ts.

const BANNER = "svg-editor 0.1 — type 'help' for commands";

/** Test-only command with a programming error (a plain `Error`, not an `EditorError`). */
class BrokenCommand extends QueryCommand {
  static readonly commandName = "broken";
  static readonly usage = "broken";
  static readonly summary = "throws a plain Error";

  static parse(): BrokenCommand {
    return new BrokenCommand();
  }

  execute(): CommandResult {
    throw new Error("broken invariant");
  }
}

/** Collects everything written to it. */
class Capture extends Writable {
  text = "";

  override _write(chunk: Buffer, _encoding: BufferEncoding, done: () => void): void {
    this.text += chunk.toString("utf8");
    done();
  }
}

/** An editor with an empty document (there is no `init` command yet) and the `broken` test command. */
function editor(): Editor {
  const registry = new CommandRegistry();
  registry.register(BrokenCommand);
  const session = new EditorSession(new MemoryFileSystem(), registry, new ShapeFactory());
  session.replaceDocument(new SvgDocument(), null);
  return new Editor(session);
}

async function runRepl(input: string, interactive: boolean): Promise<{ code: number; out: string; err: string }> {
  const stdin = new PassThrough();
  const out = new Capture();
  const err = new Capture();
  const done = new Repl(editor(), stdin, out, err, interactive).run();
  stdin.end(input);
  const code = await done;
  return { code, out: out.text, err: err.text };
}

describe("Repl", () => {
  it("non-interactive: banner, then each command's output; no prompt (R1)", async () => {
    const result = await runRepl("# script\ncreate rect r 0 0 1 1 #4a90d9\n\nmove r 1 2\nmove r\n", false);
    expect(result).toEqual({
      code: 0,
      out: [BANNER, "rect#r created", "rect#r moved to (1,2)", "error: usage: move <id> <dx> <dy>", ""].join("\n"),
      err: "",
    });
  });

  it("goes on after an error and exits with 0 (R14)", async () => {
    const result = await runRepl("nosuch\nmove x 1 1\ncreate rect r 0 0 1 1\n", false);
    expect(result).toEqual({
      code: 0,
      out: [BANNER, "error: unknown command: nosuch", "error: no such shape: x", "rect#r created", ""].join("\n"),
      err: "",
    });
  });

  it("runs a last line without a newline and accepts CRLF line ends", async () => {
    const result = await runRepl("create rect r 0 0 1 1\r\nmove r 1 1", false);
    expect(result.out).toBe([BANNER, "rect#r created", "rect#r moved to (1,1)", ""].join("\n"));
    expect(result.code).toBe(0);
  });

  it("empty input: only the banner", async () => {
    expect(await runRepl("", false)).toEqual({ code: 0, out: `${BANNER}\n`, err: "" });
  });

  it("interactive: a prompt before every line, a newline at EOF", async () => {
    const result = await runRepl("create rect r 0 0 1 1\n# quiet\n", true);
    expect(result.out).toBe(`${BANNER}\nsvg> rect#r created\nsvg> svg> \n`);
    expect(result.code).toBe(0);
  });

  it("a programming error is reported on the error stream and stops the loop with exit code 1", async () => {
    const result = await runRepl("create rect r 0 0 1 1\nbroken\ncreate rect s 0 0 1 1\n", false);
    expect(result.code).toBe(1);
    expect(result.out).toBe(`${BANNER}\nrect#r created\n`);
    expect(result.err).toMatch(/^internal error: Error: broken invariant\n/);
  });
});
