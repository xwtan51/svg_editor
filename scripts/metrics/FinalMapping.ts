import path from "node:path";
import type { GitRepository } from "../shared/GitRepository.js";

/**
 * Where each file of `final` went in a revision `R` (design §5.3): `final`
 * had no kernel / host / plugin directories, so a file of `final` is
 * classified by its path in `R`.
 *
 * 1. `git diff --find-renames --name-status final R`, **without** a pathspec:
 *    limited to `final`'s files, git cannot see the targets of renames and
 *    reports every moved file as deleted.
 * 2. A file of `final` that still exists at the same path maps to itself; a
 *    renamed one maps to its new path.
 * 3. A file still reported deleted is looked up by its file name (one class
 *    per file, file name = class name): it maps to the run-code file of `R`
 *    with the same name when there is exactly one such file, no other file is
 *    mapped or renamed to it, and no other deleted file of `final` has the
 *    same name. This recovers files rewritten beyond the rename threshold.
 * 4. Anything else, or a target that is not run code of `R`, is deleted.
 */
export class FinalMapping {
  static readonly SAME_PATH = "same path";
  static readonly RENAMED = "renamed";
  static readonly BY_FILE_NAME = "by file name";
  static readonly DELETED = "deleted";

  private readonly targets: ReadonlyMap<string, { target: string | null; how: string }>;

  private constructor(targets: ReadonlyMap<string, { target: string | null; how: string }>) {
    this.targets = targets;
  }

  /**
   * `finalFiles`: the files of `final` to map; `runFiles`: the run-code files
   * of `R` (the only possible targets).
   */
  static build(git: GitRepository, final: string, revision: string, finalFiles: readonly string[], runFiles: readonly string[]): FinalMapping {
    const fields = git.text(["diff", "--no-color", "--no-ext-diff", "--find-renames", "--name-status", "-z", final, revision]).split("\0");
    const renamed = new Map<string, string>();
    const deleted = new Set<string>();
    for (let i = 0; i < fields.length; ) {
      const status = fields[i] ?? "";
      if (status === "") {
        i += 1;
      } else if (status.startsWith("R") || status.startsWith("C")) {
        if (status.startsWith("R")) renamed.set(fields[i + 1] ?? "", fields[i + 2] ?? "");
        i += 3;
      } else {
        if (status === "D") deleted.add(fields[i + 1] ?? "");
        i += 2;
      }
    }
    const run = new Set(runFiles);
    const targets = new Map<string, { target: string | null; how: string }>();
    const taken = new Set(renamed.values());
    const unresolved: string[] = [];
    for (const file of finalFiles) {
      const newPath = renamed.get(file);
      if (newPath !== undefined) {
        targets.set(file, run.has(newPath) ? { target: newPath, how: FinalMapping.RENAMED } : { target: null, how: FinalMapping.DELETED });
      } else if (deleted.has(file)) {
        unresolved.push(file);
      } else {
        targets.set(file, run.has(file) ? { target: file, how: FinalMapping.SAME_PATH } : { target: null, how: FinalMapping.DELETED });
        taken.add(file);
      }
    }
    const nameOf = (file: string) => path.posix.basename(file);
    for (const file of unresolved) {
      const name = nameOf(file);
      const candidates = runFiles.filter((candidate) => nameOf(candidate) === name);
      const [candidate] = candidates;
      const unique = candidates.length === 1 && unresolved.filter((other) => nameOf(other) === name).length === 1;
      targets.set(
        file,
        unique && candidate !== undefined && !taken.has(candidate) ? { target: candidate, how: FinalMapping.BY_FILE_NAME } : { target: null, how: FinalMapping.DELETED },
      );
    }
    return new FinalMapping(targets);
  }

  /** The path in `R` of `finalFile`, or null when it was deleted. */
  targetOf(finalFile: string): string | null {
    return this.targets.get(finalFile)?.target ?? null;
  }

  /** How `finalFile` was mapped: same path, renamed, by file name or deleted. */
  how(finalFile: string): string {
    return this.targets.get(finalFile)?.how ?? FinalMapping.DELETED;
  }
}
