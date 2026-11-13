import { describe, expect, it } from "vitest";
import { ResourceKind } from "../../src/core/ResourceKind.js";

describe("ResourceKind", () => {
  it("plain kinds", () => {
    expect([ResourceKind.file().isFile(), ResourceKind.file().isDirectory()]).toEqual([true, false]);
    expect([ResourceKind.directory().isFile(), ResourceKind.directory().isDirectory()]).toEqual([false, true]);
    expect([ResourceKind.unknown().isFile(), ResourceKind.unknown().isDirectory()]).toEqual([false, false]);
    expect(ResourceKind.file().isSymbolicLink()).toBe(false);
  });

  it("a symbolic link keeps its target kind", () => {
    const link = ResourceKind.file().throughSymbolicLink();
    expect(link.isFile()).toBe(true);
    expect(link.isSymbolicLink()).toBe(true);
    expect(ResourceKind.file().isSymbolicLink()).toBe(false); // original unchanged
  });

  it("equality and description", () => {
    expect(ResourceKind.file().equals(ResourceKind.file())).toBe(true);
    expect(ResourceKind.file().equals(ResourceKind.file().throughSymbolicLink())).toBe(false);
    expect(ResourceKind.directory().throughSymbolicLink().toString()).toBe("symbolic link to directory");
    expect(ResourceKind.unknown().toString()).toBe("unknown");
  });
});
