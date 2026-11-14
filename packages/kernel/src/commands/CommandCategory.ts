/**
 * The four command groups of spec §3, in the order `help` lists them (V7).
 * A closed set of value objects, not a string tag, so that nothing has to
 * compare category names.
 */
export class CommandCategory {
  static readonly DOCUMENT = new CommandCategory("Document", 0);
  static readonly EDIT = new CommandCategory("Shape editing", 1);
  static readonly DISPLAY = new CommandCategory("Display", 2);
  static readonly HISTORY = new CommandCategory("Undo / redo", 3);

  /** The four categories in `help` order; a registered command must use one of them (design §3.2). */
  static all(): readonly CommandCategory[] {
    return [CommandCategory.DOCUMENT, CommandCategory.EDIT, CommandCategory.DISPLAY, CommandCategory.HISTORY];
  }

  private readonly heading: string;
  private readonly position: number;

  private constructor(title: string, order: number) {
    this.heading = title;
    this.position = order;
  }

  title(): string {
    return this.heading;
  }

  /** Sort key for `help`. */
  order(): number {
    return this.position;
  }
}
