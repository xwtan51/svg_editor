import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { CompositionRoot } from "../../src/assembly/CompositionRoot.js";
import { LoadedCandidate } from "../../src/loader/LoadedCandidate.js";
import { LoadFailure } from "../../src/loader/LoadFailure.js";
import { PluginConfig } from "../../src/loader/PluginConfig.js";
import { PluginLoader } from "../../src/loader/PluginLoader.js";

// The two full assemblies agree (design §4.9, gaps G42, G46): way A is
// `CompositionRoot.optional()`, way B is the repository's `plugins.config.json`.
// Both must install the same plugins, in the same order, with the same
// options, and way B's loader must arrive at the very same plugin classes and
// manifests. The order is checked as a sequence, not as a set: two tags of
// `modified-star` and box print in installation order, and nothing else in
// `npm test` or the baseline notices the configuration's order (S13 review).
//
// No plugin package is named here and no count is written down: adding a
// plugin to both the composition root and the configuration (S15 and later)
// leaves this file unchanged; adding it to only one of them makes it fail.

/** The repository's configuration file, found from this file rather than from the current directory. */
const CONFIG_FILE = fileURLToPath(new URL("../../plugins.config.json", import.meta.url));

/** The enabled entries of the configuration, in array order (`"enabled": false` entries are skipped, as the loader does). */
const enabledEntries = () => PluginConfig.read(CONFIG_FILE).entries().filter((entry) => entry.isEnabled());

describe("assembly consistency: CompositionRoot.optional() and plugins.config.json", () => {
  it("the enabled entries' module names are the optional candidates' labels, in the same order", () => {
    const labels = new CompositionRoot().optional().map((candidate) => candidate.label());
    expect(labels.length).toBeGreaterThan(0);
    expect(enabledEntries().map((entry) => entry.module())).toEqual(labels);
  });

  it("each enabled entry has the same options as the candidate at its position", () => {
    const optional = new CompositionRoot().optional();
    const entries = enabledEntries();
    expect(entries).toHaveLength(optional.length);
    entries.forEach((entry, index) => {
      expect(entry.options(), entry.module()).toEqual(optional[index]?.options());
    });
  });

  it("PluginLoader loads every enabled entry to the composition root's own class, manifest and options", async () => {
    const optional = new CompositionRoot().optional();
    const loaded = await new PluginLoader().load(CONFIG_FILE);
    const failures = loaded.filter((item): item is LoadFailure => item instanceof LoadFailure).map((failure) => failure.message());
    expect(failures).toEqual([]);
    expect(loaded).toHaveLength(optional.length);
    loaded.forEach((item, index) => {
      expect(item).toBeInstanceOf(LoadedCandidate);
      const fromConfig = (item as LoadedCandidate).candidate();
      const fromRoot = optional[index];
      expect(fromConfig.label()).toBe(fromRoot?.label());
      expect(fromConfig.pluginClass() === fromRoot?.pluginClass(), `${fromConfig.label()}: the same class object`).toBe(true);
      expect(fromConfig.manifestJson(), fromConfig.label()).toEqual(fromRoot?.manifestJson());
      expect(fromConfig.options(), fromConfig.label()).toEqual(fromRoot?.options());
    });
  });

  it("this file names none of the plugins it checks", () => {
    const source = readFileSync(fileURLToPath(import.meta.url), "utf8");
    for (const candidate of new CompositionRoot().optional()) {
      expect(source.includes(candidate.label()), candidate.label()).toBe(false);
    }
  });
});
