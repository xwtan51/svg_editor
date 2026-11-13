import type { FileSystem, Uri } from "vscode";
import { FileTypeMask } from "../core/FileTypeMask.js";
import type { ResourceKind } from "../core/ResourceKind.js";

/**
 * Adapter: `workspace.fs.stat(uri).type` (a `vscode.FileType` bit mask) →
 * `ResourceKind`. The bit decoding itself lives in `FileTypeMask` (no `vscode`).
 *
 * Only type imports from `vscode`, so the class loads without the real module
 * and is unit-tested with a fake `FileSystem`.
 *
 * Never rejects: a failed `stat` (resource just deleted, permission denied,
 * no file-system provider for the scheme, …) yields `undefined` — "type unknown,
 * no badge" — instead of an exception or an unhandled promise rejection.
 */
export class VscodeResourceKindReader {
  private readonly fileSystem: Pick<FileSystem, "stat">;

  constructor(fileSystem: Pick<FileSystem, "stat">) {
    this.fileSystem = fileSystem;
  }

  async read(uri: Uri): Promise<ResourceKind | undefined> {
    try {
      const stat = await this.fileSystem.stat(uri);
      return new FileTypeMask(stat.type).toResourceKind();
    } catch {
      return undefined;
    }
  }
}
