import { describe, expect, it } from "vitest";
import { SchemeFilter } from "../../src/core/SchemeFilter.js";

describe("SchemeFilter", () => {
  it("VA6: decorates local and remote workspace files", () => {
    expect(SchemeFilter.DEFAULT.includes("file")).toBe(true);
    expect(SchemeFilter.DEFAULT.includes("vscode-remote")).toBe(true);
  });

  it("VA6: skips untitled buffers and virtual views", () => {
    for (const scheme of ["untitled", "git", "gitlens", "vscode-userdata", "output", "vscode-vfs", ""]) {
      expect(SchemeFilter.DEFAULT.includes(scheme), scheme).toBe(false);
    }
  });

  it("is case-sensitive like URI schemes after normalisation", () => {
    expect(SchemeFilter.DEFAULT.includes("FILE")).toBe(false);
  });
});
