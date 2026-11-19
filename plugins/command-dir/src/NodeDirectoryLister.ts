import { readdirSync, statSync, type Dirent } from "node:fs";
import { join } from "node:path";
import { DirectoryEntry } from "./DirectoryEntry.js";
import type { DirectoryLister } from "./DirectoryLister.js";

/**
 * Adapter pattern, the Adapter: makes Node's file system (the Adaptee:
 * `readdirSync`, `Dirent`, `statSync`) fit the `DirectoryLister` Target. The
 * only class of the plugin besides `NodeWorkingDirectory` that touches Node,
 * hence the `Node` prefix (L9). A symbolic link is followed one level: it is a
 * directory when its target is one, and a file otherwise, a broken link
 * included (N3); everything else that is not a directory is a file.
 */
export class NodeDirectoryLister implements DirectoryLister {
  /** Throws Node's own error (e.g. `ENOENT`, `ENOTDIR`, `EACCES`) when `path` cannot be read. */
  list(path: string): DirectoryEntry[] {
    return readdirSync(path, { withFileTypes: true }).map((dirent) => new DirectoryEntry(dirent.name, this.isDirectory(path, dirent)));
  }

  private isDirectory(path: string, dirent: Dirent): boolean {
    if (!dirent.isSymbolicLink()) {
      return dirent.isDirectory();
    }
    try {
      return statSync(join(path, dirent.name)).isDirectory();
    } catch {
      return false;
    }
  }
}
