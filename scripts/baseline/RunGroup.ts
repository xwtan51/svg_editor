import { Mismatch } from "./Mismatch.js";
import type { BaselineStore } from "./BaselineStore.js";
import type { OutcomeComparator } from "./OutcomeComparator.js";
import type { SessionOutcome } from "./SessionOutcome.js";
import type { SessionRunner } from "./SessionRunner.js";
import type { TranscriptSession } from "./TranscriptSession.js";

/**
 * One group of a session's runs (design §4.8): the same input run once per
 * argument list. Every run is compared byte for byte with the group's
 * baseline when it has one, and the runs are compared with each other pair by
 * pair (the two assemblies must agree, design §4.7).
 *
 * A run is identified in reports by its arguments as written in the
 * `.runs.json` (placeholders such as `{transcript}` kept), so that a report is
 * the same on every machine; the CLI receives the expanded arguments.
 */
export class RunGroup {
  private readonly session: TranscriptSession;
  private readonly expectedName: string | null;
  private readonly written: readonly (readonly string[])[];
  private readonly expanded: readonly (readonly string[])[];

  /** `written` and `expanded` are the same runs, before and after placeholder expansion. */
  constructor(session: TranscriptSession, expected: string | null, written: readonly (readonly string[])[], expanded: readonly (readonly string[])[]) {
    if (written.length === 0 || written.length !== expanded.length) {
      throw new Error(`run group of ${session.name}: ${written.length} written runs, ${expanded.length} expanded`);
    }
    this.session = session;
    this.expectedName = expected;
    this.written = written.map((run) => [...run]);
    this.expanded = expanded.map((run) => [...run]);
  }

  /** The baseline name under `expected/`, or null for a group that only compares its runs with each other. */
  expected(): string | null {
    return this.expectedName;
  }

  size(): number {
    return this.written.length;
  }

  /** Arguments of run `index` as written in the `.runs.json`, e.g. `["--bare"]`. */
  runLabel(index: number): string {
    return JSON.stringify(this.written[index] ?? []);
  }

  /** The written argument lists, in order. */
  writtenRuns(): readonly (readonly string[])[] {
    return this.written;
  }

  /** The argument lists the CLI receives, in order. */
  expandedRuns(): readonly (readonly string[])[] {
    return this.expanded;
  }

  /** Runs every argument list, in order. */
  execute(runner: SessionRunner): SessionOutcome[] {
    return this.expanded.map((args) => runner.run(this.session, args));
  }

  /** Every difference: each run against the baseline (if any), then each pair of runs. */
  check(outcomes: readonly SessionOutcome[], store: BaselineStore, comparator: OutcomeComparator): Mismatch[] {
    const mismatches: Mismatch[] = [];
    const expected = this.expectedName;
    if (expected !== null) {
      if (!store.exists(expected)) {
        mismatches.push(
          new Mismatch(this.session.name, `no baseline expected/${expected} (generating one needs explicit approval, see doc/transcript/README.md)`),
        );
      } else {
        const baseline = store.read(expected);
        outcomes.forEach((outcome, index) => {
          const label = this.runLabel(index);
          mismatches.push(...comparator.compare(`${this.session.name} ${label} vs expected/${expected}`, `expected/${expected}`, label, baseline, outcome));
        });
      }
    }
    mismatches.push(...this.disagreements(outcomes, comparator));
    return mismatches;
  }

  /** Differences between the runs of the group, pair by pair (first with second, first with third, …). */
  disagreements(outcomes: readonly SessionOutcome[], comparator: OutcomeComparator): Mismatch[] {
    const mismatches: Mismatch[] = [];
    for (let i = 0; i < outcomes.length; i++) {
      for (let j = i + 1; j < outcomes.length; j++) {
        const left = outcomes[i];
        const right = outcomes[j];
        if (left === undefined || right === undefined) {
          continue;
        }
        const leftLabel = this.runLabel(i);
        const rightLabel = this.runLabel(j);
        mismatches.push(...comparator.compare(`${this.session.name} ${leftLabel} vs ${rightLabel}`, leftLabel, rightLabel, left, right));
      }
    }
    return mismatches;
  }

  /** One line for a group without differences, e.g. `cli-1 vs expected/cli-1 (2 runs)`. */
  describe(): string {
    const runs = `${this.size()} run${this.size() === 1 ? "" : "s"}`;
    return this.expectedName === null ? `${this.session.name}: runs agree (${runs}, no expected output)` : `${this.session.name} vs expected/${this.expectedName} (${runs})`;
  }
}
