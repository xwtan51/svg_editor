import { CommandCategory } from "@svgframe/kernel";
import type { Plugin, PluginContext } from "@svgframe/kernel";
import { LineCommand } from "./LineCommand.js";

/** Loader fixture: declares `fixture-declared` but registers `fixture-registered`. */
export default class MismatchPlugin implements Plugin {
  activate(context: PluginContext): void {
    context.registerCommand({
      commandName: "fixture-registered",
      usage: "fixture-registered",
      summary: "loader fixture: never committed",
      category: CommandCategory.DISPLAY,
      requiresDocument: false,
      parse: () => new LineCommand(() => "should not run"),
    });
  }
}
