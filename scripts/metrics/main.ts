/**
 * Entry script of the metrics tool (`npm run metrics -- [<revision>]`, design §5.3).
 *
 * Like scripts/baseline/main.ts, this file is a process entry script rather
 * than a class: it only hands the command-line arguments to `MetricsTool`.
 */
import { MetricsTool } from "./MetricsTool.js";

process.exitCode = new MetricsTool(process.stdout).main(process.argv.slice(2));
