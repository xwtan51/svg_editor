import { CommandCategory } from "@svgframe/kernel";
import type { ArgList, Plugin, PluginContext, PluginOptions } from "@svgframe/kernel";
import { LineCommand } from "./LineCommand.js";

/**
 * Loader fixture: keeps the options it is constructed with; `fixture-options`
 * prints the `greeting` option, the `nested` option as JSON, and whether that
 * nested object is frozen.
 */
export default class OptionsPlugin implements Plugin {
  private readonly options: PluginOptions;

  constructor(options: PluginOptions) {
    this.options = options;
  }

  activate(context: PluginContext): void {
    context.registerCommand({
      commandName: "fixture-options",
      usage: "fixture-options",
      summary: "loader fixture: prints its options",
      category: CommandCategory.DISPLAY,
      requiresDocument: false,
      parse: (args: ArgList) => {
        args.expectEnd();
        return new LineCommand(() => this.describe());
      },
    });
  }

  private describe(): string {
    const nested = this.options.get("nested");
    const greeting = this.options.string("greeting", "(none)");
    return `greeting=${greeting} nested=${JSON.stringify(nested)} frozen=${Object.isFrozen(nested)}`;
  }
}
