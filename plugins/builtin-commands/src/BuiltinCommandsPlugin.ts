import type { Plugin, PluginContext, PluginOptions } from "@svgframe/kernel";
import { AddToCommand } from "./AddToCommand.js";
import { BackCommand } from "./BackCommand.js";
import { CanvasCommandParser } from "./CanvasCommandParser.js";
import { CreateCommand } from "./CreateCommand.js";
import { DeleteCommand } from "./DeleteCommand.js";
import { FrontCommand } from "./FrontCommand.js";
import { GroupCommand } from "./GroupCommand.js";
import { HelpCommand } from "./HelpCommand.js";
import { InitCommand } from "./InitCommand.js";
import { MoveCommand } from "./MoveCommand.js";
import { ReadCommand } from "./ReadCommand.js";
import { RedoCommand } from "./RedoCommand.js";
import { SaveCommand } from "./SaveCommand.js";
import { ScaleCommand } from "./ScaleCommand.js";
import { SetCommand } from "./SetCommand.js";
import { ShowCommand } from "./ShowCommand.js";
import { TreeCommand } from "./TreeCommand.js";
import { UndoCommand } from "./UndoCommand.js";
import { UngroupCommand } from "./UngroupCommand.js";

/**
 * The 19 commands of Phase 1 as a plugin (design §3.3.3). Registration order
 * is that of the former `CommandRegistry` constructor: it is the order within
 * each `help` group, so it must not change. `canvas` is registered as
 * `CanvasCommandParser`, which builds a display or a document command.
 *
 * `group` builds its container through the shape catalog, so activation fails
 * unless the `g` shape type is already committed (the built-in shapes plugin
 * is always installed first).
 */
export default class BuiltinCommandsPlugin implements Plugin {
  constructor(_options: PluginOptions) {}

  activate(context: PluginContext): void {
    if (!context.shapeTypes().has(GroupCommand.CONTAINER_TYPE)) {
      throw new Error(`requires shape type: ${GroupCommand.CONTAINER_TYPE}`);
    }
    for (const type of [
      CreateCommand,
      DeleteCommand,
      MoveCommand,
      ScaleCommand,
      SetCommand,
      GroupCommand,
      UngroupCommand,
      AddToCommand,
      FrontCommand,
      BackCommand,
      TreeCommand,
      ShowCommand,
      HelpCommand,
      InitCommand,
      ReadCommand,
      SaveCommand,
      CanvasCommandParser,
      UndoCommand,
      RedoCommand,
    ]) {
      context.registerCommand(type);
    }
  }
}
