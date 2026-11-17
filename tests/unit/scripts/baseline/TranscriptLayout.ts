import { mkdirSync, mkdtempSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { Writable } from "node:stream";
import { BaselineStore } from "../../../../scripts/baseline/BaselineStore.js";
import { SessionOutcome } from "../../../../scripts/baseline/SessionOutcome.js";
import { SessionRunner } from "../../../../scripts/baseline/SessionRunner.js";
import type { TranscriptSession } from "../../../../scripts/baseline/TranscriptSession.js";

/**
 * Test helper: a temporary repository root with a `doc/transcript/` directory,
 * so that the baseline tool's classes can be driven without the real
 * transcripts. `remove()` deletes it.
 */
export class TranscriptLayout {
  readonly repo: string;
  readonly transcript: string;

  constructor() {
    this.repo = realpathSync(mkdtempSync(join(tmpdir(), "svg-baseline-test-")));
    this.transcript = join(this.repo, "doc", "transcript");
    mkdirSync(this.transcript, { recursive: true });
  }

  /** Writes `doc/transcript/<relative>`. */
  write(relative: string, text: string): string {
    const location = join(this.transcript, relative);
    mkdirSync(dirname(location), { recursive: true });
    writeFileSync(location, text);
    return location;
  }

  session(name: string, input = "help\n"): void {
    this.write(`${name}.txt`, input);
  }

  runs(name: string, plan: unknown): void {
    this.write(`${name}.runs.json`, typeof plan === "string" ? plan : `${JSON.stringify(plan, null, 2)}\n`);
  }

  store(): BaselineStore {
    return new BaselineStore(join(this.transcript, "expected"));
  }

  /** Stores `outcome` as the baseline `name`. */
  baseline(name: string, outcome: SessionOutcome): void {
    this.store().write(name, outcome);
  }

  remove(): void {
    rmSync(this.repo, { recursive: true, force: true });
  }

  /** An outcome with this stdout, empty stderr, exit 0 and no files (or the given ones). */
  static outcome(stdout: string, files: Record<string, string> = {}, exitCode = 0, stderr = ""): SessionOutcome {
    return new SessionOutcome(
      Buffer.from(stdout),
      Buffer.from(stderr),
      exitCode,
      new Map(Object.entries(files).map(([name, text]) => [name, Buffer.from(text)])),
    );
  }
}

/** A runner that answers from a script instead of starting the CLI, and records every run. */
export class ScriptedRunner extends SessionRunner {
  readonly calls: string[] = [];
  private readonly answer: (session: string, args: readonly string[]) => SessionOutcome;

  constructor(answer: (session: string, args: readonly string[]) => SessionOutcome) {
    super();
    this.answer = answer;
  }

  override run(session: TranscriptSession, args: readonly string[]): SessionOutcome {
    this.calls.push(`${session.name} ${JSON.stringify(args)}`);
    return this.answer(session.name, args);
  }
}

/** Collects everything written to it. */
export class TextSink extends Writable {
  private text = "";

  override _write(chunk: Buffer | string, _encoding: BufferEncoding, done: (error?: Error | null) => void): void {
    this.text += chunk.toString();
    done();
  }

  contents(): string {
    return this.text;
  }

  lines(): string[] {
    return this.text.split("\n").filter((line) => line.length > 0);
  }
}
