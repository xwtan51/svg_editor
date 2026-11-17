import path from "node:path";
import { BaselinePaths } from "./BaselinePaths.js";
import { BaselineStore } from "./BaselineStore.js";
import { Mismatch } from "./Mismatch.js";
import { OutcomeComparator } from "./OutcomeComparator.js";
import type { SessionOutcome } from "./SessionOutcome.js";
import { SessionPlan } from "./SessionPlan.js";
import { SessionRunner } from "./SessionRunner.js";
import { TranscriptSession } from "./TranscriptSession.js";

/**
 * The two modes of the baseline tool. Both run sessions through the same
 * `SessionRunner`, group by group as each session's `SessionPlan` says
 * (design §4.8), so a baseline is always produced exactly the way it is checked.
 *
 * - check (default): run every group of every session; each run must equal the
 *   group's baseline (if it has one), and the runs of a group must equal each
 *   other. Exit 0 only if nothing differs. The last line is always
 *   `baseline: <n> sessions, <m> difference(s) (…)`.
 * - update: run the groups with a baseline of the given sessions (all if none
 *   given) and overwrite those baselines. Groups without a baseline are not run.
 *   Refuses to write anything if a plan is invalid, if any run has a non-zero
 *   exit code or non-empty stderr, or if two runs meant for the same baseline
 *   differ (within a group or across groups).
 */
export class BaselineTool {
  static readonly USAGE = "usage: baseline [--update [session…]]\n";

  private readonly out: NodeJS.WritableStream;
  private readonly runner: SessionRunner;
  private readonly transcriptDir: string;
  private readonly repoRoot: string;
  private readonly store: BaselineStore;
  private readonly comparator = new OutcomeComparator();

  /** The runner and the directories are parameters for tests; the tool uses the repository's. */
  constructor(
    out: NodeJS.WritableStream,
    runner: SessionRunner = new SessionRunner(),
    transcriptDir: string = BaselinePaths.TRANSCRIPT_DIR,
    repoRoot: string = BaselinePaths.REPO_ROOT,
  ) {
    this.out = out;
    this.runner = runner;
    this.transcriptDir = transcriptDir;
    this.repoRoot = repoRoot;
    this.store = new BaselineStore(path.join(transcriptDir, BaselinePaths.EXPECTED));
  }

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
    const plans = TranscriptSession.discoverAll(this.transcriptDir).map((session) => SessionPlan.read(session, this.repoRoot));
    const mismatches: Mismatch[] = [];
    for (const stray of TranscriptSession.strayRunFiles(this.transcriptDir)) {
      mismatches.push(new Mismatch(stray, `doc/transcript/${stray}${TranscriptSession.RUNS_SUFFIX} exists but doc/transcript/${stray}${TranscriptSession.INPUT_SUFFIX} does not`));
    }
    const used = new Set(plans.flatMap((plan) => plan.expectedNames()));
    for (const orphan of TranscriptSession.baselineNames(this.transcriptDir).filter((name) => !used.has(name))) {
      mismatches.push(new Mismatch(orphan, `baseline expected/${orphan} is used by no session (no .runs.json names it and no ${orphan}.txt runs by default)`));
    }
    let runs = 0;
    for (const plan of plans) {
      const problem = plan.problem();
      if (problem !== null) {
        mismatches.push(new Mismatch(plan.session().name, problem));
        continue;
      }
      for (const group of plan.groups()) {
        const found = group.check(group.execute(this.runner), this.store, this.comparator);
        runs += group.size();
        if (found.length === 0) {
          this.out.write(`ok   ${group.describe()}\n`);
        }
        mismatches.push(...found);
      }
    }
    for (const mismatch of mismatches) {
      this.out.write(mismatch.render());
    }
    this.out.write(
      `baseline: ${plans.length} sessions, ${mismatches.length} difference${mismatches.length === 1 ? "" : "s"} (entry ${BaselinePaths.CLI_ENTRY}; ${runs} run${runs === 1 ? "" : "s"})\n`,
    );
    return mismatches.length === 0 ? 0 : 1;
  }

  update(names: readonly string[]): number {
    const all = TranscriptSession.discoverAll(this.transcriptDir);
    const unknown = names.filter((name) => !all.some((session) => session.name === name));
    if (unknown.length > 0) {
      this.out.write(`error: no such session: ${unknown.join(", ")}\n`);
      return 2;
    }
    const selected = names.length === 0 ? all : all.filter((session) => names.includes(session.name));
    /** Baseline name → every outcome meant for it, with the run that produced it. */
    const targets = new Map<string, { owner: string; outcome: SessionOutcome }[]>();
    let failed = false;
    for (const session of selected) {
      const plan = SessionPlan.read(session, this.repoRoot);
      const problem = plan.problem();
      if (problem !== null) {
        this.out.write(`error: ${session.name}: ${problem}\n`);
        failed = true;
        continue;
      }
      const groups = plan.groups().filter((group) => group.expected() !== null);
      if (groups.length === 0) {
        this.out.write(`skip ${session.name}: no group has an expected output\n`);
      }
      for (const group of groups) {
        group.execute(this.runner).forEach((outcome, index) => {
          const owner = `${session.name} ${group.runLabel(index)}`;
          if (outcome.exitCode !== 0 || outcome.stderr.length > 0) {
            this.out.write(`error: ${owner}: exit code ${outcome.exitCode}, stderr:\n${outcome.stderr.toString("utf8")}`);
            failed = true;
          }
          const name = group.expected() ?? "";
          targets.set(name, [...(targets.get(name) ?? []), { owner, outcome }]);
        });
      }
    }
    for (const [name, outcomes] of targets) {
      const [first, ...rest] = outcomes;
      if (first === undefined) {
        continue;
      }
      for (const other of rest) {
        const found = this.comparator.compare(`expected/${name}: ${first.owner} vs ${other.owner}`, first.owner, other.owner, first.outcome, other.outcome);
        for (const mismatch of found) {
          this.out.write(mismatch.render());
        }
        failed ||= found.length > 0;
      }
    }
    if (failed) {
      this.out.write("baseline not written\n");
      return 1;
    }
    for (const [name, [first]] of targets) {
      if (first === undefined) {
        continue;
      }
      const outcome = first.outcome;
      this.store.write(name, outcome);
      const lines = outcome.stdout.toString("utf8").split("\n").length - 1;
      this.out.write(
        `wrote doc/transcript/expected/${name}: stdout ${lines} lines, exit ${outcome.exitCode}, files ${outcome.sortedFileNames().join(" ") || "(none)"}\n`,
      );
    }
    return 0;
  }
}
