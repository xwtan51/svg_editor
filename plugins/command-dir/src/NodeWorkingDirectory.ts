import type { WorkingDirectory } from "./WorkingDirectory.js";

/**
 * Adapter pattern, the Adapter for the second Target: the process's current
 * directory (the Adaptee: `process.cwd()`, an absolute path) as a
 * `WorkingDirectory`. The editor never changes it, so it stays the directory
 * the CLI was started in (spec §2.2).
 */
export class NodeWorkingDirectory implements WorkingDirectory {
  current(): string {
    return process.cwd();
  }
}
