import { mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import type { DirectoryEntry } from "../src/DirectoryEntry.js";
import { NodeDirectoryLister } from "../src/NodeDirectoryLister.js";

/**
 * The Adapter against the real file system (spec §2.3, design §8.2, N3): a
 * fresh temporary directory per test, removed afterwards. The process's
 * working directory is never changed; paths are passed in.
 */
describe("NodeDirectoryLister", () => {
  const roots: string[] = [];

  function freshDirectory(): string {
    const root = mkdtempSync(join(tmpdir(), "svg-dir-lister-"));
    roots.push(root);
    return root;
  }

  /** `[name, isDirectory]` pairs sorted by name, so the adapter's own (unspecified) order does not matter. */
  function listed(path: string): [string, boolean][] {
    return new NodeDirectoryLister()
      .list(path)
      .map((entry: DirectoryEntry): [string, boolean] => [entry.name(), entry.isDirectory()])
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
  }

  afterEach(() => {
    roots.splice(0).forEach((root) => rmSync(root, { recursive: true, force: true }));
  });

  it("lists files, subdirectories and hidden entries, without `.` and `..`", () => {
    const root = freshDirectory();
    mkdirSync(join(root, "docs"));
    mkdirSync(join(root, ".cache"));
    writeFileSync(join(root, "demo.svg"), "<svg/>");
    writeFileSync(join(root, ".hidden"), "");
    expect(listed(root)).toEqual([
      [".cache", true],
      [".hidden", false],
      ["demo.svg", false],
      ["docs", true],
    ]);
  });

  it("lists only the direct children", () => {
    const root = freshDirectory();
    mkdirSync(join(root, "a", "b"), { recursive: true });
    writeFileSync(join(root, "a", "inner.txt"), "");
    writeFileSync(join(root, "a", "b", "deep.txt"), "");
    expect(listed(root)).toEqual([["a", true]]);
  });

  it("follows a symbolic link one level: to a directory → directory; to a file, or broken → file", () => {
    const root = freshDirectory();
    mkdirSync(join(root, "target-dir"));
    writeFileSync(join(root, "target-file"), "x");
    symlinkSync(join(root, "target-dir"), join(root, "link-to-dir"));
    symlinkSync(join(root, "target-file"), join(root, "link-to-file"));
    symlinkSync(join(root, "missing"), join(root, "broken-link"));
    symlinkSync("target-dir", join(root, "relative-link-to-dir"));
    expect(listed(root)).toEqual([
      ["broken-link", false],
      ["link-to-dir", true],
      ["link-to-file", false],
      ["relative-link-to-dir", true],
      ["target-dir", true],
      ["target-file", false],
    ]);
  });

  it("an empty directory gives no entry", () => {
    expect(new NodeDirectoryLister().list(freshDirectory())).toEqual([]);
  });

  it("throws for a path that does not exist", () => {
    const missing = join(freshDirectory(), "missing");
    expect(() => new NodeDirectoryLister().list(missing)).toThrow(/ENOENT/);
  });

  it("throws for a path that is a regular file", () => {
    const file = join(freshDirectory(), "plain.txt");
    writeFileSync(file, "");
    expect(() => new NodeDirectoryLister().list(file)).toThrow(/ENOTDIR/);
  });
});
