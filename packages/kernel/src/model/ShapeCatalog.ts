import type { ShapeKit } from "./ShapeKit.js";
import type { ShapeProvider } from "./ShapeProvider.js";

/**
 * The committed shape types, read-only plus "build by name" (design §2.1.2).
 * Commands see it as `CommandContext.shapes()`, plugins as
 * `PluginContext.shapeTypes()`, the importer as its constructor argument.
 * There is no way to register through it.
 */
export interface ShapeCatalog extends ShapeKit {
  /** Case-sensitive; throws `EditorError` `unknown shape type: <name> (is the plugin loaded?)`. */
  lookup(typeName: string): ShapeProvider;

  has(typeName: string): boolean;

  /** Type names in registration order. */
  typeNames(): readonly string[];

  /** Every provider in registration order; read-back asks each for its `matchScore`. */
  providers(): readonly ShapeProvider[];
}
