import { CommandCategory } from "@svgframe/kernel";
import type { Plugin, PluginContext } from "@svgframe/kernel";
import { LineCommand } from "./LineCommand.js";

/** Loader fixture: registers (and declares) a command named like a built-in one, `tree`. */
export default class DuplicatePlugin implements Plugin {
  activate(context: PluginContext): void {
    context.registerCommand({
      commandName: "tree",
      usage: "tree",
      summary: "loader fixture: clashes with the built-in tree",
      category: CommandCategory.DISPLAY,
      requiresDocument: false,
      parse: () => new LineCommand(() => "should not run"),
    });
  }
}
