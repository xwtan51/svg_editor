import type { ArgList } from "./ArgList.js";
import { ZOrderCommand } from "./ZOrderCommand.js";

/** `front <id>`: last among its siblings, i.e. drawn last and on top (E27). */
export class FrontCommand extends ZOrderCommand {
  static readonly commandName = "front";
  static readonly usage = "front <id>";
  static readonly summary = "bring a shape to the front of its siblings";

  static parse(args: ArgList): FrontCommand {
    args.expectCount(1);
    return new FrontCommand(args.nextId());
  }

  constructor(id: string) {
    super(id);
  }

  protected targetIndex(siblingCount: number): number {
    return siblingCount - 1;
  }

  protected movedText(): string {
    return "brought to front";
  }
}
