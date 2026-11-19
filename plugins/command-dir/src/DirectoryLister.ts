import type { DirectoryEntry } from "./DirectoryEntry.js";

/**
 * Adapter pattern, the Target: the directory access interface the `dir`
 * command (the Client) is written against (spec §2.2 "设计要求", design §8.2).
 * `NodeDirectoryLister` adapts Node's file system to it; tests use an
 * in-memory stand-in.
 */
export interface DirectoryLister {
  /**
   * The direct children of the directory at `path`, in no particular order,
   * hidden ones included, without `.` and `..`. Throws (any exception) when
   * the directory cannot be read; the Client turns that into the user error.
   */
  list(path: string): DirectoryEntry[];
}
