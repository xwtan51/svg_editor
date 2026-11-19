import type {
  AttributePlanner,
  CommandCatalog,
  CommandContext,
  FileSystem,
  ShapeCatalog,
  SvgDocument,
  TreeDecorator,
  UndoStack,
} from "@svgframe/kernel";

/**
 * Test double: a command context every method of which throws, so a command
 * that runs to the end against it provably used none of them (design §8.2:
 * `dir` does not call the context at all).
 */
export class UntouchableContext implements CommandContext {
  document(): SvgDocument {
    return this.touched("document");
  }

  hasDocument(): boolean {
    return this.touched("hasDocument");
  }

  replaceDocument(_document: SvgDocument, _path: string | null): void {
    this.touched("replaceDocument");
  }

  filePath(): string | null {
    return this.touched("filePath");
  }

  markSaved(_path: string): void {
    this.touched("markSaved");
  }

  fileSystem(): FileSystem {
    return this.touched("fileSystem");
  }

  history(): UndoStack {
    return this.touched("history");
  }

  commands(): CommandCatalog {
    return this.touched("commands");
  }

  shapes(): ShapeCatalog {
    return this.touched("shapes");
  }

  attributeEdits(): AttributePlanner {
    return this.touched("attributeEdits");
  }

  treeDecorators(): readonly TreeDecorator[] {
    return this.touched("treeDecorators");
  }

  private touched(method: string): never {
    throw new Error(`test: the command called context.${method}()`);
  }
}
