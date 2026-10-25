import type { ArgList } from "./ArgList.js";
import { ZOrderCommand } from "./ZOrderCommand.js";

/** `back <id>`: first among its siblings, i.e. drawn first and at the bottom (E27). */
export class BackCommand extends ZOrderCommand {
  static readonly commandName = "back";
  static readonly usage = "back <id>";
  static readonly summary = "send a shape to the back of its siblings";

  static parse(args: ArgList): BackCommand {
    args.expectCount(1);
    return new BackCommand(args.nextId());
  }

  constructor(id: string) {
    super(id);
  }

  protected targetIndex(_siblingCount: number): number {
    return 0;
  }

  protected movedText(): string {
    return "sent to back";
  }
}
