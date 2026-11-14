import type { FileSystem } from "@svgframe/kernel";
import { Editor, EditorSession, ExtensionRegistry, PluginInstaller } from "@svgframe/kernel/host";
import type { PluginCandidate } from "@svgframe/kernel/host";
import { NodeFileSystem } from "../adapters/NodeFileSystem.js";
import { CompositionRoot } from "./CompositionRoot.js";

/**
 * Builds an `Editor` for an assembly profile (design §4.2, §4.3): installs the
 * built-in plugins, then the profile's optional ones, all through one
 * `PluginInstaller`, and wires the session to the file system. In S6 there
 * are two profiles: `bare` (built-ins only) and `full` (way A: built-ins plus
 * `CompositionRoot.optional()`); the command-line choice between them comes in S8.
 *
 * A built-in plugin that fails to install is a programming error and throws
 * `Error`. An optional plugin that fails becomes one `error: …` startup message
 * and the assembly goes on (design §4.5); this is the only place besides the
 * editor that adds the `error: ` prefix (P7).
 */
export class EditorAssembler {
  private static readonly ERROR_PREFIX = "error: ";

  private readonly files: FileSystem;
  private readonly root: CompositionRoot;
  private messages: readonly string[] = [];

  constructor(files: FileSystem = new NodeFileSystem(), root: CompositionRoot = new CompositionRoot()) {
    this.files = files;
    this.root = root;
  }

  /** Built-in shapes and commands only: the Phase 1 editor. */
  bare(): Editor {
    return this.assemble([]);
  }

  /** Way A: the built-ins and every optional plugin of the composition root. */
  full(): Editor {
    return this.assemble(this.root.optional());
  }

  /**
   * The `error: …` lines of the optional plugins that failed during the last
   * assembly, in installation order (design §4.5; printed after the banner from S8).
   */
  startupMessages(): readonly string[] {
    return this.messages;
  }

  private assemble(optional: readonly PluginCandidate[]): Editor {
    const registry = new ExtensionRegistry();
    const installer = new PluginInstaller(registry);
    for (const candidate of this.root.builtins()) {
      const outcome = installer.install(candidate);
      if (!outcome.succeeded()) {
        throw new Error(`built-in plugin ${candidate.label()} failed to install: ${outcome.message()}`);
      }
    }
    this.messages = optional
      .map((candidate) => installer.install(candidate))
      .filter((outcome) => !outcome.succeeded())
      .map((outcome) => `${EditorAssembler.ERROR_PREFIX}${outcome.message()}`);
    return new Editor(new EditorSession(this.files, registry));
  }
}
