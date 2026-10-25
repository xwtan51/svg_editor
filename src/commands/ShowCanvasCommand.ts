import type { CommandContext } from "./CommandContext.js";
import { CommandResult } from "./CommandResult.js";
import { QueryCommand } from "./QueryCommand.js";

/**
 * `canvas` without arguments: shows the canvas size. A display command, so it
 * leaves the history and the io lock alone (U5). Built by `CanvasCommandParser`.
 */
export class ShowCanvasCommand extends QueryCommand {
  /** `canvas 800x600` (F3). */
  execute(context: CommandContext): CommandResult {
    return CommandResult.of(`canvas ${context.document().canvasSize().toString()}`);
  }
}
