import { EditorError } from "../model/EditorError.js";
import type { Shape } from "../model/Shape.js";
import type { ShapeContainer } from "../model/ShapeContainer.js";
import type { ShapeType } from "../model/ShapeType.js";
import type { SvgDocument } from "../model/SvgDocument.js";
import type { ArgList } from "./ArgList.js";
import type { CommandContext } from "./CommandContext.js";
import { CommandResult } from "./CommandResult.js";
import { EditCommand } from "./EditCommand.js";

/**
 * `create <type> <id> [params…] [in <containerId>]` (spec §3, §4.1).
 *
 * The number of parameters depends on the type, which is only known once the
 * `ShapeFactory` has been asked, so the per-type count is checked in `prepare`,
 * right after the type: type → count → id → container → values. The usage
 * error then shows the syntax of that type (R7).
 */
export class CreateCommand extends EditCommand {
  static readonly commandName = "create";
  static readonly usage = "create <type> <id> [params…] [in <containerId>]";
  static readonly summary = "create a shape, at the root or inside a container";

  private static readonly IN_CLAUSE = "[in <containerId>]";

  static parse(args: ArgList): CreateCommand {
    const containerId = args.takeInClause();
    args.expectAtLeast(2);
    const typeName = args.nextRaw();
    const id = args.nextId();
    return new CreateCommand(typeName, id, args.rest(), containerId);
  }

  private readonly typeName: string;
  private readonly id: string;
  private readonly params: readonly string[];
  private readonly containerId: string | null;

  private document!: SvgDocument;
  private container!: ShapeContainer;
  private shape!: Shape;
  private index!: number;

  constructor(typeName: string, id: string, params: readonly string[], containerId: string | null) {
    super();
    this.typeName = typeName;
    this.id = id;
    this.params = [...params];
    this.containerId = containerId;
  }

  undo(): CommandResult {
    this.container.remove(this.shape);
    return CommandResult.of(`${this.shape.label()} removed`);
  }

  protected prepare(document: SvgDocument, context: CommandContext): void {
    const type = context.shapeFactory().lookup(this.typeName);
    const values = this.matchParams(type);
    this.checkNewId(document, this.id);
    this.document = document;
    this.container = this.containerId === null ? document : this.findContainer(document, this.containerId);
    // Builds a detached shape: number format and value constraints, in parameter order.
    this.shape = type.create(this.id, values);
    this.index = this.container.childList().length;
  }

  protected apply(): void {
    this.container.insertAt(this.shape, this.index);
  }

  /** `rect#r1 created` or `rect#r1 created in g#node1` (E1). */
  protected describe(): string {
    const where = this.container === this.document ? "" : ` in ${this.container.containerLabel()}`;
    return `${this.shape.label()} created${where}`;
  }

  /** Pairs the parameter tokens with the type's `ParamSpec`s (keyed by attribute name). */
  private matchParams(type: ShapeType): Map<string, string> {
    const required = type.params.filter((spec) => !spec.isOptional()).length;
    if (this.params.length < required || this.params.length > type.params.length) {
      throw new EditorError(`usage: ${CreateCommand.usageOf(type)}`);
    }
    const values = new Map<string, string>();
    this.params.forEach((raw, i) => {
      const spec = type.params[i];
      if (spec !== undefined) {
        values.set(spec.attributeName(), raw);
      }
    });
    return values;
  }

  /** `create rect <id> <x> <y> <w> <h> [fill] [in <containerId>]` (R7). */
  private static usageOf(type: ShapeType): string {
    const params = type.params.map((spec) => ` ${spec.usageToken()}`).join("");
    return `${CreateCommand.commandName} ${type.typeName} <id>${params} ${CreateCommand.IN_CLAUSE}`;
  }
}
