/**
 * Entry script of the plugin-diff check (`npm run plugin-diff -- <C> plugins/<dir> --mode A|B`, design §1.5).
 *
 * Like scripts/baseline/main.ts, this file is a process entry script rather
 * than a class: it only hands the command-line arguments to `PluginDiffCheck`.
 */
import { PluginDiffCheck } from "./PluginDiffCheck.js";

process.exitCode = new PluginDiffCheck(process.stdout).main(process.argv.slice(2));
