import type { Plugin, PluginContext, PluginOptions } from "@svgframe/kernel";
import { StatsCommand } from "./StatsCommand.js";

/** Registers the `stats` command (spec §2.1, design §8.1); it takes no options. */
export default class StatsPlugin implements Plugin {
  constructor(_options: PluginOptions) {}

  activate(context: PluginContext): void {
    context.registerCommand(StatsCommand);
  }
}
