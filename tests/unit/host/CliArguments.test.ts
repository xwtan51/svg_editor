import { describe, expect, it } from "vitest";
import { PluginCandidate } from "../../../packages/kernel/src/extension/PluginCandidate.js";
import type { Plugin } from "../../../packages/kernel/src/extension/Plugin.js";
import type { PluginContext } from "../../../packages/kernel/src/extension/PluginContext.js";
import { PluginOptions } from "../../../packages/kernel/src/extension/PluginOptions.js";
import { BareProfile } from "../../../src/assembly/BareProfile.js";
import { CompositionRoot } from "../../../src/assembly/CompositionRoot.js";
import { ConfigProfile } from "../../../src/assembly/ConfigProfile.js";
import { FullProfile } from "../../../src/assembly/FullProfile.js";
import { OnlyProfile } from "../../../src/assembly/OnlyProfile.js";
import { StartupRefusal } from "../../../src/assembly/StartupRefusal.js";
import { CliArguments } from "../../../src/cli/CliArguments.js";
import type { LoadedCandidate } from "../../../src/loader/LoadedCandidate.js";
import type { LoadedPlugin } from "../../../src/loader/LoadedPlugin.js";
import { PluginLoader } from "../../../src/loader/PluginLoader.js";

/** The command line (design §4.3): four profiles, mutually exclusive options, usage errors. */
const USAGE = "usage: svg-editor [--bare | --only <plugin>… | --config <file>]";

class Nothing implements Plugin {
  activate(_context: PluginContext): void {}
}

/** A composition root with three optional plugins, to see what an `--only` profile picks. */
class ThreeOptional extends CompositionRoot {
  override optional(): PluginCandidate[] {
    return ["@x/a", "@x/b", "@x/c"].map((name) => new PluginCandidate(name, Nothing, { name }, PluginOptions.EMPTY));
  }
}

/** A loader that only records which configuration it was asked for. */
class RecordingLoader extends PluginLoader {
  readonly asked: string[] = [];

  override async load(configFile: string): Promise<LoadedPlugin[]> {
    this.asked.push(configFile);
    return [];
  }
}

const labels = (loaded: readonly LoadedPlugin[]) => loaded.map((item) => (item as LoadedCandidate).candidate().label());

describe("CliArguments", () => {
  it("no argument: full", () => {
    expect(CliArguments.parse([])).toBeInstanceOf(FullProfile);
  });

  it("--bare: bare", () => {
    expect(CliArguments.parse(["--bare"])).toBeInstanceOf(BareProfile);
  });

  it("--only <package>: only, with that package", async () => {
    const profile = CliArguments.parse(["--only", "@x/b"]);
    expect(profile).toBeInstanceOf(OnlyProfile);
    expect(labels(await profile.optionalPlugins(new ThreeOptional(), new RecordingLoader()))).toEqual(["@x/b"]);
  });

  it("--only can be repeated", async () => {
    const profile = CliArguments.parse(["--only", "@x/c", "--only", "@x/a"]);
    expect(labels(await profile.optionalPlugins(new ThreeOptional(), new RecordingLoader()))).toEqual(["@x/a", "@x/c"]);
  });

  it("--config <file>: config, with the path exactly as given", async () => {
    const profile = CliArguments.parse(["--config", "conf/plugins.json"]);
    expect(profile).toBeInstanceOf(ConfigProfile);
    const loader = new RecordingLoader();
    expect(await profile.optionalPlugins(new ThreeOptional(), loader)).toEqual([]);
    expect(loader.asked).toEqual(["conf/plugins.json"]);
  });

  it("a value may start with a single dash", () => {
    expect(CliArguments.parse(["--config", "-odd.json"])).toBeInstanceOf(ConfigProfile);
    expect(CliArguments.parse(["--only", "-x"])).toBeInstanceOf(OnlyProfile);
  });

  it.each([
    ["--bare with --config", ["--bare", "--config", "c.json"]],
    ["--only with --bare", ["--only", "@x/a", "--bare"]],
    ["--config with --only", ["--config", "c.json", "--only", "@x/a"]],
    ["all three", ["--bare", "--only", "@x/a", "--config", "c.json"]],
    ["--bare twice", ["--bare", "--bare"]],
    ["--config twice", ["--config", "a.json", "--config", "b.json"]],
    ["an unknown option", ["--nope"]],
    ["a positional argument", ["plugins.config.json"]],
    ["a single-dash option", ["-b"]],
    ["upper case", ["--BARE"]],
    ["the = form", ["--config=c.json"]],
    ["a lone --", ["--"]],
    ["an unknown argument after a valid one", ["--bare", "extra"]],
    ["--config without a value", ["--config"]],
    ["--only without a value", ["--only"]],
    ["--config followed by an option", ["--config", "--bare"]],
    ["--only followed by an option", ["--only", "--config", "c.json"]],
    ["--config with an empty value", ["--config", ""]],
    ["--only with an empty value", ["--only", ""]],
  ])("usage error: %s", (_case, argv) => {
    expect(() => CliArguments.parse(argv)).toThrow(new StartupRefusal(USAGE));
  });

  it("the usage error is a StartupRefusal carrying exactly the usage line", () => {
    try {
      CliArguments.parse(["--what"]);
      expect.unreachable();
    } catch (error) {
      expect(error).toBeInstanceOf(StartupRefusal);
      expect((error as Error).message).toBe(USAGE);
    }
    expect(CliArguments.USAGE).toBe(USAGE);
  });
});
