/**
 * Program entry point (`npm run cli`).
 *
 * Exception to the "one class per file, file name = class name" rule (spec §2.1):
 * this file is the process entry script, not a class. It holds no business logic —
 * it only wires up and starts the application. Every other file under src/ must
 * follow the rule.
 *
 * The command line chooses the assembly profile (design §4.3; no argument is
 * `full`). The editor is assembled before the REPL starts, so the startup
 * messages come after the banner and before the first command's output.
 * - A refused start (usage error, unknown `--only` name): the message on
 *   stderr, exit code 2, no banner.
 * - A built-in plugin that cannot be installed is a programming error:
 *   `internal error: …` on stderr, exit code 1, no banner.
 */
import type { AssemblyResult } from "../assembly/AssemblyResult.js";
import { EditorAssembler } from "../assembly/EditorAssembler.js";
import { StartupRefusal } from "../assembly/StartupRefusal.js";
import { CliArguments } from "./CliArguments.js";
import { Repl } from "./Repl.js";

let assembly: AssemblyResult | null = null;
try {
  assembly = await new EditorAssembler().assemble(CliArguments.parse(process.argv.slice(2)));
} catch (error) {
  if (error instanceof StartupRefusal) {
    process.stderr.write(`${error.message}\n`);
    process.exitCode = 2;
  } else {
    process.stderr.write(`internal error: ${error instanceof Error ? (error.stack ?? error.message) : String(error)}\n`);
    process.exitCode = 1;
  }
}
if (assembly !== null) {
  const repl = new Repl(assembly.editor(), process.stdin, process.stdout, process.stderr, process.stdin.isTTY === true, assembly.startupMessages());
  process.exitCode = await repl.run();
}
