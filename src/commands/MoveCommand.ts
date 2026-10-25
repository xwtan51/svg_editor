import type { Shape } from "../model/Shape.js";
import type { ShapeMemento } from "../model/ShapeMemento.js";
import type { SvgDocument } from "../model/SvgDocument.js";
import type { ArgList } from "./ArgList.js";
import { CommandResult } from "./CommandResult.js";
import { EditCommand } from "./EditCommand.js";

/** `move <id> <dx> <dy>`: translation; a container moves all its descendants. Undo restores a snapshot. */
export class MoveCommand extends EditCommand {
  static readonly commandName = "move";
  static readonly usage = "move <id> <dx> <dy>";
  static readonly summary = "translate a shape by (dx, dy)";

  static parse(args: ArgList): MoveCommand {
    args.expectCount(3);
    const id = args.nextId();
    const dx = args.nextNumber();
    const dy = args.nextNumber();
    return new MoveCommand(id, dx, dy);
  }

  private readonly id: string;
  private readonly dx: number;
  private readonly dy: number;

  private target!: Shape;
  private memento!: ShapeMemento;

  constructor(id: string, dx: number, dy: number) {
    super();
    this.id = id;
    this.dx = dx;
    this.dy = dy;
  }

  /** `circle#c1 moved back to (100,100)` / `g#node2 moved back by (0,-100)` (E11). */
  undo(): CommandResult {
    this.target.restore(this.memento);
    return CommandResult.of(`${this.target.label()} moved back ${this.target.moveDescription(-this.dx, -this.dy)}`);
  }

  protected prepare(document: SvgDocument): void {
    this.target = this.findShape(document, this.id);
    this.memento = this.target.snapshot();
  }

  protected apply(): void {
    this.target.moveBy(this.dx, this.dy);
  }

  /** `circle#c1 moved to (130,100)` / `g#node2 moved by (0,100)` (E10). */
  protected describe(): string {
    return `${this.target.label()} moved ${this.target.moveDescription(this.dx, this.dy)}`;
  }
}
