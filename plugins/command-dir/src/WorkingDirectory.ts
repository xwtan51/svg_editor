/**
 * Adapter pattern, a second Target: where the `dir` command (the Client)
 * learns which directory to list. `NodeWorkingDirectory` adapts the process's
 * current directory to it; tests use a fixed path. `read` and `save` do not
 * change it (spec §2.2).
 */
export interface WorkingDirectory {
  /** The absolute path of the current working directory (N7). */
  current(): string;
}
