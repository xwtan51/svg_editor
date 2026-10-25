/**
 * Program entry point (`npm run cli`).
 *
 * Exception to the "one class per file, file name = class name" rule (spec §2.1):
 * this file is the process entry script, not a class. It holds no business logic —
 * it only wires up and starts the application. Every other file under src/ must
 * follow the rule.
 */
import { Editor } from "../app/Editor.js";
import { Repl } from "./Repl.js";

const repl = new Repl(Editor.createDefault(), process.stdin, process.stdout, process.stderr, process.stdin.isTTY === true);
process.exitCode = await repl.run();
