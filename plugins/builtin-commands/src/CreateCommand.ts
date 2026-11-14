import { CommandResult, EditCommand, EditorError, IdSyntax } from "@svgframe/kernel";
import type { ArgList, CommandContext, Shape, ShapeContainer, ShapeProvider, SvgDocument } from "@svgframe/kernel";

/**
 * `create <type> <id> [params…] [in <containerId>]` (spec §3, §4.1).
 *
 * The number of parameters depends on the type, which is only known once the
 * shape catalog has been asked, so the per-type count is checked in `prepare`,
 * right after the type: type → count → id → container → values. The usage
 * error then shows the syntax of that type (R7).
 *
 * The shape comes from its `ShapeProvider` (design §2.1.6): every id the new
 * subtree will occupy (`claimedIds`) is checked at once before anything is
 * built, so a failure leaves no container and no part behind. A provider that
 * breaks its contract (a non-`EditorError`, a wrong id set, an attached
 * result) is reported as `shape provider failed: <type> (<reason>)`; nothing
 * has been changed at that point.
 */
export class CreateCommand extends EditCommand {
  static readonly commandName = "create";
  static readonly usage = "create <type> <id> [params…] [in <containerId>]";
  static readonly summary = "create a shape, at the root or inside a container";

  private static readonly IN_CLAUSE = "[in <containerId>]";
  private static readonly ONE_LINE = /^[^\r\n]*$/;

  static parse(args: ArgList): CreateCommand {
    const danglingIn = args.endsWithInKeyword();
    const containerId = args.takeInClause();
    args.expectAtLeast(2);
    const typeName = args.nextRaw();
    const id = args.nextId();
    return new CreateCommand(typeName, id, args.rest(), containerId, danglingIn);
  }

  private readonly typeName: string;
  private readonly id: string;
  private readonly params: readonly string[];
  private readonly containerId: string | null;
  /** The line ended with an unquoted `in` but no container id; reported once the type is known. */
  private readonly danglingIn: boolean;

  private document!: SvgDocument;
  private container!: ShapeContainer;
  private shape!: Shape;
  private detail!: string;
  private index!: number;

  constructor(
    typeName: string,
    id: string,
    params: readonly string[],
    containerId: string | null,
    danglingIn: boolean = false,
  ) {
    super();
    this.typeName = typeName;
    this.id = id;
    this.params = [...params];
    this.containerId = containerId;
    this.danglingIn = danglingIn;
  }

  undo(): CommandResult {
    this.container.remove(this.shape);
    return CommandResult.of(`${this.shape.label()} removed`);
  }

  protected prepare(document: SvgDocument, context: CommandContext): void {
    const provider = context.shapes().lookup(this.typeName);
    const values = this.matchParams(provider);
    // `claimedIds` may assume a valid id; `invalid id` still comes before `id already exists` (R10).
    IdSyntax.validate(this.id);
    const claimed = this.claimedIds(provider);
    for (const id of claimed) {
      this.checkNewId(document, id);
    }
    this.document = document;
    this.container = this.containerId === null ? document : this.findContainer(document, this.containerId);
    // Builds a detached subtree: number format and value constraints, in parameter order.
    this.shape = this.guarded(provider, () => provider.create(this.id, values, context.shapes()));
    this.checkCreated(provider, this.shape, claimed);
    this.detail = this.guarded(provider, () => provider.creationDetail(this.shape));
    if (typeof this.detail !== "string" || !CreateCommand.ONE_LINE.test(this.detail)) {
      throw this.breach(provider, "creationDetail must return a single line");
    }
    this.index = this.container.childList().length;
  }

  protected apply(): void {
    this.container.insertAt(this.shape, this.index);
  }

  /** `rect#r1 created` or `rect#r1 created in g#node1` (E1); a composite type adds its detail after `created`. */
  protected describe(): string {
    const where = this.container === this.document ? "" : ` in ${this.container.containerLabel()}`;
    return `${this.shape.label()} created${this.detail}${where}`;
  }

  /** The provider's claimed ids: non-empty, distinct, starting with the typed id (design §2.1.2). */
  private claimedIds(provider: ShapeProvider): readonly string[] {
    const ids: unknown = this.guarded(provider, () => provider.claimedIds(this.id));
    const valid =
      Array.isArray(ids) &&
      ids[0] === this.id &&
      ids.every((id) => typeof id === "string") &&
      new Set(ids).size === ids.length;
    if (!valid) {
      throw this.breach(provider, `claimedIds(${this.id}) must list distinct ids starting with ${this.id}`);
    }
    return ids as readonly string[];
  }

  /** The created subtree is detached and holds exactly the claimed ids. */
  private checkCreated(provider: ShapeProvider, shape: Shape, claimed: readonly string[]): void {
    if (shape === null || typeof shape !== "object" || typeof shape.getId !== "function") {
      throw this.breach(provider, "create must return a shape");
    }
    if (shape.parentContainer() !== null) {
      throw this.breach(provider, "create returned an attached shape");
    }
    const created = CreateCommand.subtreeIds(shape);
    const same = created.length === claimed.length && created.every((id) => claimed.includes(id));
    if (!same) {
      throw this.breach(provider, `created ids ${created.join(", ")} differ from claimed ids ${claimed.join(", ")}`);
    }
  }

  /** Runs a provider method; its `EditorError` passes through, anything else is a contract breach. */
  private guarded<T>(provider: ShapeProvider, call: () => T): T {
    try {
      return call();
    } catch (error) {
      if (error instanceof EditorError) {
        throw error;
      }
      const text = error instanceof Error ? error.message : String(error);
      throw this.breach(provider, text.split(/\r?\n/, 1)[0] ?? "");
    }
  }

  private breach(provider: ShapeProvider, reason: string): EditorError {
    return new EditorError(`shape provider failed: ${provider.typeName} (${reason})`);
  }

  /**
   * Pairs the parameter tokens with the type's `ParamSpec`s (keyed by attribute
   * name). A trailing unquoted `in` without a container id is the type's usage
   * error, like a wrong count, even where it would fit as an optional value.
   */
  private matchParams(provider: ShapeProvider): Map<string, string> {
    const required = provider.params.filter((spec) => !spec.isOptional()).length;
    if (this.danglingIn || this.params.length < required || this.params.length > provider.params.length) {
      throw new EditorError(`usage: ${CreateCommand.usageOf(provider)}`);
    }
    const values = new Map<string, string>();
    this.params.forEach((raw, i) => {
      const spec = provider.params[i];
      if (spec !== undefined) {
        values.set(spec.attributeName(), raw);
      }
    });
    return values;
  }

  /** `create rect <id> <x> <y> <w> <h> [fill] [in <containerId>]` (R7). */
  private static usageOf(provider: ShapeProvider): string {
    const params = provider.params.map((spec) => ` ${spec.usageToken()}`).join("");
    return `${CreateCommand.commandName} ${provider.typeName} <id>${params} ${CreateCommand.IN_CLAUSE}`;
  }

  /** Every id in the subtree, in document order. */
  private static subtreeIds(shape: Shape): string[] {
    return [shape.getId(), ...(shape.asContainer()?.childList() ?? []).flatMap((child) => CreateCommand.subtreeIds(child))];
  }
}
