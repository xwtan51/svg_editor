import type { ArgList } from "./ArgList.js";
import type { Command } from "./Command.js";
import type { CommandType } from "./CommandType.js";

/**
 * A resolved command line: the command type found by name plus its arguments.
 * The Invoker checks `type().requiresDocument` before calling `parse` (R10).
 */
export class CommandLine {
  private readonly commandType: CommandType;
  private readonly argList: ArgList;

  constructor(type: CommandType, args: ArgList) {
    this.commandType = type;
    this.argList = args;
  }

  type(): CommandType {
    return this.commandType;
  }

  args(): ArgList {
    return this.argList;
  }

  /** `type().parse(args())`. */
  parse(): Command {
    return this.commandType.parse(this.argList);
  }
}
