/**
 * Node side of the integration tests: downloads a pinned VSCode, starts it in
 * an isolated sandbox and reports its exit code (README "集成测试").
 *
 * `@vscode/test-electron` is used only to download and locate VSCode. Its
 * `runTests` always adds `--disable-workspace-trust`, which would make the
 * Restricted Mode check meaningless, so the command line is built here.
 *
 * Isolation, for every launch:
 * - a VSCode build downloaded into `.vscode-test/`, never the one installed on
 *   the machine;
 * - fresh temporary `--user-data-dir`, `--extensions-dir` and
 *   `--shared-data-dir` (VSCode 1.146 otherwise writes to
 *   `~/.vscode-shared/sharedStorage/`; 1.85 does not know the option and only
 *   warns about it), all deleted afterwards;
 * - `HOME` pointed at a temporary directory: VSCode keeps `~/.vscode/argv.json`
 *   outside every `--*-dir` and rewrites its `enable-crash-reporter` entry to
 *   match the test instance's telemetry setting (`updateCrashReporterEnablement`
 *   in 1.146.0's `mainImpl.js`) — without this the tests would touch the
 *   developer's own file;
 * - a temporary copy of `samples/` as the workspace, so test edits and setting
 *   changes never reach the repository;
 * - no `VSCODE_*` / `ELECTRON_RUN_AS_NODE` variables inherited from a VSCode
 *   terminal.
 */
import { spawn, spawnSync } from "node:child_process";
import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { downloadAndUnzipVSCode, resolveCliPathFromVSCodeExecutablePath } from "@vscode/test-electron";

interface Sandbox {
  root: string;
  workspace: string;
  isolation: string[];
  home: string;
}

export class IntegrationLauncher {
  /** Flags `@vscode/test-electron`'s `runTests` would add, minus `--disable-workspace-trust`. */
  private static readonly QUIET = [
    "--no-sandbox",
    "--disable-gpu-sandbox",
    "--disable-updates",
    "--skip-welcome",
    "--skip-release-notes",
    "--no-cached-data",
  ];

  private readonly project: string;
  private readonly version: string;

  constructor(project: string, version: string) {
    this.project = project;
    this.version = version;
  }

  /** The A.2 outline suite, with this project loaded as development extension. */
  async runOutlineSuite(): Promise<number> {
    const executable = await this.download();
    const sandbox = this.createSandbox("outline");
    try {
      return await this.launch(executable, [
        sandbox.workspace,
        "--disable-extensions",
        ...sandbox.isolation,
        "--disable-workspace-trust",
        `--extensionDevelopmentPath=${this.project}`,
        `--extensionTestsPath=${join(this.project, "dist-test", "suite", "outline.js")}`,
      ], { HOME: sandbox.home });
    } finally {
      rmSync(sandbox.root, { recursive: true, force: true });
    }
  }

  /**
   * VA12: install the packaged extension and open an untrusted folder; then the
   * same with a control package that lacks `capabilities.untrustedWorkspaces`.
   */
  async runRestrictedCheck(): Promise<number> {
    const executable = await this.download();
    const packages = mkdtempSync(join(tmpdir(), "svg-badge-vsix-"));
    try {
      const real = join(packages, "svg-badge.vsix");
      this.packageVsix(this.project, real);
      const control = join(packages, "svg-badge-control.vsix");
      this.packageVsix(this.controlProject(join(packages, "control")), control);
      for (const [vsix, expect] of [[real, "active"], [control, "disabled"]] as const) {
        const code = await this.runRestricted(executable, vsix, expect);
        if (code !== 0) return code;
      }
      return 0;
    } finally {
      rmSync(packages, { recursive: true, force: true });
    }
  }

  private async runRestricted(executable: string, vsix: string, expect: "active" | "disabled"): Promise<number> {
    const sandbox = this.createSandbox("restricted");
    try {
      // Without this, VSCode asks "Do you trust the authors…?" in a modal dialog
      // at startup. "never" skips the question; the folder stays untrusted.
      const settings = join(sandbox.root, "user-data", "User");
      mkdirSync(settings, { recursive: true });
      writeFileSync(join(settings, "settings.json"), JSON.stringify({ "security.workspace.trust.startupPrompt": "never" }));

      const cli = resolveCliPathFromVSCodeExecutablePath(executable);
      const install = spawnSync(cli, [...sandbox.isolation, "--install-extension", vsix], {
        env: this.environment({ HOME: sandbox.home }), encoding: "utf8",
      });
      console.log(`$ code --install-extension ${vsix.split("/").pop()} → ${install.status}\n${install.stdout}${install.stderr}`);
      if (install.status !== 0) return install.status ?? 1;

      // A throw-away development extension only hosts the test code.
      const driver = join(sandbox.root, "driver");
      mkdirSync(driver);
      writeFileSync(join(driver, "package.json"), JSON.stringify({
        name: "restricted-mode-driver", publisher: "svg-badge-tests", version: "0.0.0", engines: { vscode: "*" },
      }));

      return await this.launch(executable, [
        sandbox.workspace,
        ...sandbox.isolation,
        `--extensionDevelopmentPath=${driver}`,
        `--extensionTestsPath=${join(this.project, "dist-test", "suite", "restricted.js")}`,
      ], { HOME: sandbox.home, SVG_BADGE_RESTRICTED_EXPECT: expect, SVG_BADGE_PROJECT: this.project });
    } finally {
      rmSync(sandbox.root, { recursive: true, force: true });
    }
  }

  private async download(): Promise<string> {
    return downloadAndUnzipVSCode({ version: this.version, cachePath: join(this.project, ".vscode-test") });
  }

  private createSandbox(purpose: string): Sandbox {
    const root = mkdtempSync(join(tmpdir(), `svg-badge-${purpose}-`));
    const workspace = join(root, "workspace", "samples");
    cpSync(join(this.project, "samples"), workspace, { recursive: true });
    const isolation = ["user-data", "extensions", "shared-data"].map((name) => {
      mkdirSync(join(root, name), { recursive: true });
      return `--${name}-dir=${join(root, name)}`;
    });
    mkdirSync(join(root, "home"));
    return { root, workspace, isolation, home: join(root, "home") };
  }

  /** `vsce package` (pinned version, as in the README) into `out`. */
  private packageVsix(directory: string, out: string): void {
    const result = spawnSync("npx", ["--yes", "@vscode/vsce@4.1.1", "package", "--skip-license", "--out", out], {
      cwd: directory, encoding: "utf8", env: this.environment({}),
    });
    console.log(`$ vsce package (${directory}) → ${result.status}\n${result.stdout.split("\n").filter((l) => /DONE|WARNING|ERROR/.test(l)).join("\n")}${result.stderr}`);
    if (result.status !== 0) {
      throw new Error(`vsce package failed in ${directory}`);
    }
  }

  /** A copy of the packaged files whose manifest does not declare `capabilities`. */
  private controlProject(directory: string): string {
    mkdirSync(directory, { recursive: true });
    for (const file of ["README.md", ".vscodeignore", "dist"]) {
      cpSync(join(this.project, file), join(directory, file), { recursive: true });
    }
    const manifest = JSON.parse(readFileSync(join(this.project, "package.json"), "utf8")) as Record<string, unknown>;
    delete manifest["capabilities"];
    delete manifest["devDependencies"];
    manifest["scripts"] = {};
    writeFileSync(join(directory, "package.json"), JSON.stringify(manifest, undefined, 2));
    return directory;
  }

  private launch(executable: string, args: string[], extra: Record<string, string>): Promise<number> {
    const all = [...args, ...IntegrationLauncher.QUIET];
    console.log(`$ ${executable}\n    ${all.join("\n    ")}`);
    const child = spawn(executable, all, { env: this.environment({ SVG_BADGE_IT_VERSION: this.version, ...extra }) });
    child.stdout.pipe(process.stdout);
    child.stderr.pipe(process.stderr);
    return new Promise((resolve, reject) => {
      child.on("error", reject);
      child.on("exit", (code, signal) => resolve(code ?? (signal === null ? 1 : 128)));
    });
  }

  private environment(extra: Record<string, string>): NodeJS.ProcessEnv {
    const env: NodeJS.ProcessEnv = {};
    for (const [key, value] of Object.entries(process.env)) {
      if (!key.startsWith("VSCODE_") && key !== "ELECTRON_RUN_AS_NODE") env[key] = value;
    }
    return { ...env, ...extra };
  }
}
