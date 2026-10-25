import type { Shape } from "../model/Shape.js";
import type { SvgDocument } from "../model/SvgDocument.js";
import { TreePosition } from "../model/TreePosition.js";
import { CommandResult } from "./CommandResult.js";
import { EditCommand } from "./EditCommand.js";

/**
 * Template for `front` / `back` (README §2.6): record the index, move the
 * shape among its siblings, move it back on undo. Subclasses only give the
 * target index and the verb of the echo.
 */
export abstract class ZOrderCommand extends EditCommand {
  private readonly id: string;

  private target!: Shape;
  private position!: TreePosition;

  protected constructor(id: string) {
    super();
    this.id = id;
  }

  /** `rect#r1 z-order restored` (E28). */
  undo(): CommandResult {
    this.position.container().remove(this.target);
    this.position.reinsert(this.target);
    return CommandResult.of(`${this.target.label()} z-order restored`);
  }

  protected prepare(document: SvgDocument): void {
    this.target = this.findShape(document, this.id);
    this.position = TreePosition.of(this.target);
  }

  protected apply(): void {
    const container = this.position.container();
    const count = container.childList().length;
    container.remove(this.target);
    container.insertAt(this.target, this.targetIndex(count));
  }

  protected describe(): string {
    return `${this.target.label()} ${this.movedText()}`;
  }

  /** The new index among `siblingCount` children (the shape included), 0 = drawn first. */
  protected abstract targetIndex(siblingCount: number): number;

  /** `brought to front` / `sent to back` (E28). */
  protected abstract movedText(): string;
}
