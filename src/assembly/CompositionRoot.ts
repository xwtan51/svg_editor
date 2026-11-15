import BuiltinShapesPlugin from "@svgframe/plugin-builtin-shapes";
import builtinShapesManifest from "@svgframe/plugin-builtin-shapes/package.json" with { type: "json" };
import BuiltinCommandsPlugin from "@svgframe/plugin-builtin-commands";
import builtinCommandsManifest from "@svgframe/plugin-builtin-commands/package.json" with { type: "json" };
import { PluginCandidate } from "@svgframe/kernel/host";
import { PluginOptions } from "@svgframe/kernel";

/** Way A: the plugins to install, listed in code. Adding a plugin changes only this file (L4). */
export class CompositionRoot {
  /** The built-in plugins every assembly installs first; the order is fixed: shapes, then commands (design §3.5). */
  builtins(): PluginCandidate[] {
    return [
      new PluginCandidate("@svgframe/plugin-builtin-shapes", BuiltinShapesPlugin, builtinShapesManifest, PluginOptions.EMPTY),
      new PluginCandidate("@svgframe/plugin-builtin-commands", BuiltinCommandsPlugin, builtinCommandsManifest, PluginOptions.EMPTY),
    ];
  }

  /** The optional plugins of way A, in installation order. */
  optional(): PluginCandidate[] {
    return [];
  }
}
