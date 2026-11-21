import { spawn, spawnSync } from "node:child_process";
import { copyFileSync, existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { describe, expect, it } from "vitest";
import { TempWorkspace } from "../../support/TempWorkspace.js";
import { TranscriptRunner } from "../../system/TranscriptRunner.js";

// The real entry point in a child process, fed through a pipe (not a TTY).
// tsx is resolved from this project's node_modules and run with the current
// Node binary: its CLI (`tsx/cli`, as in smoke.test.ts) for most cases, its
// loader (`node --import tsx`, one process) for the SIGINT case.
const tsxCli = createRequire(import.meta.url).resolve("tsx/cli");
const tsxLoader = pathToFileURL(createRequire(import.meta.url).resolve("tsx")).href;
const mainTs = fileURLToPath(new URL("../../../src/cli/main.ts", import.meta.url));
const TIMEOUT_MS = 10_000;

const BANNER = "svg-editor 0.1 — type 'help' for commands";
const NO_DOCUMENT = "error: no document. use 'init' or 'read' first";

function runMain(input: string, cwd?: string, args: readonly string[] = []) {
  return spawnSync(process.execPath, [tsxCli, mainTs, ...args], { input, encoding: "utf8", timeout: TIMEOUT_MS, cwd });
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

  // Not through `tsx/cli`: it runs the script in a second process, and on SIGINT waits only 30 ms for that
  // child to report back before SIGKILLing it and exiting with 130 — a busy machine misses that (design G48).
  it(
    "Ctrl-C (SIGINT) ends the session with exit code 0 (R13)",
    async () => {
      const child = spawn(process.execPath, ["--import", tsxLoader, mainTs], { stdio: ["pipe", "pipe", "pipe"] });
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
        // A Phase 1 session means "all new plugins disabled": from S13 on, the full assembly's `tree` adds " *" (modified-star).
        const result = runMain(transcript.inputs().map((line) => `${line}\n`).join(""), dir, ["--bare"]);
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

describe("cli/main.ts: assembly profiles (design §4.3, §4.5)", () => {
  const USAGE = "usage: svg-editor [--bare | --only <plugin>… | --config <file>]";
  const SESSION = "init\ncreate rect r 0 0 10 10\n";
  const SESSION_OUTPUT = ["canvas 800x600 created", "rect#r created"];
  const lines = (...all: string[]) => all.map((line) => `${line}\n`).join("");

  it(
    "--bare runs a session like no argument does",
    () => {
      const result = runMain(SESSION, undefined, ["--bare"]);
      expect(result.status).toBe(0);
      expect(result.stderr).toBe("");
      expect(result.stdout).toBe(lines(BANNER, ...SESSION_OUTPUT));
      expect(result.stdout).toBe(runMain(SESSION).stdout);
    },
    TIMEOUT_MS + 2_000,
  );

  it(
    "--config with a module that cannot be found: banner, the error line, then the first command's output; exit code 0",
    () => {
      const workspace = new TempWorkspace();
      try {
        workspace.writeConfig([{ module: "./nope" }, { module: "@svgframe/plugin-nope" }]);
        // A relative --config is relative to the current directory.
        const result = runMain(SESSION, workspace.root, ["--config", "plugins.config.json"]);
        expect(result.status).toBe(0);
        expect(result.stderr).toBe("");
        expect(result.stdout).toBe(
          lines(BANNER, "error: plugin not found: ./nope", "error: plugin not found: @svgframe/plugin-nope", ...SESSION_OUTPUT),
        );
      } finally {
        workspace.remove();
      }
    },
    TIMEOUT_MS + 2_000,
  );

  it(
    "--config loads a fixture plugin under tsx, from an unrelated current directory",
    () => {
      const workspace = new TempWorkspace();
      try {
        const result = runMain("fixture-ok\nfixture-count\n", workspace.root, ["--config", join(TempWorkspace.FIXTURES, "relative.config.json")]);
        expect(result.stderr).toBe("");
        expect(result.status).toBe(0);
        expect(result.stdout).toBe(lines(BANNER, "fixture ok", "count=1"));
      } finally {
        workspace.remove();
      }
    },
    TIMEOUT_MS + 2_000,
  );

  it(
    "a malformed configuration: error: invalid plugin config, then the session goes on as bare",
    () => {
      const workspace = new TempWorkspace();
      try {
        const config = workspace.writeText("bad.json", '{ "plugins": [ { "module": "./x", "enable": false } ] }');
        const result = runMain(`${SESSION}stats\n`, workspace.root, ["--config", config]);
        expect(result.status).toBe(0);
        expect(result.stderr).toBe("");
        expect(result.stdout).toBe(lines(BANNER, "error: invalid plugin config", ...SESSION_OUTPUT, "error: unknown command: stats"));
      } finally {
        workspace.remove();
      }
    },
    TIMEOUT_MS + 2_000,
  );

  it.each([
    ["two kinds of option", ["--bare", "--config", "x.json"]],
    ["an unknown argument", ["--verbose"]],
    ["--config without a value", ["--config"]],
    ["--only without a value", ["--only"]],
  ])(
    "usage error (%s): nothing on stdout, the usage line on stderr, exit code 2",
    (_case, args) => {
      const result = runMain(SESSION, undefined, args);
      expect(result.stdout).toBe("");
      expect(result.stderr).toBe(`${USAGE}\n`);
      expect(result.status).toBe(2);
    },
    TIMEOUT_MS + 2_000,
  );

  it(
    "--only with a package that is not in the code assembly: no banner, the error on stderr, exit code 2",
    () => {
      const result = runMain(SESSION, undefined, ["--only", "nope"]);
      expect(result.stdout).toBe("");
      expect(result.stderr).toBe("error: --only: no such plugin in the code assembly: nope\n");
      expect(result.status).toBe(2);
    },
    TIMEOUT_MS + 2_000,
  );
});
