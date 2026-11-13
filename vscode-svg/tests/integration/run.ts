/**
 * Command-line entry of the integration tests (bundled to dist-test/run.js):
 *
 *   npm run test:integration                      # VSCode 1.146.0
 *   VSCODE_TEST_VERSION=1.85.0 npm run test:integration
 *   npm run test:restricted                       # VA12, same variable
 *
 * The exit code is VSCode's: 0 when every case passed.
 */
import { resolve } from "node:path";
import { IntegrationLauncher } from "./IntegrationLauncher.js";

const DEFAULT_VERSION = "1.146.0";

const version = process.env["VSCODE_TEST_VERSION"] ?? DEFAULT_VERSION;
const launcher = new IntegrationLauncher(resolve(__dirname, ".."), version);
const restricted = process.argv.includes("--restricted");

console.log(`Integration tests (${restricted ? "Restricted Mode check" : "outline suite"}) on VSCode ${version}`);
(restricted ? launcher.runRestrictedCheck() : launcher.runOutlineSuite()).then(
  (code) => {
    console.log(`Exit code: ${code}`);
    process.exitCode = code;
  },
  (error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  },
);
