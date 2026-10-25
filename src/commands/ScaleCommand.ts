import { EditorError } from "../model/EditorError.js";
import { NumberFormat } from "../model/NumberFormat.js";
import type { Shape } from "../model/Shape.js";
import type { ShapeMemento } from "../model/ShapeMemento.js";
import type { SvgDocument } from "../model/SvgDocument.js";
import type { ArgList } from "./ArgList.js";
import { CommandResult } from "./CommandResult.js";
import { EditCommand } from "./EditCommand.js";

/**
 * `scale <id> <factor>`: every geometry attribute times `factor`, about the
 * origin (E12). Undo restores a snapshot instead of dividing (README §2.1).
 */
export class ScaleCommand extends EditCommand {
  static readonly commandName = "scale";
  static readonly usage = "scale <id> <factor>";
  static readonly summary = "scale all geometry of a shape by factor";

  static parse(args: ArgList): ScaleCommand {
    args.expectCount(2);
    const id = args.nextId();
    const factor = args.nextNumber();
    return new ScaleCommand(id, factor);
  }

  private readonly id: string;
  private readonly factor: number;

  private target!: Shape;
  private memento!: ShapeMemento;

  constructor(id: string, factor: number) {
    super();
    this.id = id;
    this.factor = factor;
  }

  /** `rect#r1 scaled back by 0.5` (E14). */
  undo(): CommandResult {
    this.target.restore(this.memento);
    return CommandResult.of(`${this.target.label()} scaled back by ${NumberFormat.format(1 / this.factor)}`);
  }

  /** The id is checked before the factor (R10: arguments from left to right). */
  protected prepare(document: SvgDocument): void {
    this.target = this.findShape(document, this.id);
    if (!(this.factor > 0)) {
      throw new EditorError("scale factor must be positive");
    }
    this.memento = this.target.snapshot();
  }

  protected apply(): void {
    this.target.scaleBy(this.factor);
  }

  /** `rect#r1 scaled by 2` (E14). */
  protected describe(): string {
    return `${this.target.label()} scaled by ${NumberFormat.format(this.factor)}`;
  }
}
