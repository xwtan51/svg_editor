import type { Plugin, PluginContext, PluginOptions } from "@svgframe/kernel";
import { DirCommandType } from "./DirCommandType.js";
import type { DirectoryLister } from "./DirectoryLister.js";
import { NodeDirectoryLister } from "./NodeDirectoryLister.js";
import { NodeWorkingDirectory } from "./NodeWorkingDirectory.js";
import type { WorkingDirectory } from "./WorkingDirectory.js";

/**
 * Registers the `dir` command (spec §2.2, design §8.2); it takes no options.
 * In the Adapter pattern it is the assembler: it builds the two Adapters and
 * plugs them into the command type. Both assemblies (way A and way B) run
 * `new DirPlugin(options)` through the same installer, so both call the same
 * command through the same directory access interface (spec §2.3).
 */
export default class DirPlugin implements Plugin {
  private readonly lister: DirectoryLister;
  private readonly workingDirectory: WorkingDirectory;

  constructor(_options: PluginOptions) {
    this.lister = new NodeDirectoryLister();
    this.workingDirectory = new NodeWorkingDirectory();
  }

  activate(context: PluginContext): void {
    context.registerCommand(new DirCommandType(this.lister, this.workingDirectory));
  }
}
