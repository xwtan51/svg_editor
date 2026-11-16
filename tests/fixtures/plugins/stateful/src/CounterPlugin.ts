import { CommandCategory } from "@svgframe/kernel";
import type { ArgList, Plugin, PluginContext, PluginOptions } from "@svgframe/kernel";
import { LineCommand } from "./LineCommand.js";

/** Loader fixture: per-instance state; `fixture-count` prints how often it has run in this editor. */
export default class CounterPlugin implements Plugin {
  private count = 0;

  constructor(_options: PluginOptions) {}

  activate(context: PluginContext): void {
    context.registerCommand({
      commandName: "fixture-count",
      usage: "fixture-count",
      summary: "loader fixture: counts its own runs",
      category: CommandCategory.DISPLAY,
      requiresDocument: false,
      parse: (args: ArgList) => {
        args.expectEnd();
        return new LineCommand(() => `count=${++this.count}`);
      },
    });
  }
}
