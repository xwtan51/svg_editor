import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { FileStat, FileSystem, Uri } from "vscode";
import { ResourceKind } from "../../src/core/ResourceKind.js";
import { VscodeResourceKindReader } from "../../src/host/VscodeResourceKindReader.js";

type Stat = Pick<FileSystem, "stat">;

const someUri = { scheme: "file", path: "/w/a.svg" } as Uri;

function statReturning(type: number): Stat {
  return { stat: async () => ({ type, ctime: 0, mtime: 0, size: 0 }) as FileStat };
}

describe("VscodeResourceKindReader", () => {
  const rejections: unknown[] = [];
  const onRejection = (reason: unknown): void => {
    rejections.push(reason);
  };
  beforeEach(() => {
    rejections.length = 0;
    process.on("unhandledRejection", onRejection);
  });
  afterEach(() => {
    process.off("unhandledRejection", onRejection);
  });

  it("passes the URI to stat and decodes its type", async () => {
    const seen: Uri[] = [];
    const fs: Stat = {
      stat: async (uri) => {
        seen.push(uri);
        return { type: 1, ctime: 0, mtime: 0, size: 0 };
      },
    };
    expect((await new VscodeResourceKindReader(fs).read(someUri))?.equals(ResourceKind.file())).toBe(true);
    expect(seen).toEqual([someUri]);
  });

  it("decodes symbolic links with bit operations (65, 66, 64)", async () => {
    expect((await new VscodeResourceKindReader(statReturning(65)).read(someUri))?.isFile()).toBe(true);
    expect((await new VscodeResourceKindReader(statReturning(66)).read(someUri))?.isDirectory()).toBe(true);
    const dangling = await new VscodeResourceKindReader(statReturning(64)).read(someUri);
    expect(dangling?.equals(ResourceKind.unknown().throughSymbolicLink())).toBe(true);
  });

  it("a rejected stat (e.g. file just deleted) yields undefined", async () => {
    const fs: Stat = { stat: () => Promise.reject(new Error("EntryNotFound (FileSystemError)")) };
    await expect(new VscodeResourceKindReader(fs).read(someUri)).resolves.toBeUndefined();
  });

  it("a stat that throws synchronously yields undefined", async () => {
    const fs: Stat = {
      stat: () => {
        throw new Error("no file system provider for scheme");
      },
    };
    await expect(new VscodeResourceKindReader(fs).read(someUri)).resolves.toBeUndefined();
  });

  it("a failed stat leaves no unhandled promise rejection behind", async () => {
    const fs: Stat = { stat: () => Promise.reject(new Error("gone")) };
    await new VscodeResourceKindReader(fs).read(someUri);
    await new Promise((resolve) => setImmediate(resolve));
    await new Promise((resolve) => setTimeout(resolve, 10));
    expect(rejections).toEqual([]);
  });
});
