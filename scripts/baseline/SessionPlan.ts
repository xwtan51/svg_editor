import fs from "node:fs";
import { BaselinePaths } from "./BaselinePaths.js";
import { RunGroup } from "./RunGroup.js";
import type { TranscriptSession } from "./TranscriptSession.js";

/**
 * How a session is run (design §4.8): the run groups of its optional
 * `doc/transcript/<session>.runs.json`,
 *
 *     { "groups": [ { "expected": "<name under expected/>" | null, "runs": [[arg, …], …] } ] }
 *
 * or, without that file, `{ "groups": [ { "expected": "<session>", "runs": [[]] } ] }`
 * — one run without arguments compared with `expected/<session>/`, the
 * behaviour before run groups existed.
 *
 * The file is checked strictly: an unknown key, an empty `groups` or `runs`,
 * a missing key, an argument that is not a string, an `expected` that is
 * neither a baseline name nor null, or an unknown `{placeholder}` makes the
 * plan invalid. An invalid plan has no groups and a `problem()`, which the
 * tool reports as a difference (never ignored).
 */
export class SessionPlan {
  /** A baseline name is a directory name under `expected/`: no separators, no leading dot. */
  private static readonly BASELINE_NAME = /^[A-Za-z0-9][A-Za-z0-9._-]*$/;
  private static readonly PLACEHOLDER = /\{[^{}]*\}/g;
  private static readonly PLACEHOLDERS = [BaselinePaths.REPO_PLACEHOLDER, BaselinePaths.TRANSCRIPT_PLACEHOLDER];

  private readonly owner: TranscriptSession;
  private readonly runGroups: readonly RunGroup[];
  private readonly invalidity: string | null;

  private constructor(session: TranscriptSession, groups: readonly RunGroup[], problem: string | null) {
    this.owner = session;
    this.runGroups = groups;
    this.invalidity = problem;
  }

  /** Reads the plan of `session`; `{repo}` expands to `repoRoot`, `{transcript}` to the session's transcript directory. */
  static read(session: TranscriptSession, repoRoot: string = BaselinePaths.REPO_ROOT): SessionPlan {
    if (!session.hasRuns()) {
      return new SessionPlan(session, [new RunGroup(session, session.name, [[]], [[]])], null);
    }
    let json: unknown;
    try {
      json = JSON.parse(fs.readFileSync(session.runsPath, "utf8"));
    } catch {
      return SessionPlan.invalid(session, "not valid JSON");
    }
    const problem = SessionPlan.problemOf(json);
    if (problem !== null) {
      return SessionPlan.invalid(session, problem);
    }
    const groups = (json as { groups: { expected: string | null; runs: string[][] }[] }).groups.map(
      (group) =>
        new RunGroup(
          session,
          group.expected,
          group.runs,
          group.runs.map((run) => run.map((argument) => BaselinePaths.expand(argument, repoRoot, session.transcriptDir))),
        ),
    );
    return new SessionPlan(session, groups, null);
  }

  session(): TranscriptSession {
    return this.owner;
  }

  groups(): readonly RunGroup[] {
    return this.runGroups;
  }

  /** Why the `.runs.json` is invalid, or null. */
  problem(): string | null {
    return this.invalidity;
  }

  /**
   * The baseline names this session uses. An invalid plan is taken to use the
   * session's own name, so that its baseline is not also reported as an orphan.
   */
  expectedNames(): string[] {
    if (this.invalidity !== null) {
      return [this.owner.name];
    }
    return this.runGroups.map((group) => group.expected()).filter((name): name is string => name !== null);
  }

  private static invalid(session: TranscriptSession, problem: string): SessionPlan {
    return new SessionPlan(session, [], `invalid doc/transcript/${session.name}.runs.json: ${problem}`);
  }

  /** The first rule `json` breaks, or null. */
  private static problemOf(json: unknown): string | null {
    if (!SessionPlan.isObject(json)) {
      return "the top level must be an object";
    }
    const topKeys = SessionPlan.keyProblem(json, ["groups"], "the top level");
    if (topKeys !== null) {
      return topKeys;
    }
    const groups = json["groups"];
    if (!Array.isArray(groups) || groups.length === 0) {
      return `"groups" must be a non-empty array`;
    }
    for (const [g, group] of groups.entries()) {
      const where = `groups[${g}]`;
      if (!SessionPlan.isObject(group)) {
        return `${where} must be an object`;
      }
      const groupKeys = SessionPlan.keyProblem(group, ["expected", "runs"], where);
      if (groupKeys !== null) {
        return groupKeys;
      }
      const expected = group["expected"];
      if (expected !== null && (typeof expected !== "string" || !SessionPlan.BASELINE_NAME.test(expected))) {
        return `${where}.expected must be a baseline name (a directory name under expected/) or null`;
      }
      const runs = group["runs"];
      if (!Array.isArray(runs) || runs.length === 0) {
        return `${where}.runs must be a non-empty array`;
      }
      for (const [r, run] of runs.entries()) {
        if (!Array.isArray(run) || !run.every((argument) => typeof argument === "string")) {
          return `${where}.runs[${r}] must be an array of strings`;
        }
        for (const argument of run as string[]) {
          const unknown = (argument.match(SessionPlan.PLACEHOLDER) ?? []).find((token) => !SessionPlan.PLACEHOLDERS.includes(token));
          if (unknown !== undefined) {
            return `${where}.runs[${r}]: unknown placeholder ${unknown} (known: ${SessionPlan.PLACEHOLDERS.join(", ")})`;
          }
        }
      }
    }
    return null;
  }

  /** An unknown key, or a missing one, of `object`. */
  private static keyProblem(object: Record<string, unknown>, keys: readonly string[], where: string): string | null {
    const unknown = Object.keys(object).find((key) => !keys.includes(key));
    if (unknown !== undefined) {
      return `unknown key ${JSON.stringify(unknown)} in ${where}`;
    }
    const missing = keys.find((key) => !Object.hasOwn(object, key));
    return missing === undefined ? null : `missing key ${JSON.stringify(missing)} in ${where}`;
  }

  private static isObject(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null && !Array.isArray(value);
  }
}
