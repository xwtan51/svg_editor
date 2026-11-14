import { EditorError } from "@svgframe/kernel";
import type { FileSystem } from "@svgframe/kernel";

/** Test double: files live in a map; a missing path behaves like a missing file. */
export class FakeFileSystem implements FileSystem {
  private readonly files = new Map<string, string>();

  constructor(files: Record<string, string> = {}) {
    for (const [path, text] of Object.entries(files)) {
      this.files.set(path, text);
    }
  }

  readText(path: string): string {
    const text = this.files.get(path);
    if (text === undefined) {
      throw new EditorError(`cannot read file: ${path}`);
    }
    return text;
  }

  writeText(path: string, text: string): void {
    this.files.set(path, text);
  }
}
