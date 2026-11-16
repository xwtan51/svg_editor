import { CommandCategory } from "@svgframe/kernel";
import type { ArgList, Plugin, PluginContext, PluginOptions } from "@svgframe/kernel";
import { LineCommand } from "./LineCommand.js";

/** Loader fixture: a well-formed plugin with one command, `fixture-ok`, printing `fixture ok`. */
export default class OkPlugin implements Plugin {
  constructor(_options: PluginOptions) {}

  activate(context: PluginContext): void {
    context.registerCommand({
      commandName: "fixture-ok",
      usage: "fixture-ok",
      summary: "loader fixture: prints a fixed line",
      category: CommandCategory.DISPLAY,
      requiresDocument: false,
      parse: (args: ArgList) => {
        args.expectEnd();
        return new LineCommand(() => "fixture ok");
      },
    });
  }
}
