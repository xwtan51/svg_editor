import { mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { NodeDirectoryLister } from "../src/NodeDirectoryLister.js";
import { NodeWorkingDirectory } from "../src/NodeWorkingDirectory.js";
import { FakeWorkingDirectory } from "./doubles/FakeWorkingDirectory.js";
import { TestEditor } from "./doubles/TestEditor.js";

/**
 * The command together with the real Adapter (spec §2.3 "使用临时目录验证命令与
 * 真实文件系统适配器组合运行的结果"): `dir` registered as
 * `DirCommandType(new NodeDirectoryLister(), <the temporary directory>)` and
 * run through the editor, its output compared line by line with what was
 * written down beforehand. The working directory port is a stand-in fixed to
 * the temporary directory, so the test never calls `chdir`.
 */
describe("dir with the real directory adapter", () => {
  const roots: string[] = [];

  function freshDirectory(): string {
    const root = mkdtempSync(join(tmpdir(), "svg-dir-real-"));
    roots.push(root);
    return root;
  }

  function editorOn(path: string): TestEditor {
    return TestEditor.create(new NodeDirectoryLister(), new FakeWorkingDirectory(path));
  }

  afterEach(() => {
    roots.splice(0).forEach((root) => rmSync(root, { recursive: true, force: true }));
  });

  it("lists a real directory: hidden entries, links, upper case first by code unit", () => {
    const root = freshDirectory();
    mkdirSync(join(root, "plugins"));
    mkdirSync(join(root, "docs"));
    writeFileSync(join(root, "docs", "readme.txt"), "not listed");
    writeFileSync(join(root, "demo.svg"), "<svg/>");
    writeFileSync(join(root, "package.json"), "{}");
    writeFileSync(join(root, "README.md"), "");
    writeFileSync(join(root, ".hidden"), "");
    symlinkSync(join(root, "docs"), join(root, "Docs-link"));
    symlinkSync(join(root, "nowhere"), join(root, "broken"));
    expect(editorOn(root).run("dir")).toEqual([
      "[DIR]  Docs-link",
      "[DIR]  docs",
      "[DIR]  plugins",
      "[FILE] .hidden",
      "[FILE] README.md",
      "[FILE] broken",
      "[FILE] demo.svg",
      "[FILE] package.json",
    ]);
  });

  it("an empty real directory gives `(empty directory)`", () => {
    expect(editorOn(freshDirectory()).run("dir")).toEqual(["(empty directory)"]);
  });

  it("a real read failure is `error: cannot read directory: <path>`, then the editor goes on", () => {
    const missing = join(freshDirectory(), "missing");
    const editor = editorOn(missing);
    expect(editor.run("dir")).toEqual([`error: cannot read directory: ${missing}`]);
    expect(editor.run("barrier")).toEqual(["error: no document. use 'init' or 'read' first"]);

    const file = join(freshDirectory(), "plain.txt");
    writeFileSync(file, "");
    expect(editorOn(file).run("dir")).toEqual([`error: cannot read directory: ${file}`]);
  });

  it("NodeWorkingDirectory answers the process's current directory", () => {
    expect(new NodeWorkingDirectory().current()).toBe(process.cwd());
  });
});
