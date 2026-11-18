import { EditorError } from "@svgframe/kernel";
import type { FileSystem } from "@svgframe/kernel";

/** Test double: a file system with no files that cannot be written; `stats` never touches files. */
export class NoFileSystem implements FileSystem {
  readText(path: string): string {
    throw new EditorError(`cannot read file: ${path}`);
  }

  writeText(path: string, _text: string): void {
    throw new EditorError(`cannot write file: ${path}`);
  }
}
