import { DirectoryEntry } from "../../src/DirectoryEntry.js";
import type { DirectoryLister } from "../../src/DirectoryLister.js";

/**
 * Test double for the Target `DirectoryLister`: answers a fixed list of
 * entries in the given order (a real directory has no order either), or
 * fails like an unreadable directory. Remembers which paths were asked for.
 */
export class FakeDirectoryLister implements DirectoryLister {
  private readonly entries: readonly DirectoryEntry[] | null;
  private readonly requested: string[] = [];

  private constructor(entries: readonly DirectoryEntry[] | null) {
    this.entries = entries;
  }

  /** A directory holding `directories` and `files`, listed in the order given (directories, then files). */
  static holding(directories: readonly string[], files: readonly string[]): FakeDirectoryLister {
    return FakeDirectoryLister.listing([
      ...directories.map((name) => new DirectoryEntry(name, true)),
      ...files.map((name) => new DirectoryEntry(name, false)),
    ]);
  }

  /** A directory whose entries come back exactly in this order. */
  static listing(entries: readonly DirectoryEntry[]): FakeDirectoryLister {
    return new FakeDirectoryLister([...entries]);
  }

  /** A directory that cannot be read: `list` throws a plain `Error`, as Node does. */
  static failing(): FakeDirectoryLister {
    return new FakeDirectoryLister(null);
  }

  list(path: string): DirectoryEntry[] {
    this.requested.push(path);
    if (this.entries === null) {
      throw new Error(`EACCES: permission denied, scandir '${path}'`);
    }
    return [...this.entries];
  }

  /** The paths `list` was called with, in order. */
  paths(): string[] {
    return [...this.requested];
  }
}
