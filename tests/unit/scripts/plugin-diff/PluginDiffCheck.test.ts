import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { PluginDiffCheck } from "../../../../scripts/plugin-diff/PluginDiffCheck.js";
import { TextSink } from "../baseline/TranscriptLayout.js";
import { TempGitRepo } from "../support/TempGitRepo.js";

/** The paths design §1.5 requires, plus an existing plugin and a lock file. */
const BASE: Record<string, string> = {
  "packages/kernel/package.json": '{ "name": "@svgframe/kernel" }\n',
  "packages/kernel/src/a.ts": "export class A {}\n",
  "src/loader/PluginLoader.ts": 'import { A } from "@svgframe/kernel";\n/** Loads. */\nexport class PluginLoader {}\n',
  "src/assembly/CompositionRoot.ts": "export class CompositionRoot {}\n",
  "src/cli/main.ts": "// entry\n",
  "plugins/builtin/package.json": '{ "name": "@svgframe/plugin-builtin" }\n',
  "plugins/builtin/src/BuiltinPlugin.ts": "export default class BuiltinPlugin {}\n",
  "plugins/new-extra/src/Extra.ts": "export default class Extra {}\n",
  "plugins.config.json": '{ "plugins": [] }\n',
  "package-lock.json": "{}\n",
};

/** A new plugin package `plugins/new`. */
const NEW_PLUGIN: Record<string, string> = {
  "plugins/new/package.json": '{ "name": "@svgframe/plugin-new" }\n',
  "plugins/new/src/NewPlugin.ts": "export default class NewPlugin {}\n",
  "plugins/new/tests/NewPlugin.test.ts": "// test\n",
};
const ROOT_CHANGE = { "src/assembly/CompositionRoot.ts": 'import NewPlugin from "@svgframe/plugin-new";\nexport class CompositionRoot {}\n' };
const CONFIG_CHANGE = { "plugins.config.json": '{ "plugins": [{ "module": "@svgframe/plugin-new" }] }\n' };
const LOCK_CHANGE = { "package-lock.json": '{ "new": true }\n' };

let repo: TempGitRepo;
let base: string;
beforeEach(() => {
  repo = new TempGitRepo("svg-plugin-diff-");
  repo.write(BASE);
  base = repo.commit("base");
});
afterEach(() => repo.dispose());

function check(...args: string[]): { code: number; text: string; last: string } {
  const out = new TextSink();
  const code = new PluginDiffCheck(out, repo.repository()).main(args);
  return { code, text: out.contents(), last: out.lines().at(-1) ?? "" };
}

/** Commits `files` on top of `base` on a fresh branch; returns the commit id. */
function commitOnBase(branch: string, ...files: Record<string, string>[]): string {
  repo.branch(branch, base);
  repo.write(Object.assign({}, ...files));
  return repo.commit(branch);
}

describe("PluginDiffCheck: way A", () => {
  it("a new plugin plus the composition root (and a lock file) passes", () => {
    const c = commitOnBase("a-ok", NEW_PLUGIN, ROOT_CHANGE, LOCK_CHANGE);
    const result = check(c, "plugins/new", "--mode", "A");
    expect(result.last).toBe("plugin-diff: PASS");
    expect(result.code).toBe(0);
    expect(result.text).toContain("-- outside packages/, src/, plugins/ (allowed; explain each in the PR):\nM\tpackage-lock.json\n");
  });

  it("the new plugin's own files are excluded from the common criterion", () => {
    const c = commitOnBase("a-ok", NEW_PLUGIN, ROOT_CHANGE);
    const result = check(c, "plugins/new/", "--mode", "A");
    expect(result.text).toContain("A\tplugins/new/src/NewPlugin.ts\n");
    expect(result.text).toMatch(/== 2\. kernel, loader and existing plugins unchanged[^\n]*\n\(none\)\nok   empty\n/);
    expect(result.code).toBe(0);
  });

  it("the same commit also changing the kernel fails, naming the kernel file", () => {
    const c = commitOnBase("a-kernel", NEW_PLUGIN, ROOT_CHANGE, { "packages/kernel/src/a.ts": "export class A {} // touched\n" });
    const result = check(c, "plugins/new", "--mode", "A");
    expect(result.code).toBe(1);
    expect(result.last).toContain("changed: packages/kernel/src/a.ts");
    expect(result.last).toMatch(/^plugin-diff: FAIL \(/);
  });

  it("changing an existing plugin fails", () => {
    const c = commitOnBase("a-plugin", NEW_PLUGIN, ROOT_CHANGE, { "plugins/builtin/src/BuiltinPlugin.ts": "export default class BuiltinPlugin { x = 1; }\n" });
    const result = check(c, "plugins/new", "--mode", "A");
    expect(result.code).toBe(1);
    expect(result.last).toContain("changed: plugins/builtin/src/BuiltinPlugin.ts");
  });

  it("an existing plugin whose name starts with the new one's is not excluded", () => {
    const c = commitOnBase("a-prefix", NEW_PLUGIN, ROOT_CHANGE, { "plugins/new-extra/src/Extra.ts": "export default class Extra { y = 2; }\n" });
    const result = check(c, "plugins/new", "--mode", "A");
    expect(result.code).toBe(1);
    expect(result.last).toContain("changed: plugins/new-extra/src/Extra.ts");
  });

  it("changing the loader fails", () => {
    const c = commitOnBase("a-loader", NEW_PLUGIN, ROOT_CHANGE, { "src/loader/PluginLoader.ts": "export class PluginLoader { z = 3; }\n" });
    const result = check(c, "plugins/new", "--mode", "A");
    expect(result.code).toBe(1);
    expect(result.last).toContain("changed: src/loader/PluginLoader.ts");
  });

  it("changing a host file besides the composition root (src/cli) fails", () => {
    const c = commitOnBase("a-cli", NEW_PLUGIN, ROOT_CHANGE, { "src/cli/main.ts": "// entry, changed\n" });
    const result = check(c, "plugins/new", "--mode", "A");
    expect(result.code).toBe(1);
    expect(result.last).toBe("plugin-diff: FAIL (way A: changed besides the composition root: src/cli/main.ts)");
  });

  it("changing plugins.config.json fails (decision X24)", () => {
    const c = commitOnBase("a-config", NEW_PLUGIN, ROOT_CHANGE, CONFIG_CHANGE);
    const result = check(c, "plugins/new", "--mode", "A");
    expect(result.code).toBe(1);
    expect(result.last).toBe("plugin-diff: FAIL (way A: plugins.config.json changed)");
  });

  it("not changing the composition root fails", () => {
    const c = commitOnBase("a-no-root", NEW_PLUGIN);
    expect(check(c, "plugins/new", "--mode", "A").last).toBe("plugin-diff: FAIL (way A: src/assembly/CompositionRoot.ts not modified)");
  });
});

describe("PluginDiffCheck: way B", () => {
  it("a new plugin plus the configuration passes", () => {
    const c = commitOnBase("b-ok", NEW_PLUGIN, CONFIG_CHANGE, LOCK_CHANGE);
    const result = check(c, "plugins/new", "--mode", "B");
    expect(result.last).toBe("plugin-diff: PASS");
    expect(result.code).toBe(0);
  });

  it("changing the composition root fails", () => {
    const c = commitOnBase("b-root", NEW_PLUGIN, CONFIG_CHANGE, ROOT_CHANGE);
    const result = check(c, "plugins/new", "--mode", "B");
    expect(result.code).toBe(1);
    expect(result.last).toBe("plugin-diff: FAIL (way B: run code changed: src/assembly/CompositionRoot.ts)");
  });

  it("not changing the configuration fails", () => {
    const c = commitOnBase("b-no-config", NEW_PLUGIN);
    expect(check(c, "plugins/new", "--mode", "B").last).toBe("plugin-diff: FAIL (way B: plugins.config.json not changed)");
  });
});

describe("PluginDiffCheck: paths must exist (design §1.5)", () => {
  it("src/loader missing in C^ fails and names the path", () => {
    repo.remove("src/loader");
    const parent = repo.commit("no loader");
    repo.write({ ...NEW_PLUGIN, ...ROOT_CHANGE });
    const c = repo.commit("add plugin");
    expect(repo.git("rev-parse", `${c}^`).trim()).toBe(parent);
    const result = check(c, "plugins/new", "--mode", "A");
    expect(result.code).toBe(1);
    expect(result.text).toContain("FAIL src/loader: missing in C^ and C\n");
    expect(result.last).toBe("plugin-diff: FAIL (src/loader: missing in C^ and C)");
  });

  it("a path missing in C only is named too", () => {
    repo.branch("a-gone", base);
    repo.remove("plugins.config.json");
    repo.write({ ...NEW_PLUGIN, ...ROOT_CHANGE });
    const c = repo.commit("add a plugin, drop the configuration");
    const result = check(c, "plugins/new", "--mode", "A");
    expect(result.code).toBe(1);
    expect(result.text).toContain("FAIL plugins.config.json: missing in C\n");
    expect(result.last).toBe("plugin-diff: FAIL (plugins.config.json: missing in C; way A: plugins.config.json changed)");
  });

  it("a new plugin directory that already exists in C^ fails", () => {
    const c = commitOnBase("a-old", { "plugins/builtin/src/More.ts": "export class More {}\n" }, ROOT_CHANGE);
    const result = check(c, "plugins/builtin", "--mode", "A");
    expect(result.code).toBe(1);
    expect(result.last).toBe("plugin-diff: FAIL (plugins/builtin: already in C^ (not a new plugin))");
  });
});

describe("PluginDiffCheck: reads commits only", () => {
  it("section 3 is git grep on C, without the C: prefix", () => {
    const c = commitOnBase("a-ok", NEW_PLUGIN, ROOT_CHANGE);
    const result = check(c, "plugins/new", "--mode", "A");
    expect(result.text).toContain(
      '== 3. loader independence, for manual review only (git grep -n -E "import|require|switch" C -- src/loader)\nsrc/loader/PluginLoader.ts:1:import { A } from "@svgframe/kernel";\n\n',
    );
    expect(result.text).not.toContain(`${c}:src/loader`);
  });

  it("uncommitted changes in the working tree and the index do not change the result", () => {
    const c = commitOnBase("a-ok", NEW_PLUGIN, ROOT_CHANGE);
    const clean = check(c, "plugins/new", "--mode", "A");
    repo.write({
      "packages/kernel/src/a.ts": "export class A { dirty = true; }\n",
      "src/loader/PluginLoader.ts": 'import { B } from "@svgframe/plugin-builtin";\nswitch (1) {}\n',
      "plugins.config.json": "{}\n",
    });
    repo.git("add", "packages/kernel/src/a.ts");
    repo.remove("plugins/new/src/NewPlugin.ts");
    expect(check(c, "plugins/new", "--mode", "A")).toEqual(clean);
    expect(clean.code).toBe(0);
  });
});

describe("PluginDiffCheck: usage", () => {
  it("a merge commit is a usage error", () => {
    const left = commitOnBase("left", { "docs/a.md": "a\n" });
    repo.branch("right", base);
    repo.write({ "docs/b.md": "b\n" });
    repo.commit("right");
    repo.git("merge", "-q", "--no-ff", "-m", "merge", left);
    const result = check("HEAD", "plugins/new", "--mode", "A");
    expect(result.code).toBe(2);
    expect(result.text).toBe(`plugin-diff: HEAD must have exactly one parent (it has 2)\n${PluginDiffCheck.USAGE}`);
  });

  it("a root commit is a usage error", () => {
    const result = check(base, "plugins/new", "--mode", "A");
    expect(result.code).toBe(2);
    expect(result.text).toContain("must have exactly one parent (it has 0)");
  });

  it.each([
    [[]],
    [["HEAD"]],
    [["HEAD", "plugins/new"]],
    [["HEAD", "plugins/new", "--mode"]],
    [["HEAD", "plugins/new", "--mode", "C"]],
    [["HEAD", "plugins/new", "--mode", "A", "extra"]],
    [["HEAD", "plugins/a/b", "--mode", "A"]],
    [["HEAD", "src/new", "--mode", "A"]],
    [["HEAD", "plugins", "--mode", "A"]],
    [["HEAD", "plugins/..", "--mode", "A"]],
    [["HEAD", "--mode", "A", "plugins/new"]],
  ])("bad arguments %j: usage, exit 2", (args) => {
    const result = check(...args);
    expect(result.code).toBe(2);
    expect(result.text).toBe(PluginDiffCheck.USAGE);
  });

  it("a revision that is not a commit is a usage error", () => {
    const result = check("no-such-rev", "plugins/new", "--mode", "A");
    expect(result.code).toBe(2);
    expect(result.text).toBe(`plugin-diff: not a commit: no-such-rev\n${PluginDiffCheck.USAGE}`);
  });
});
