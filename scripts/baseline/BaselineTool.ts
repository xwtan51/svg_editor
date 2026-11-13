import { BaselinePaths } from "./BaselinePaths.js";
import { BaselineStore } from "./BaselineStore.js";
import { Mismatch } from "./Mismatch.js";
import { OutcomeComparator } from "./OutcomeComparator.js";
import type { SessionOutcome } from "./SessionOutcome.js";
import { SessionRunner } from "./SessionRunner.js";
import { TranscriptSession } from "./TranscriptSession.js";

/**
 * The two modes of the baseline tool. Both run sessions through the same
 * `SessionRunner`, so a baseline is always produced exactly the way it is checked.
 *
 * - check (default): rerun every session and compare with its baseline; exit 0 only if all match.
 * - update: rerun the given sessions (all if none given) and overwrite their baselines.
 *   Refuses to write anything if any run has a non-zero exit code or non-empty stderr.
 */
export class BaselineTool {
  static readonly USAGE = "usage: baseline [--update [session…]]\n";

  private readonly runner = new SessionRunner();
  private readonly store = new BaselineStore();
  private readonly comparator = new OutcomeComparator();

  constructor(private readonly out: NodeJS.WritableStream) {}

  /** Parses the command line and runs the selected mode; resolves to the process exit code. */
  main(args: readonly string[]): number {
    if (args.length === 0) {
      return this.check();
    }
    if (args[0] === "--update" && args.slice(1).every((arg) => !arg.startsWith("-"))) {
      return this.update(args.slice(1));
    }
    this.out.write(BaselineTool.USAGE);
    return 2;
  }

  check(): number {
    const sessions = TranscriptSession.discoverAll();
    const mismatches: Mismatch[] = [];
    const known = new Set(sessions.map((session) => session.name));
    for (const orphan of TranscriptSession.baselineNames().filter((name) => !known.has(name))) {
      mismatches.push(new Mismatch(orphan, `baseline exists but doc/transcript/${orphan}.txt does not`));
    }
    for (const session of sessions) {
      if (!this.store.exists(session)) {
        mismatches.push(new Mismatch(session.name, "no baseline (generating one needs explicit approval, see doc/transcript/README.md)"));
        continue;
      }
      const found = this.comparator.compare(session.name, this.store.read(session), this.runner.run(session));
      if (found.length === 0) {
        this.out.write(`ok   ${session.name}\n`);
      }
      mismatches.push(...found);
    }
    for (const mismatch of mismatches) {
      this.out.write(mismatch.render());
    }
    this.out.write(`baseline: ${sessions.length} sessions, ${mismatches.length} difference${mismatches.length === 1 ? "" : "s"} (entry ${BaselinePaths.CLI_ENTRY})\n`);
    return mismatches.length === 0 ? 0 : 1;
  }

  update(names: readonly string[]): number {
    const all = TranscriptSession.discoverAll();
    const unknown = names.filter((name) => !all.some((session) => session.name === name));
    if (unknown.length > 0) {
      this.out.write(`error: no such session: ${unknown.join(", ")}\n`);
      return 2;
    }
    const selected = names.length === 0 ? all : all.filter((session) => names.includes(session.name));
    const outcomes = new Map<TranscriptSession, SessionOutcome>();
    let failed = false;
    for (const session of selected) {
      const outcome = this.runner.run(session);
      if (outcome.exitCode !== 0 || outcome.stderr.length > 0) {
        this.out.write(`error: ${session.name}: exit code ${outcome.exitCode}, stderr:\n${outcome.stderr.toString("utf8")}`);
        failed = true;
      }
      outcomes.set(session, outcome);
    }
    if (failed) {
      this.out.write("baseline not written\n");
      return 1;
    }
    for (const [session, outcome] of outcomes) {
      this.store.write(session, outcome);
      const lines = outcome.stdout.toString("utf8").split("\n").length - 1;
      this.out.write(`wrote ${BaselinePaths.display(session.expectedDir)}: stdout ${lines} lines, exit ${outcome.exitCode}, files ${outcome.sortedFileNames().join(" ") || "(none)"}\n`);
    }
    return 0;
  }
}
