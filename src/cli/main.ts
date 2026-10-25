/**
 * Program entry point (`npm run cli`).
 *
 * Exception to the "one class per file, file name = class name" rule (spec §2.1):
 * this file is the process entry script, not a class. It holds no business logic —
 * it only wires up and starts the application. Every other file under src/ must
 * follow the rule.
 */

console.log("svg-editor 0.1 — type 'help' for commands");
