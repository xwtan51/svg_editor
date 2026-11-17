import { Mismatch } from "./Mismatch.js";
import type { SessionOutcome } from "./SessionOutcome.js";
import { TextDiff } from "./TextDiff.js";

/**
 * Compares two outcomes byte for byte: stdout, stderr, exit code, files. Used
 * both for a run against its baseline and for two runs of one group against
 * each other (design §4.8); the labels say which is which.
 */
export class OutcomeComparator {
  /**
   * `owner` heads every mismatch (`FAIL <owner>: …`); `leftLabel` and
   * `rightLabel` name the two sides in headlines and diff headers, e.g.
   * `expected/cli-1` and `["--bare"]`.
   */
  compare(owner: string, leftLabel: string, rightLabel: string, left: SessionOutcome, right: SessionOutcome): Mismatch[] {
    const mismatches: Mismatch[] = [];
    this.compareText(mismatches, owner, "stdout", leftLabel, rightLabel, left.stdout, right.stdout);
    this.compareText(mismatches, owner, "stderr", leftLabel, rightLabel, left.stderr, right.stderr);
    if (left.exitCode !== right.exitCode) {
      mismatches.push(new Mismatch(owner, `exit code differs: ${leftLabel} ${left.exitCode}, ${rightLabel} ${right.exitCode}`));
    }
    const names = new Set([...left.files.keys(), ...right.files.keys()]);
    for (const name of [...names].sort()) {
      const before = left.files.get(name);
      const after = right.files.get(name);
      if (before === undefined) {
        mismatches.push(
          new Mismatch(
            owner,
            `file ${name} only in ${rightLabel} (not in ${leftLabel})`,
            new TextDiff(Buffer.alloc(0), after ?? Buffer.alloc(0)).unified("/dev/null", `${rightLabel} file ${name}`),
          ),
        );
      } else if (after === undefined) {
        mismatches.push(new Mismatch(owner, `file ${name} only in ${leftLabel} (not in ${rightLabel})`));
      } else {
        this.compareText(mismatches, owner, `file ${name}`, leftLabel, rightLabel, before, after);
      }
    }
    return mismatches;
  }

  private compareText(
    mismatches: Mismatch[],
    owner: string,
    subject: string,
    leftLabel: string,
    rightLabel: string,
    left: Buffer,
    right: Buffer,
  ): void {
    const diff = new TextDiff(left, right);
    if (diff.isEqual()) {
      return;
    }
    mismatches.push(
      new Mismatch(owner, `${subject} differs at line ${diff.firstDifferentLine()}`, diff.unified(`${leftLabel} ${subject}`, `${rightLabel} ${subject}`)),
    );
  }
}
