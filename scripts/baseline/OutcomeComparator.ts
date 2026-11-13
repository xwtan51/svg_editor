import { Mismatch } from "./Mismatch.js";
import type { SessionOutcome } from "./SessionOutcome.js";
import { TextDiff } from "./TextDiff.js";

/** Compares a fresh run with the baseline byte for byte: stdout, stderr, exit code, files. */
export class OutcomeComparator {
  compare(session: string, expected: SessionOutcome, actual: SessionOutcome): Mismatch[] {
    const mismatches: Mismatch[] = [];
    this.compareText(mismatches, session, "stdout", `expected/${session}/stdout.txt`, expected.stdout, actual.stdout);
    this.compareText(mismatches, session, "stderr", "(expected: empty)", expected.stderr, actual.stderr);
    if (expected.exitCode !== actual.exitCode) {
      mismatches.push(new Mismatch(session, `exit code differs: expected ${expected.exitCode}, got ${actual.exitCode}`));
    }
    const names = new Set([...expected.files.keys(), ...actual.files.keys()]);
    for (const name of [...names].sort()) {
      const before = expected.files.get(name);
      const after = actual.files.get(name);
      if (before === undefined) {
        mismatches.push(new Mismatch(session, `unexpected file ${name} (not in baseline)`, new TextDiff(Buffer.alloc(0), after ?? Buffer.alloc(0)).unified("/dev/null", `actual/${name}`)));
      } else if (after === undefined) {
        mismatches.push(new Mismatch(session, `missing file ${name} (in baseline, not produced)`));
      } else {
        this.compareText(mismatches, session, `file ${name}`, `expected/${session}/files/${name}`, before, after);
      }
    }
    return mismatches;
  }

  private compareText(mismatches: Mismatch[], session: string, subject: string, expectedLabel: string, expected: Buffer, actual: Buffer): void {
    const diff = new TextDiff(expected, actual);
    if (diff.isEqual()) {
      return;
    }
    mismatches.push(new Mismatch(session, `${subject} differs at line ${diff.firstDifferentLine()}`, diff.unified(expectedLabel, `actual ${subject}`)));
  }
}
