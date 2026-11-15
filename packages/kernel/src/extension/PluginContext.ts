import type { CommandType } from "../commands/CommandType.js";
import type { ShapeCatalog } from "../model/ShapeCatalog.js";
import type { ShapeProvider } from "../model/ShapeProvider.js";

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

  /**
   * The shape types committed so far (by plugins installed earlier), read-only;
   * for checking run-time dependencies (design §2.1.5). Does not include this
   * plugin's own staged registrations.
   */
  shapeTypes(): ShapeCatalog;
}
