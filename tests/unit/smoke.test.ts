import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

// End-to-end smoke test: run the real entry point in a child process.
// tsx is resolved from this project's node_modules (never a global install) and
// launched with the current Node binary, so the test is platform-independent.
const tsxCli = createRequire(import.meta.url).resolve("tsx/cli");
const mainTs = fileURLToPath(new URL("../../src/cli/main.ts", import.meta.url));
const TIMEOUT_MS = 10_000;

describe("cli entry point", () => {
  it(
    "prints the banner and exits with code 0",
    () => {
      // input: "" writes nothing and closes stdin, so a future REPL hits EOF and exits.
      const result = spawnSync(process.execPath, [tsxCli, mainTs], {
        input: "",
        encoding: "utf8",
        timeout: TIMEOUT_MS,
      });

      expect(result.error).toBeUndefined();
      expect(result.status).toBe(0);
      expect(result.stdout.replace(/\r?\n$/, "")).toBe(
        "svg-editor 0.1 — type 'help' for commands",
      );
    },
    TIMEOUT_MS + 2_000,
  );
});
