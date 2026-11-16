import type { InstallOutcome, PluginInstaller } from "@svgframe/kernel/host";

/**
 * One entry of an assembly's list of optional plugins, in installation order:
 * either a candidate ready for the installer (`LoadedCandidate`) or a failure
 * already known before installation (`LoadFailure`, e.g. `plugin not found`).
 *
 * Installing the list entry by entry gives the startup messages in the order
 * of the configuration, at most one per entry (design §4.5): a loading
 * failure and an installation failure of later entries interleave as written.
 */
export interface LoadedPlugin {
  /** Hands the candidate to `installer`, or reports the failure found while loading. */
  install(installer: PluginInstaller): InstallOutcome;
}
