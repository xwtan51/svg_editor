import { readdirSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

function read(relative: string): string {
  return readFileSync(new URL(relative, import.meta.url), "utf8");
}

const manifest = JSON.parse(read("../../package.json")) as { scripts: Record<string, string>; devDependencies: Record<string, string> };

describe("test tooling (README \"集成测试\")", () => {
  it("npm test runs the unit tests only: vitest includes tests/unit, and no integration file looks like a unit test", () => {
    expect(manifest.scripts["test"]).toBe("vitest run");
    expect(read("../../vitest.config.mts")).toMatch(/include:\s*\["tests\/unit\/\*\*\/\*\.test\.ts"\]/);
    const integration = readdirSync(new URL("../integration/", import.meta.url), { recursive: true, encoding: "utf8" });
    expect(integration.filter((f) => f.endsWith(".test.ts"))).toEqual([]);
  });

  it("integration tests have their own commands", () => {
    expect(manifest.scripts["test:integration"]).toContain("node dist-test/run.js");
    expect(manifest.scripts["test:restricted"]).toContain("node dist-test/run.js --restricted");
    expect(manifest.devDependencies["@vscode/test-electron"]).toBe("3.1.0");
  });

  it("the bundled tests run on the extension host's Node 18 too", () => {
    expect(manifest.scripts["build:integration"]).toMatch(/suite\/outline\.ts .*--target=node18/);
  });

  it("test bundles and downloaded VSCode builds are neither committed nor packaged", () => {
    for (const ignored of ["dist-test/", ".vscode-test/"]) {
      expect(read("../../.gitignore").split("\n")).toContain(ignored);
      expect(read("../../.vscodeignore").split("\n")).toContain(`${ignored}**`);
    }
  });
});
