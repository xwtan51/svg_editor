import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

interface Manifest {
  main: string;
  engines: { vscode: string; node: string };
  activationEvents: string[];
  capabilities?: { untrustedWorkspaces?: { supported?: boolean | string } };
  scripts: Record<string, string>;
  devDependencies: Record<string, string>;
  type?: string;
}

function readJson<T>(relative: string): T {
  return JSON.parse(readFileSync(new URL(relative, import.meta.url), "utf8")) as T;
}

const manifest = readJson<Manifest>("../../package.json");

describe("package.json (extension manifest)", () => {
  it("VA1: onStartupFinished for the badge (no contribution point), onLanguage:xml for the outline", () => {
    expect(manifest.activationEvents).toEqual(["onStartupFinished", "onLanguage:xml"]);
  });

  it("engines.vscode and @types/vscode name the same version", () => {
    const engine = manifest.engines.vscode.replace(/^\^/, "");
    expect(manifest.devDependencies["@types/vscode"]).toBe(engine);
    const installed = readJson<{ version: string }>("../../node_modules/@types/vscode/package.json").version;
    expect(installed).toBe(engine);
  });

  it("does not exceed VSCode 1.146.0 (the version installed on the author's Mac)", () => {
    const [major, minor] = manifest.engines.vscode.replace(/^\^/, "").split(".").map(Number);
    expect(major).toBe(1);
    expect(minor).toBeLessThanOrEqual(146);
  });

  it("VA10: the minimum is VSCode 1.85.0, a caret range, so any later 1.x installs too", () => {
    expect(manifest.engines.vscode).toBe("^1.85.0");
  });

  it("VA10: the bundle targets the extension host's Node of the minimum VSCode (1.85 → Electron 25 → Node 18)", () => {
    const targets = [...manifest.scripts["build"]!.matchAll(/--target=(\S+)/g)].map((m) => m[1]);
    expect(targets).toEqual(["node18"]);
  });

  it("VA10: engines.node constrains the development tool chain only, not the extension host", () => {
    expect(manifest.engines.node).toBe(">=22");
  });

  it("VA12: declares support for untrusted workspaces, so Restricted Mode does not disable it", () => {
    expect(manifest.capabilities?.untrustedWorkspaces?.supported).toBe(true);
  });

  it("the entry is the CommonJS bundle (no \"type\": \"module\")", () => {
    expect(manifest.main).toBe("./dist/extension.js");
    expect(manifest.type).toBeUndefined();
  });
});
