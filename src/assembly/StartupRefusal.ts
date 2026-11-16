/**
 * The process must not start: the command line asks for something that
 * cannot be assembled (design §4.3) — a usage error from `CliArguments`, or an
 * `--only` name that is not in the code assembly. `main.ts` writes the message
 * on stderr as it is and exits with code 2, before any banner. Not a user
 * error of the editor (`EditorError`), and not a programming error.
 */
export class StartupRefusal extends Error {
  constructor(message: string) {
    super(message);
    this.name = "StartupRefusal";
  }
}
