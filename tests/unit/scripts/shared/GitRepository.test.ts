import { afterEach, describe, expect, it } from "vitest";
import { TempGitRepo } from "../support/TempGitRepo.js";

// `GitRepository` in a temporary repository (design §9.1). `nameStatus` feeds
// the plugin-diff check (design §1.5), which reads one path per line: a moved
// file must be one deletion and one addition, whatever `diff.renames` or git's
// default says, not a single `R100` line carrying two paths (S9 review).

let repo: TempGitRepo | undefined;

afterEach(() => {
  repo?.dispose();
  repo = undefined;
});

describe("GitRepository.nameStatus", () => {
  it("reports a file moved unchanged as a deletion and an addition (--no-renames), sorted by path", () => {
    repo = new TempGitRepo("svg-git-repository-");
    const content = Array.from({ length: 20 }, (_, i) => `export const line${i} = ${i};`).join("\n") + "\n";
    repo.write({ "a/Old.ts": content });
    const before = repo.commit("before");
    repo.remove("a/Old.ts");
    repo.write({ "b/New.ts": content });
    const after = repo.commit("after");
    expect(repo.repository().nameStatus(before, after)).toEqual(["D\ta/Old.ts", "A\tb/New.ts"]);
  });
});
