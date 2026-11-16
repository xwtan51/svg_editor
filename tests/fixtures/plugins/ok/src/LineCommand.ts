import { CommandResult, QueryCommand } from "@svgframe/kernel";

/** Test fixture: a display command whose single output line is computed when it runs. */
export class LineCommand extends QueryCommand {
  private readonly produce: () => string;

  constructor(produce: () => string) {
    super();
    this.produce = produce;
  }

  execute(): CommandResult {
    return CommandResult.of(this.produce());
  }
}
