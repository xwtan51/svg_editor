import { SvgImporter } from "../io/SvgImporter.js";
import type { ArgList } from "./ArgList.js";
import type { CommandContext } from "./CommandContext.js";
import { CommandResult } from "./CommandResult.js";
import { DocumentCommand } from "./DocumentCommand.js";

/**
 * `read <file.svg>`: the file becomes the current document and its path the
 * default `save` path. Allowed without a document (R11).
 *
 * The whole import (read, parse, build, assign ids) finishes before the
 * session is touched, so a failure leaves document, path and history as they
 * were and prints no warning (F20, README §2.1 point 5).
 */
export class ReadCommand extends DocumentCommand {
  static readonly commandName = "read";
  static readonly usage = "read <file.svg>";
  static readonly summary = "read an SVG file as the current document";
  static override readonly requiresDocument: boolean = false;

  static parse(args: ArgList): ReadCommand {
    args.expectCount(1);
    return new ReadCommand(args.nextRaw());
  }

  private readonly path: string;

  constructor(path: string) {
    super();
    this.path = path;
  }

  /** Warning lines first, then `read other.svg (7 elements)` (spec §6, F13, F17). */
  execute(context: CommandContext): CommandResult {
    const imported = new SvgImporter(context.shapeFactory()).read(context.fileSystem(), this.path);
    const document = imported.document();
    context.replaceDocument(document, this.path);
    // `ImportResult.warnings()` already carries the `warning: ` prefix.
    return CommandResult.of(...imported.warnings(), `read ${this.path} (${document.elementCount()} elements)`);
  }
}
