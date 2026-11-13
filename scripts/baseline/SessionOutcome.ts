/**
 * What one run of a session produced: stdout, stderr, exit code, and every file
 * left in its working directory (keyed by `/`-separated relative path).
 */
export class SessionOutcome {
  constructor(
    readonly stdout: Buffer,
    readonly stderr: Buffer,
    readonly exitCode: number,
    readonly files: ReadonlyMap<string, Buffer>,
  ) {}

  sortedFileNames(): string[] {
    return [...this.files.keys()].sort();
  }
}
