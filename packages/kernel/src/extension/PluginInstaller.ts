import { EditorError } from "../model/EditorError.js";
import { ContributionCategory } from "./ContributionCategory.js";
import type { ExtensionRegistry } from "./ExtensionRegistry.js";
import { InstallOutcome } from "./InstallOutcome.js";
import type { PluginCandidate } from "./PluginCandidate.js";
import { PluginManifest } from "./PluginManifest.js";
import { StagingContext } from "./StagingContext.js";

/**
 * Transactional registration (design §3.3.1): the one installation path for
 * built-in plugins, plugins listed in the composition root and (from S8)
 * plugins loaded from a configuration. Steps, stopping at the first failure:
 *
 * 0. parse the manifest → `invalid plugin manifest: <label> (<reason>)`;
 * 1. construct and activate the plugin against a fresh staging context, then
 *    seal it → `plugin failed to activate: <name> (<reason>)` (a thenable
 *    result counts as failure: `activate must be synchronous`);
 * 2. duplicates, by category (shapes → commands → decorators → attributes) and
 *    within a category in registration order, against the committed names and
 *    against earlier staged ones → `duplicate registration: <category>/<name>`;
 * 3. declared versus registered names, per category as sets →
 *    `plugin manifest mismatch: <name> (declared: …, registered: …)`;
 * 4. commit.
 *
 * On any failure the staging context is dropped (the rollback) and the
 * committed registrations are untouched; only the first breach is reported.
 */
export class PluginInstaller {
  private readonly registry: ExtensionRegistry;

  constructor(registry: ExtensionRegistry) {
    this.registry = registry;
  }

  install(candidate: PluginCandidate): InstallOutcome {
    let manifest: PluginManifest;
    try {
      manifest = PluginManifest.parse(candidate.manifestJson());
    } catch (error) {
      if (error instanceof EditorError) {
        return InstallOutcome.failed(`invalid plugin manifest: ${candidate.label()} (${error.message})`);
      }
      throw error;
    }
    const staging = new StagingContext(this.registry);
    const activation = this.activate(candidate, staging);
    if (activation !== null) {
      return InstallOutcome.failed(`plugin failed to activate: ${manifest.name()} (${activation})`);
    }
    const duplicate = this.firstDuplicate(staging);
    if (duplicate !== null) {
      return InstallOutcome.failed(`duplicate registration: ${duplicate}`);
    }
    if (!this.matches(manifest, staging)) {
      return InstallOutcome.failed(
        `plugin manifest mismatch: ${manifest.name()} (declared: ${this.list((c) => manifest.names(c))}, registered: ${this.list((c) => staging.names(c))})`,
      );
    }
    this.registry.commit(staging);
    return InstallOutcome.success();
  }

  /** Step 1: constructs and activates; the reason of a failure, or `null`. The context is sealed either way. */
  private activate(candidate: PluginCandidate, staging: StagingContext): string | null {
    try {
      const PluginType = candidate.pluginClass();
      const result: unknown = new PluginType(candidate.options()).activate(staging);
      if (PluginInstaller.isThenable(result)) {
        // Keep a rejection of the abandoned promise from surfacing as an unhandled rejection.
        result.then(undefined, () => undefined);
        return "activate must be synchronous";
      }
      return null;
    } catch (error) {
      return PluginInstaller.reason(error);
    } finally {
      staging.seal();
    }
  }

  /** Step 2: `<category>/<name>` of the first duplicate, or `null`. */
  private firstDuplicate(staging: StagingContext): string | null {
    for (const category of ContributionCategory.all()) {
      const seen: string[] = [];
      for (const name of staging.names(category)) {
        if (seen.includes(name) || this.registry.isRegistered(category, name)) {
          return category.qualify(name);
        }
        seen.push(name);
      }
    }
    return null;
  }

  /** Step 3: per category, the declared and the registered names are equal as sets (both are free of duplicates here). */
  private matches(manifest: PluginManifest, staging: StagingContext): boolean {
    return ContributionCategory.all().every((category) => {
      const declared = manifest.names(category);
      const registered = staging.names(category);
      return declared.length === registered.length && declared.every((name) => registered.includes(name));
    });
  }

  /** `shapes/box attributes/box-attributes`, categories in the fixed order; `(none)` when empty. */
  private list(namesOf: (category: ContributionCategory) => readonly string[]): string {
    const all = ContributionCategory.all().flatMap((category) => namesOf(category).map((name) => category.qualify(name)));
    return all.length === 0 ? "(none)" : all.join(" ");
  }

  private static isThenable(value: unknown): value is PromiseLike<unknown> {
    return (
      (typeof value === "object" || typeof value === "function") &&
      value !== null &&
      typeof (value as { then?: unknown }).then === "function"
    );
  }

  /** `<reason>`: the first line of an `Error`'s message, otherwise `String(value)`. */
  private static reason(error: unknown): string {
    const text = error instanceof Error ? error.message : String(error);
    return text.split(/\r?\n/, 1)[0] ?? "";
  }
}
