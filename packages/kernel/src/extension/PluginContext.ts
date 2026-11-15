import type { CommandType } from "../commands/CommandType.js";
import type { ShapeCatalog } from "../model/ShapeCatalog.js";
import type { ShapeProvider } from "../model/ShapeProvider.js";
import type { TreeDecorator } from "../view/TreeDecorator.js";
import type { DocumentListener } from "./DocumentListener.js";

/**
 * Everything a plugin can do while it is activated (design §3.2). Each
 * `register*` checks the shape of its argument when called (registration name
 * a non-empty string without white space, required methods are functions,
 * and so on) and throws `Error` on a breach, which fails the activation.
 */
export interface PluginContext {
  /** Registration name `provider.typeName`, category `shapes`. */
  registerShape(provider: ShapeProvider): void;

  /** Registration name `type.commandName`, category `commands`. */
  registerCommand(type: CommandType): void;

  /** Registration name `decorator.name`, category `decorators`; `tagFor` must be a function. */
  registerTreeDecorator(decorator: TreeDecorator): void;

  /**
   * Subscribes to document events (design §3.4). Not a `contributes`
   * category, so neither checked for duplicates nor against the manifest, but
   * staged like the registrations: the listener receives events only once the
   * installation is committed, and never if it fails.
   */
  subscribe(listener: DocumentListener): void;

  /**
   * The shape types committed so far (by plugins installed earlier), read-only;
   * for checking run-time dependencies (design §2.1.5). Does not include this
   * plugin's own staged registrations.
   */
  shapeTypes(): ShapeCatalog;
}
