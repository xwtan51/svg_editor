/**
 * The result of one `PluginInstaller.install`: success, or the single failure
 * line (without the `error: ` prefix, which only the editor and the assembler add).
 */
export class InstallOutcome {
  private static readonly SUCCESS = new InstallOutcome(null);

  private readonly failure: string | null;

  private constructor(failure: string | null) {
    this.failure = failure;
  }

  static success(): InstallOutcome {
    return InstallOutcome.SUCCESS;
  }

  static failed(message: string): InstallOutcome {
    return new InstallOutcome(message);
  }

  succeeded(): boolean {
    return this.failure === null;
  }

  /** The failure line, e.g. `duplicate registration: shapes/box`; asking a success for it is a programming error. */
  message(): string {
    if (this.failure === null) {
      throw new Error("a successful installation has no failure message");
    }
    return this.failure;
  }
}
