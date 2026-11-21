import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { SessionRunner } from "../../../../scripts/baseline/SessionRunner.js";
import { TranscriptSession } from "../../../../scripts/baseline/TranscriptSession.js";
import { TempGitRepo } from "../support/TempGitRepo.js";
import { TranscriptLayout } from "./TranscriptLayout.js";

// The real `SessionRunner` (design §4.8, gap G38): it copies only the
// fixtures git tracks, with their working-tree content, then runs the real CLI
// with `dir` alone added. Each repository is a temporary one (design §9.1);
// `t/` plays the part of `doc/transcript/`.

const ONLY_DIR = ["--only", "@svgframe/plugin-command-dir"];
const BANNER = "svg-editor 0.1 — type 'help' for commands";
const TIMEOUT_MS = 30_000;

let repo: TempGitRepo | undefined;
let layout: TranscriptLayout | undefined;

afterEach(() => {
  repo?.dispose();
  layout?.remove();
  repo = undefined;
  layout = undefined;
});

/** A committed repository with session `s` (`dir`) and the fixtures `a.txt`, `sub/b.txt`; `.DS_Store` is ignored. */
function committedSession(): TempGitRepo {
  const created = new TempGitRepo("svg-session-runner-");
  created.write({
    ".gitignore": ".DS_Store\n",
    "t/s.txt": "dir\n",
    "t/fixtures/s/a.txt": "a committed\n",
    "t/fixtures/s/sub/b.txt": "b committed\n",
  });
  created.commit("session s");
  return created;
}

/** The only session under `transcriptDir`. */
function onlySession(transcriptDir: string): TranscriptSession {
  const sessions = TranscriptSession.discoverAll(transcriptDir);
  expect(sessions.map((session) => session.name)).toHaveLength(1);
  return sessions[0] as TranscriptSession;
}

describe("SessionRunner copies the fixtures git tracks (G38)", () => {
  it(
    "an ignored .DS_Store and an untracked file reach neither the directory nor dir's output; a tracked file in a subdirectory does",
    () => {
      repo = committedSession();
      repo.write({ "t/fixtures/s/.DS_Store": "finder\n", "t/fixtures/s/untracked.txt": "not added\n", "t/fixtures/s/sub/.DS_Store": "finder\n" });
      const outcome = new SessionRunner().run(onlySession(join(repo.root, "t")), ONLY_DIR);
      expect(outcome.exitCode).toBe(0);
      expect(outcome.stderr.toString("utf8")).toBe("");
      expect(outcome.sortedFileNames()).toEqual(["a.txt", "sub/b.txt"]);
      expect(outcome.stdout.toString("utf8")).toBe(`${BANNER}\n[DIR]  sub\n[FILE] a.txt\n`);
    },
    TIMEOUT_MS,
  );

  it(
    "a tracked fixture edited but not committed is copied with its working-tree content",
    () => {
      repo = committedSession();
      repo.write({ "t/fixtures/s/a.txt": "a edited\n" });
      const outcome = new SessionRunner().run(onlySession(join(repo.root, "t")), ONLY_DIR);
      expect(outcome.files.get("a.txt")?.toString("utf8")).toBe("a edited\n");
      expect(outcome.files.get("sub/b.txt")?.toString("utf8")).toBe("b committed\n");
    },
    TIMEOUT_MS,
  );

  it("a tracked fixture deleted from the working tree is an error naming the session and the path", () => {
    repo = committedSession();
    repo.remove("t/fixtures/s/sub/b.txt");
    const session = onlySession(join(repo.root, "t"));
    expect(() => new SessionRunner().run(session, ONLY_DIR)).toThrow(
      "cannot run session s: the fixture fixtures/s/sub/b.txt is tracked by git but missing from the working tree",
    );
  });

  it("a fixtures directory outside any git repository is an error naming the session", () => {
    layout = new TranscriptLayout();
    layout.session("s", "dir\n");
    layout.write("fixtures/s/a.txt", "a\n");
    const session = onlySession(layout.transcript);
    expect(() => new SessionRunner().run(session, ONLY_DIR)).toThrow(
      `cannot run session s: cannot list the fixtures git tracks in ${session.fixturesDir} (git ls-files -z -- . failed`,
    );
  });

  it(
    "a session without fixtures runs in an empty directory, as before",
    () => {
      layout = new TranscriptLayout();
      layout.session("s", "dir\n");
      const outcome = new SessionRunner().run(onlySession(layout.transcript), ONLY_DIR);
      expect(outcome.exitCode).toBe(0);
      expect(outcome.sortedFileNames()).toEqual([]);
      expect(outcome.stdout.toString("utf8")).toBe(`${BANNER}\n(empty directory)\n`);
    },
    TIMEOUT_MS,
  );
});
