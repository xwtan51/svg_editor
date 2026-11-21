import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { FinalMapping } from "../../../../scripts/metrics/FinalMapping.js";
import { MetricsReport } from "../../../../scripts/metrics/MetricsReport.js";
import { TempGitRepo } from "../support/TempGitRepo.js";

/** `count` distinct lines, so that git's similarity is under control. */
const body = (tag: string, count = 20) => Array.from({ length: count }, (_, i) => `export const ${tag}${i} = "${tag} line ${i}";`).join("\n") + "\n";

let repo: TempGitRepo;
let mapping: FinalMapping;
let mappedWithPathspec: string[];

beforeAll(() => {
  repo = new TempGitRepo("svg-final-mapping-");
  const finalFiles = {
    "src/model/Pure.ts": body("pure"),
    "src/app/Session.ts": body("session"),
    "src/model/Gone.ts": body("gone"),
    "src/commands/Dup.ts": body("dup"),
    "src/a/Taken.ts": body("takenA"),
    "src/b/Taken.ts": body("takenB"),
    "src/x/Moved.ts": body("moved"),
    "src/cli/main.ts": body("main"),
    "src/c/Twin.ts": body("twinC"),
    "src/d/Twin.ts": body("twinD"),
  };
  repo.write(finalFiles);
  repo.commit("final");
  repo.git("tag", "final");
  repo.remove("src/model", "src/app", "src/commands", "src/a", "src/b", "src/x", "src/c", "src/d");
  repo.write({
    // pure rename, with a file of the same name elsewhere (so only rename detection finds it)
    "packages/kernel/src/model/Pure.ts": body("pure"),
    "plugins/x/src/Pure.ts": body("decoy"),
    // renamed and rewritten beyond the 50 % threshold: recovered by file name
    "packages/kernel/src/app/Session.ts": body("rewritten"),
    // the same name twice in R's run code: not unique
    "packages/kernel/src/commands/Dup.ts": body("dupKernel"),
    "plugins/x/src/Dup.ts": body("dupPlugin"),
    // a pure rename target cannot also be claimed by name
    "packages/kernel/src/Taken.ts": body("takenA"),
    // moved out of run code
    "tests/Moved.ts": body("moved"),
    // modified in place
    "src/cli/main.ts": body("main", 19) + "export const extra = 1;\n",
    // two deleted files of final share this name; the only one in R is rewritten beyond both
    "packages/kernel/src/Twin.ts": body("twinKernel"),
  });
  repo.commit("R");
  const git = repo.repository();
  const final = git.commit("final") ?? "";
  const r = git.commit("HEAD") ?? "";
  const runFiles = repo.git("ls-tree", "-r", "--name-only", r).split("\n").filter(MetricsReport.isRunCode);
  mapping = FinalMapping.build(git, final, r, Object.keys(finalFiles), runFiles);
  // What a pathspec limited to final's files would report (design §8.5): no renames at all.
  mappedWithPathspec = repo.git("diff", "--find-renames", "--name-status", "final", "HEAD", "--", ...Object.keys(finalFiles)).split("\n").filter((l) => l.startsWith("R"));
});
afterAll(() => repo.dispose());

describe("FinalMapping (design §5.3)", () => {
  it("pure rename → the new path, even with a file of the same name elsewhere", () => {
    expect(mapping.targetOf("src/model/Pure.ts")).toBe("packages/kernel/src/model/Pure.ts");
    expect(mapping.how("src/model/Pure.ts")).toBe(FinalMapping.RENAMED);
  });

  it("renamed and heavily rewritten → found by its unique file name", () => {
    expect(mapping.targetOf("src/app/Session.ts")).toBe("packages/kernel/src/app/Session.ts");
    expect(mapping.how("src/app/Session.ts")).toBe(FinalMapping.BY_FILE_NAME);
  });

  it("really deleted → deleted", () => {
    expect(mapping.targetOf("src/model/Gone.ts")).toBeNull();
    expect(mapping.how("src/model/Gone.ts")).toBe(FinalMapping.DELETED);
  });

  it("the file name is not unique in R's run code → deleted", () => {
    expect(mapping.targetOf("src/commands/Dup.ts")).toBeNull();
  });

  it("the only file of that name is already a rename target → deleted", () => {
    expect(mapping.targetOf("src/a/Taken.ts")).toBe("packages/kernel/src/Taken.ts");
    expect(mapping.targetOf("src/b/Taken.ts")).toBeNull();
  });

  it("moved out of run code → deleted; modified in place → same path", () => {
    expect(mapping.targetOf("src/x/Moved.ts")).toBeNull();
    expect(mapping.targetOf("src/cli/main.ts")).toBe("src/cli/main.ts");
    expect(mapping.how("src/cli/main.ts")).toBe(FinalMapping.SAME_PATH);
  });

  it("why there is no pathspec: limited to final's files, git sees no rename at all", () => {
    expect(mappedWithPathspec).toEqual([]);
  });

  it("two deleted files of final with the same name → both deleted, even with a unique file of that name in R", () => {
    expect(mapping.targetOf("src/c/Twin.ts")).toBeNull();
    expect(mapping.how("src/c/Twin.ts")).toBe(FinalMapping.DELETED);
    expect(mapping.targetOf("src/d/Twin.ts")).toBeNull();
    expect(mapping.how("src/d/Twin.ts")).toBe(FinalMapping.DELETED);
  });
});
