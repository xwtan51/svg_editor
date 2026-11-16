/**
 * Where a configured module lives (design §4.6, stage 1): its package
 * directory, its parsed `package.json` (the manifest the installer checks) and
 * the absolute path of its entry file (`exports["."]`). Nothing has been
 * imported yet.
 */
export class LocatedModule {
  private readonly packageDirectory: string;
  private readonly manifest: unknown;
  private readonly entry: string;

  constructor(packageDirectory: string, manifestJson: unknown, entryFile: string) {
    this.packageDirectory = packageDirectory;
    this.manifest = manifestJson;
    this.entry = entryFile;
  }

  directory(): string {
    return this.packageDirectory;
  }

  manifestJson(): unknown {
    return this.manifest;
  }

  entryFile(): string {
    return this.entry;
  }
}
