/**
 * A minimal test runner for code that runs inside the VSCode extension host
 * (`--extensionTestsPath`). Cases run one after another, in order, because
 * they share one VSCode window. Prints one line per case; `run()` rejects when
 * any case failed, which makes VSCode exit with a non-zero code.
 */
export class IntegrationRunner {
  private readonly cases: { name: string; body: () => Promise<void> }[] = [];
  private readonly title: string;

  constructor(title: string) {
    this.title = title;
  }

  test(name: string, body: () => Promise<void>): void {
    this.cases.push({ name, body });
  }

  async run(): Promise<void> {
    console.log(`\n${this.title}`);
    const failures: string[] = [];
    for (const { name, body } of this.cases) {
      const started = Date.now();
      try {
        await body();
        console.log(`  ✓ ${name} (${Date.now() - started} ms)`);
      } catch (error) {
        failures.push(name);
        console.log(`  ✗ ${name}\n      ${error instanceof Error ? (error.stack ?? error.message).replace(/\n/g, "\n      ") : String(error)}`);
      }
    }
    console.log(`\n${this.cases.length - failures.length} passed, ${failures.length} failed\n`);
    if (failures.length > 0) {
      throw new Error(`${failures.length} integration test(s) failed: ${failures.join("; ")}`);
    }
  }

  /** Polls `condition` every 50 ms until it holds or `timeoutMs` passes. */
  static async waitFor(what: string, condition: () => boolean | Promise<boolean>, timeoutMs = 10_000): Promise<void> {
    const deadline = Date.now() + timeoutMs;
    while (!(await condition())) {
      if (Date.now() > deadline) {
        throw new Error(`timed out after ${timeoutMs} ms waiting for ${what}`);
      }
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
  }
}
