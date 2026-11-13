/**
 * Entry script of the baseline tool (`npm run baseline`, see doc/transcript/README.md).
 *
 * Like src/cli/main.ts, this file is a process entry script rather than a class:
 * it only hands the command-line arguments to `BaselineTool`.
 */
import { BaselineTool } from "./BaselineTool.js";

process.exitCode = new BaselineTool(process.stdout).main(process.argv.slice(2));
