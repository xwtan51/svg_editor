import { spawn, spawnSync } from "node:child_process";
import { copyFileSync, existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { TranscriptRunner } from "../../system/TranscriptRunner.js";

// The real entry point in a child process, fed through a pipe (not a TTY).
// tsx is resolved from this project's node_modules and launched with the
// current Node binary, as in smoke.test.ts.
const tsxCli = createRequire(import.meta.url).resolve("tsx/cli");
const mainTs = fileURLToPath(new URL("../../../src/cli/main.ts", import.meta.url));
const TIMEOUT_MS = 10_000;

const BANNER = "svg-editor 0.1 — type 'help' for commands";
const NO_DOCUMENT = "error: no document. use 'init' or 'read' first";

function runMain(input: string, cwd?: string) {
  return spawnSync(process.execPath, [tsxCli, mainTs], { input, encoding: "utf8", timeout: TIMEOUT_MS, cwd });
}

describe("cli/main.ts over a pipe", () => {
  it(
    "prints the banner and each command's output, no prompt, exit code 0 (R1, R14)",
    () => {
      // Without init / read (not in this branch yet) every command answers "no document".
      const result = runMain(
        ["# a script", "move c1 30 0", "", "   # indented comment", "nosuch 1", 'move "c1', "create rect r 0 0 1 1 #4a90d9"].join(
          "\n",
        ) + "\n",
      );
      expect(result.error).toBeUndefined();
      expect(result.status).toBe(0);
      expect(result.stderr).toBe("");
      expect(result.stdout).toBe(
        [BANNER, NO_DOCUMENT, "error: unknown command: nosuch", "error: unterminated quote", NO_DOCUMENT, ""].join("\n"),
      );
      expect(result.stdout).not.toContain("svg> ");
    },
    TIMEOUT_MS + 2_000,
  );

  it(
    "runs a last line that has no newline before EOF",
    () => {
      const result = runMain("move c1 30 0");
      expect(result.status).toBe(0);
      expect(result.stdout).toBe(`${BANNER}\n${NO_DOCUMENT}\n`);
    },
    TIMEOUT_MS + 2_000,
  );

  it(
    "Ctrl-C (SIGINT) ends the session with exit code 0 (R13)",
    async () => {
      const child = spawn(process.execPath, [tsxCli, mainTs], { stdio: ["pipe", "pipe", "pipe"] });
      let stdout = "";
      let stderr = "";
      child.stderr.on("data", (chunk: Buffer) => {
        stderr += chunk.toString("utf8");
      });
      const exited = new Promise<{ code: number | null; signal: NodeJS.Signals | null }>((resolve) => {
        child.on("exit", (code, signal) => resolve({ code, signal }));
      });
      // Signal only once the first command has been answered, so the handler is installed.
      child.stdout.on("data", (chunk: Buffer) => {
        stdout += chunk.toString("utf8");
        if (stdout.includes(NO_DOCUMENT)) {
          child.kill("SIGINT");
        }
      });
      child.stdin.write("move c1 30 0\n");

      expect(await exited).toEqual({ code: 0, signal: null });
      expect(stdout).toBe(`${BANNER}\n${NO_DOCUMENT}\n`);
      expect(stderr).toBe("");
    },
    TIMEOUT_MS + 2_000,
  );

  it(
    "plays the whole spec §6 session in a temporary directory and writes demo.svg there",
    () => {
      const transcript = TranscriptRunner.load("spec-6.txt");
      const dir = mkdtempSync(join(tmpdir(), "svg-editor-main-"));
      try {
        copyFileSync(new URL("fixtures/other.svg", TranscriptRunner.DIRECTORY), join(dir, "other.svg"));
        const result = runMain(transcript.inputs().map((line) => `${line}\n`).join(""), dir);
        expect(result.error).toBeUndefined();
        expect(result.stderr).toBe("");
        expect(result.status).toBe(0);
        expect(result.stdout).toBe([BANNER, ...transcript.outputs()].map((line) => `${line}\n`).join(""));
        expect(existsSync(join(dir, "demo.svg"))).toBe(true);
        // The same bytes as the in-memory run of the same transcript saves.
        transcript.steps.forEach((step) => transcript.run(step));
        expect(readFileSync(join(dir, "demo.svg"), "utf8")).toBe(transcript.files.readText("demo.svg"));
      } finally {
        rmSync(dir, { recursive: true, force: true });
      }
    },
    TIMEOUT_MS + 2_000,
  );
});
