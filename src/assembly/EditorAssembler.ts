import { EditorError } from "@svgframe/kernel";
import type { FileSystem } from "@svgframe/kernel";
import { Editor, EditorSession, ExtensionRegistry, PluginInstaller } from "@svgframe/kernel/host";
import { NodeFileSystem } from "../adapters/NodeFileSystem.js";
import type { LoadedPlugin } from "../loader/LoadedPlugin.js";
import { PluginLoader } from "../loader/PluginLoader.js";
import type { AssemblyProfile } from "./AssemblyProfile.js";
import { AssemblyResult } from "./AssemblyResult.js";
import { CompositionRoot } from "./CompositionRoot.js";
import { StartupRefusal } from "./StartupRefusal.js";

/**
 * Builds an `Editor` for an assembly profile (design §4.1–§4.3): installs the
 * built-in plugins, then the profile's optional plugins (way A from the
 * composition root, way B through the loader), all through one
 * `PluginInstaller`, and wires the session to the file system.
 *
 * Asynchronous because way B imports modules; only startup is asynchronous,
 * the editor's commands stay synchronous (decision X19).
 *
 * - A built-in plugin that fails to install is a programming error: `Error`.
 * - A profile that cannot be assembled (an unknown `--only` name) refuses the
 *   start: `StartupRefusal` with an `error: …` line for stderr.
 * - An optional plugin that fails becomes one `error: …` startup message, in
 *   installation order, and the assembly goes on (design §4.5). The optional
 *   plugins are installed entry by entry, so loading and installation failures
 *   keep the configuration's order.
 *
 * This is the only place besides the editor that adds the `error: ` prefix (P7).
 */
export class EditorAssembler {
  private static readonly ERROR_PREFIX = "error: ";

  private readonly files: FileSystem;
  private readonly root: CompositionRoot;
  private readonly loader: PluginLoader;

  constructor(files: FileSystem = new NodeFileSystem(), root: CompositionRoot = new CompositionRoot(), loader: PluginLoader = new PluginLoader()) {
    this.files = files;
    this.root = root;
    this.loader = loader;
  }

  async assemble(profile: AssemblyProfile): Promise<AssemblyResult> {
    const registry = new ExtensionRegistry();
    const installer = new PluginInstaller(registry);
    for (const candidate of this.root.builtins()) {
      const outcome = installer.install(candidate);
      if (!outcome.succeeded()) {
        throw new Error(`built-in plugin ${candidate.label()} failed to install: ${outcome.message()}`);
      }
    }
    const messages = (await this.optionalPlugins(profile))
      .map((plugin) => plugin.install(installer))
      .filter((outcome) => !outcome.succeeded())
      .map((outcome) => `${EditorAssembler.ERROR_PREFIX}${outcome.message()}`);
    return new AssemblyResult(new Editor(new EditorSession(this.files, registry)), messages);
  }

  private async optionalPlugins(profile: AssemblyProfile): Promise<readonly LoadedPlugin[]> {
    try {
      return await profile.optionalPlugins(this.root, this.loader);
    } catch (error) {
      if (error instanceof EditorError) {
        throw new StartupRefusal(`${EditorAssembler.ERROR_PREFIX}${error.message}`);
      }
      throw error;
    }
  }
}
