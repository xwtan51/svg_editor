import type { WorkingDirectory } from "../../src/WorkingDirectory.js";

/** Test double for the Target `WorkingDirectory`: always the same path, chosen by the test. */
export class FakeWorkingDirectory implements WorkingDirectory {
  private readonly path: string;

  constructor(path: string) {
    this.path = path;
  }

  current(): string {
    return this.path;
  }
}
