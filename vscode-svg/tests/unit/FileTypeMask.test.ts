import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { describe, expect, it } from "vitest";
import { FileTypeMask } from "../../src/core/FileTypeMask.js";
import { ResourceKind } from "../../src/core/ResourceKind.js";

describe("FileTypeMask", () => {
  // Values produced by VSCode's DiskFileSystemProvider.toType() (1.146.0).
  const cases: [number, string, ResourceKind][] = [
    [0, "Unknown", ResourceKind.unknown()],
    [1, "File", ResourceKind.file()],
    [2, "Directory", ResourceKind.directory()],
    [65, "SymbolicLink | File", ResourceKind.file().throughSymbolicLink()],
    [66, "SymbolicLink | Directory", ResourceKind.directory().throughSymbolicLink()],
    [64, "SymbolicLink | Unknown (dangling link)", ResourceKind.unknown().throughSymbolicLink()],
  ];

  for (const [bits, name, kind] of cases) {
    it(`${bits} = ${name} decodes to "${kind}"`, () => {
      expect(new FileTypeMask(bits).toResourceKind().equals(kind)).toBe(true);
    });
  }

  it("a link to a file counts as a file although 65 !== File", () => {
    expect(65).not.toBe(FileTypeMask.FILE);
    expect(new FileTypeMask(65).has(FileTypeMask.FILE)).toBe(true);
    expect(new FileTypeMask(65).toResourceKind().isFile()).toBe(true);
  });

  it("unknown high bits are ignored", () => {
    expect(new FileTypeMask(1 | 128).toResourceKind().equals(ResourceKind.file())).toBe(true);
  });

  it("flag values match vscode.FileType in the installed @types/vscode", () => {
    const require = createRequire(import.meta.url);
    const dts = readFileSync(require.resolve("@types/vscode/index.d.ts"), "utf8");
    const body = /export enum FileType \{([\s\S]*?)\n\t\}/.exec(dts)?.[1] ?? "";
    const value = (member: string): number => Number(new RegExp(`\\b${member} = (\\d+)`).exec(body)?.[1]);
    expect(value("Unknown")).toBe(FileTypeMask.UNKNOWN);
    expect(value("File")).toBe(FileTypeMask.FILE);
    expect(value("Directory")).toBe(FileTypeMask.DIRECTORY);
    expect(value("SymbolicLink")).toBe(FileTypeMask.SYMBOLIC_LINK);
  });
});
