import { CanvasSize } from "../model/CanvasSize.js";
import type { CommandContext } from "./CommandContext.js";
import { CommandResult } from "./CommandResult.js";
import { DocumentCommand } from "./DocumentCommand.js";

/**
 * `canvas <w> <h>`: changes the canvas size of the current document. A
 * document command, so it is a history barrier (spec §4.3, U2). Built by
 * `CanvasCommandParser`, which is the registered static side of `canvas`.
 */
export class ResizeCanvasCommand extends DocumentCommand {
  private readonly width: number;
  private readonly height: number;

  constructor(width: number, height: number) {
    super();
    this.width = width;
    this.height = height;
  }

  /** `canvas resized to 1024x768` (F3); `canvas size must be positive` (F2) before any change. */
  execute(context: CommandContext): CommandResult {
    const size = new CanvasSize(this.width, this.height);
    context.document().resize(size);
    return CommandResult.of(`canvas resized to ${size.toString()}`);
  }
}
