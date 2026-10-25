import type { Shape } from "../model/Shape.js";
import type { ShapeMemento } from "../model/ShapeMemento.js";
import type { SvgDocument } from "../model/SvgDocument.js";
import type { ArgList } from "./ArgList.js";
import { CommandResult } from "./CommandResult.js";
import { EditCommand } from "./EditCommand.js";

/**
 * `set <id> <attr> <value>` (§4.1 whitelist, E6–E9).
 *
 * The model validates a value only while assigning it, so `prepare` assigns it
 * as a trial, takes a snapshot of the result and puts the old state back from
 * a snapshot taken just before; a rejected value changes nothing (the model
 * guarantees that). `apply` then only restores the "after" snapshot and cannot
 * fail; undo restores the "before" snapshot.
 */
export class SetCommand extends EditCommand {
  static readonly commandName = "set";
  static readonly usage = "set <id> <attr> <value>";
  static readonly summary = "set fill, stroke, stroke-width, a geometry attribute or the text";

  static parse(args: ArgList): SetCommand {
    args.expectCount(3);
    const id = args.nextId();
    const attribute = args.nextRaw();
    const value = args.nextRaw();
    return new SetCommand(id, attribute, value);
  }

  private readonly id: string;
  private readonly attribute: string;
  private readonly value: string;

  private target!: Shape;
  private before!: ShapeMemento;
  private after!: ShapeMemento;
  /** The attribute is the element content (`text`), not an attribute entry. */
  private isContent!: boolean;

  constructor(id: string, attribute: string, value: string) {
    super();
    this.id = id;
    this.attribute = attribute;
    this.value = value;
  }

  undo(): CommandResult {
    this.target.restore(this.before);
    return CommandResult.of(this.echo());
  }

  /** Order: id, attribute name, value (R10); the last two are checked by the model. */
  protected prepare(document: SvgDocument): void {
    this.target = this.findShape(document, this.id);
    this.before = this.target.snapshot();
    this.target.setAttribute(this.attribute, this.value);
    this.after = this.target.snapshot();
    this.isContent = this.entryValue() === undefined;
    this.target.restore(this.before);
  }

  protected apply(): void {
    this.target.restore(this.after);
  }

  protected describe(): string {
    return this.echo();
  }

  /** `rect#r1 updated: x=10`, `text#t1 updated: text="…"`, `rect#r1 updated: fill unset` (E8). */
  private echo(): string {
    return `${this.target.label()} updated: ${this.currentValue()}`;
  }

  private currentValue(): string {
    if (this.isContent) {
      return `${this.attribute}="${this.target.textContent() ?? ""}"`;
    }
    const value = this.entryValue();
    return value === undefined ? `${this.attribute} unset` : `${this.attribute}=${value}`;
  }

  /** The displayed value among the geometry and style entries, or `undefined` when not set there. */
  private entryValue(): string | undefined {
    const entries = [...this.target.geometryEntries(), ...this.target.styleEntries()];
    return entries.find(([name]) => name === this.attribute)?.[1];
  }
}
