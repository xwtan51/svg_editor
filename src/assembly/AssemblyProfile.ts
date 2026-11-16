import type { PluginLoader } from "../loader/PluginLoader.js";
import type { LoadedPlugin } from "../loader/LoadedPlugin.js";
import type { CompositionRoot } from "./CompositionRoot.js";

/**
 * Which optional plugins an assembly installs after the built-ins (design
 * §4.3). One subclass per profile, chosen by `CliArguments`:
 * `BareProfile` (`--bare`), `FullProfile` (no argument, way A),
 * `OnlyProfile` (`--only <package>…`, part of way A) and `ConfigProfile`
 * (`--config <file>`, way B: the built-ins plus the configuration — never the
 * composition root's optional plugins).
 */
export abstract class AssemblyProfile {
  /**
   * The optional plugins to install, in installation order, each loaded or
   * already failed. Throws `EditorError` when the profile cannot be assembled
   * at all (an `--only` name that is not in the code assembly); the assembler
   * turns that into a refused start.
   */
  abstract optionalPlugins(root: CompositionRoot, loader: PluginLoader): Promise<readonly LoadedPlugin[]>;
}
