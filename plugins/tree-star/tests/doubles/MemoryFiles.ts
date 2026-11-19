import { EditorError } from "@svgframe/kernel";
import type { FileSystem } from "@svgframe/kernel";

/**
 * Test double: files kept in a map. Paths under `/no/such/dir/` cannot be
 * written, like a directory that does not exist; a missing path reads like a
 * missing file.
 */
export class MemoryFiles implements FileSystem {
  static readonly UNWRITABLE = "/no/such/dir/";

  private readonly files = new Map<string, string>();

  readText(path: string): string {
    const text = this.files.get(path);
    if (text === undefined) {
      throw new EditorError(`cannot read file: ${path}`);
    }
    return text;
  }

  writeText(path: string, text: string): void {
    if (path.startsWith(MemoryFiles.UNWRITABLE)) {
      throw new EditorError(`cannot write file: ${path}`);
    }
    this.files.set(path, text);
  }
}
