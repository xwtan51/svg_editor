import { describe, expect, it } from "vitest";
import type { CancellationToken, Event, FileStat, FileSystem, Uri } from "vscode";
import { FileDecoration } from "vscode"; // the stub from tests/stubs (vitest alias)
import { SchemeFilter } from "../../src/core/SchemeFilter.js";
import { SvgBadgeRule } from "../../src/core/SvgBadgeRule.js";
import { SvgFileDecorationProvider } from "../../src/host/SvgFileDecorationProvider.js";
import { VscodeResourceKindReader } from "../../src/host/VscodeResourceKindReader.js";

/** A fake file system: path → FileType bits; missing paths reject like VSCode. */
class FakeFileSystem implements Pick<FileSystem, "stat"> {
  readonly asked: string[] = [];
  private readonly types: Map<string, number>;

  constructor(types: Record<string, number>) {
    this.types = new Map(Object.entries(types));
  }

  stat(uri: Uri): Promise<FileStat> {
    this.asked.push(`${uri.scheme}:${uri.path}`);
    const type = this.types.get(uri.path);
    return type === undefined
      ? Promise.reject(new Error(`EntryNotFound: ${uri.path}`))
      : Promise.resolve({ type, ctime: 0, mtime: 0, size: 0 });
  }
}

const notCancelled = { isCancellationRequested: false } as CancellationToken;
const cancelled = { isCancellationRequested: true } as CancellationToken;
const noEvents: Event<Uri> = () => ({ dispose() {} });

function uri(path: string, scheme = "file"): Uri {
  return { scheme, path } as Uri;
}

function providerOver(fs: FakeFileSystem, changes: Event<Uri> = noEvents): SvgFileDecorationProvider {
  return new SvgFileDecorationProvider(new SvgBadgeRule(), new VscodeResourceKindReader(fs), SchemeFilter.DEFAULT, changes);
}

describe("SvgFileDecorationProvider", () => {
  const fs = new FakeFileSystem({
    "/w/example.svg": 1,
    "/w/LOGO.SVG": 1,
    "/w/icons.svg": 2,
    "/w/link-to-file.svg": 65,
    "/w/link-to-dir.svg": 66,
    "/w/dangling.svg": 64,
    "/w/plain.txt": 1,
  });
  const provider = providerOver(fs);

  it("returns a FileDecoration with badge [] for an SVG file", async () => {
    const decoration = await provider.provideFileDecoration(uri("/w/example.svg"), notCancelled);
    expect(decoration).toBeInstanceOf(FileDecoration);
    expect(decoration?.badge).toBe("[]");
    expect(decoration?.tooltip).toBe("SVG file");
  });

  it("follows the rule for case, directories and links", async () => {
    const badge = async (path: string): Promise<unknown> =>
      (await provider.provideFileDecoration(uri(path), notCancelled))?.badge;
    expect(await badge("/w/LOGO.SVG")).toBe("[]");
    expect(await badge("/w/icons.svg")).toBeUndefined();
    expect(await badge("/w/link-to-file.svg")).toBe("[]");
    expect(await badge("/w/link-to-dir.svg")).toBeUndefined();
    expect(await badge("/w/dangling.svg")).toBeUndefined();
  });

  it("does not stat resources whose name already rules them out", async () => {
    const local = new FakeFileSystem({ "/w/plain.txt": 1, "/w/.svg": 1 });
    const p = providerOver(local);
    expect(await p.provideFileDecoration(uri("/w/plain.txt"), notCancelled)).toBeUndefined();
    expect(await p.provideFileDecoration(uri("/w/.svg"), notCancelled)).toBeUndefined();
    expect(await p.provideFileDecoration(uri("/w/foo.svg.txt"), notCancelled)).toBeUndefined();
    expect(local.asked).toEqual([]);
  });

  it("VA6: skips untitled and git URIs without calling stat", async () => {
    const local = new FakeFileSystem({ "/w/example.svg": 1 });
    const p = providerOver(local);
    expect(await p.provideFileDecoration(uri("/w/example.svg", "untitled"), notCancelled)).toBeUndefined();
    expect(await p.provideFileDecoration(uri("/w/example.svg", "git"), notCancelled)).toBeUndefined();
    expect(local.asked).toEqual([]);
    expect((await p.provideFileDecoration(uri("/w/example.svg", "vscode-remote"), notCancelled))?.badge).toBe("[]");
  });

  it("a failed stat (resource vanished) resolves to undefined", async () => {
    await expect(provider.provideFileDecoration(uri("/w/deleted.svg"), notCancelled)).resolves.toBeUndefined();
  });

  it("returns nothing once VSCode has cancelled the request", async () => {
    await expect(provider.provideFileDecoration(uri("/w/example.svg"), cancelled)).resolves.toBeUndefined();
  });

  it("exposes the injected change event as onDidChangeFileDecorations", () => {
    const changes: Event<Uri> = () => ({ dispose() {} });
    expect(providerOver(fs, changes).onDidChangeFileDecorations).toBe(changes);
  });
});
