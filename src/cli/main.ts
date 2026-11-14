/**
 * Program entry point (`npm run cli`).
 *
 * Exception to the "one class per file, file name = class name" rule (spec §2.1):
 * this file is the process entry script, not a class. It holds no business logic —
 * it only wires up and starts the application. Every other file under src/ must
 * follow the rule.
 *
 * Without command-line arguments the editor is assembled as `full` (design §4.3).
 * A built-in plugin that cannot be installed is a programming error: it is
 * reported on stderr and the process exits with code 1, before the banner.
 */
import type { Editor } from "@svgframe/kernel/host";
import { EditorAssembler } from "../assembly/EditorAssembler.js";
import { Repl } from "./Repl.js";

let editor: Editor;
try {
  editor = new EditorAssembler().full();
} catch (error) {
  process.stderr.write(`internal error: ${error instanceof Error ? (error.stack ?? error.message) : String(error)}\n`);
  process.exit(1);
}
const repl = new Repl(editor, process.stdin, process.stdout, process.stderr, process.stdin.isTTY === true);
process.exitCode = await repl.run();
