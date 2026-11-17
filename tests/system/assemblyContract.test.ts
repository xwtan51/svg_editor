import { describe, expect, it } from "vitest";
import { CommandCategory } from "../../packages/kernel/src/commands/CommandCategory.js";
import { CommandResult } from "../../packages/kernel/src/commands/CommandResult.js";
import type { CommandType } from "../../packages/kernel/src/commands/CommandType.js";
import { QueryCommand } from "../../packages/kernel/src/commands/QueryCommand.js";
import { PluginCandidate } from "../../packages/kernel/src/extension/PluginCandidate.js";
import { BareProfile } from "../../src/assembly/BareProfile.js";
import { CompositionRoot } from "../../src/assembly/CompositionRoot.js";
import { EditorAssembler } from "../../src/assembly/EditorAssembler.js";
import { OnlyProfile } from "../../src/assembly/OnlyProfile.js";
import { BuiltinExtensions } from "../support/BuiltinExtensions.js";
import { MemoryFileSystem } from "../unit/io/MemoryFileSystem.js";

// The generic assembly contract (design §9.2, S9): for every optional plugin of
// the composition root, each command its manifest declares under
// `contributes.commands` is unknown in the bare editor and listed by `help`
// when only that plugin is added (`--only <package>`). No plugin is named here:
// S10, S11 … add plugins to `CompositionRoot.optional()` and this test covers
// them without being changed.

/** The command names a candidate's manifest declares (`contributes.commands`, none when absent). */
function declaredCommands(candidate: PluginCandidate): string[] {
  const manifest = candidate.manifestJson() as { contributes?: { commands?: unknown } } | null;
  const commands = manifest?.contributes?.commands;
  return Array.isArray(commands) ? commands.filter((name): name is string => typeof name === "string") : [];
}

/** The contract for one optional candidate of `root`; both groups below use it. */
async function checkContract(root: CompositionRoot, candidate: PluginCandidate): Promise<void> {
  const names = declaredCommands(candidate);
  const bare = (await new EditorAssembler(new MemoryFileSystem(), root).assemble(new BareProfile())).editor();
  for (const name of names) {
    expect(bare.executeLine(name), `bare: ${name}`).toEqual([`error: unknown command: ${name}`]);
  }
  const only = await new EditorAssembler(new MemoryFileSystem(), root).assemble(new OnlyProfile([candidate.label()]));
  expect(only.startupMessages(), `--only ${candidate.label()}`).toEqual([]);
  const help = only.editor().executeLine("help");
  for (const name of names) {
    expect(
      help.some((line) => line === `  ${name}` || line.startsWith(`  ${name} `)),
      `--only ${candidate.label()}: help lists ${name}`,
    ).toBe(true);
  }
}

describe("assembly contract: the real composition root", () => {
  const optional = new CompositionRoot().optional();

  it("optional() is an array of plugin candidates (empty until S10 adds the first optional plugin)", () => {
    expect(Array.isArray(optional)).toBe(true);
    for (const candidate of optional) {
      expect(candidate).toBeInstanceOf(PluginCandidate);
    }
  });

  it.each(optional.map((candidate) => [candidate.label(), candidate] as const))(
    "%s: its commands are unknown in the bare editor and listed by help with --only",
    async (_label, candidate) => {
      await checkContract(new CompositionRoot(), candidate);
    },
  );
});

/** A display command printing `<name> ran`. */
class NamedCommand extends QueryCommand {
  private readonly name: string;

  constructor(name: string) {
    super();
    this.name = name;
  }

  execute(): CommandResult {
    return CommandResult.of(`${this.name} ran`);
  }
}

const commandType = (name: string): CommandType => ({
  commandName: name,
  usage: name,
  summary: "test command",
  category: CommandCategory.DISPLAY,
  requiresDocument: false,
  parse: () => new NamedCommand(name),
});

/** A composition root whose lists are replaced (as in tests/unit/host/EditorAssembler.test.ts). */
class FixedRoot extends CompositionRoot {
  private readonly builtinList: PluginCandidate[];
  private readonly optionalList: PluginCandidate[];

  constructor(builtins: PluginCandidate[], optional: PluginCandidate[]) {
    super();
    this.builtinList = builtins;
    this.optionalList = optional;
  }

  override builtins(): PluginCandidate[] {
    return this.builtinList;
  }

  override optional(): PluginCandidate[] {
    return this.optionalList;
  }
}

describe("assembly contract: a stand-in composition root proves the checks bite", () => {
  const fake = () => BuiltinExtensions.commandsPlugin("@test/contract", commandType("contract-a"), commandType("contract-b"));
  const other = () => BuiltinExtensions.commandsPlugin("@test/other", commandType("other-c"));

  it("an optional plugin with two commands satisfies the contract", async () => {
    const candidate = fake();
    expect(declaredCommands(candidate)).toEqual(["contract-a", "contract-b"]);
    await checkContract(new FixedRoot(new CompositionRoot().builtins(), [other(), candidate]), candidate);
  });

  it("a command that the bare editor already knows breaks the contract", async () => {
    const candidate = fake();
    const leaky = new FixedRoot([...new CompositionRoot().builtins(), fake()], [candidate]);
    await expect(checkContract(leaky, candidate)).rejects.toThrow("bare: contract-a");
  });

  it("a plugin that does not register a command its manifest declares breaks the contract (it fails to install)", async () => {
    const declaresMore = new PluginCandidate(
      "@test/contract",
      fake().pluginClass(),
      { name: "@test/contract", contributes: { commands: ["contract-a", "contract-b", "contract-z"] } },
      fake().options(),
    );
    await expect(checkContract(new FixedRoot(new CompositionRoot().builtins(), [declaresMore]), declaresMore)).rejects.toThrow("--only @test/contract");
  });
});
