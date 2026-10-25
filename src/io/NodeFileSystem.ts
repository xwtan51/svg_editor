import { readFileSync, writeFileSync } from "node:fs";
import { EditorError } from "../model/EditorError.js";
import type { FileSystem } from "./FileSystem.js";

/**
 * `FileSystem` on Node's synchronous fs API; the only file allowed to import
 * `node:fs` (rule P1). Relative paths resolve against the process's current
 * directory (F19). Any OS error is reported with the §4.2 message only.
 */
export class NodeFileSystem implements FileSystem {
  readText(path: string): string {
    try {
      return readFileSync(path, "utf8");
    } catch {
      throw new EditorError(`cannot read file: ${path}`);
    }
  }

  writeText(path: string, text: string): void {
    try {
      writeFileSync(path, text, "utf8");
    } catch {
      throw new EditorError(`cannot write file: ${path}`);
    }
  }
}
