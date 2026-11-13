import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

interface Manifest {
  main: string;
  engines: { vscode: string };
  activationEvents: string[];
  devDependencies: Record<string, string>;
  type?: string;
}

function readJson<T>(relative: string): T {
  return JSON.parse(readFileSync(new URL(relative, import.meta.url), "utf8")) as T;
}

const manifest = readJson<Manifest>("../../package.json");

describe("package.json (extension manifest)", () => {
  it("VA1: activates on onStartupFinished — file decorations have no contribution point", () => {
    expect(manifest.activationEvents).toEqual(["onStartupFinished"]);
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

  it("the entry is the CommonJS bundle (no \"type\": \"module\")", () => {
    expect(manifest.main).toBe("./dist/extension.js");
    expect(manifest.type).toBeUndefined();
  });
});
