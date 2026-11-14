import type { Shape } from "./Shape.js";

/**
 * "Build a shape of this type by name" (design §2.1.2, §2.1.5): what a shape
 * provider is given in `create`, so that a composite type can build its parts
 * (for example a `rect` and a `text`) without importing another plugin.
 */
export interface ShapeKit {
  /**
   * Builds a detached shape: same as `lookup(typeName).create(id, values, this)`.
   * Throws `EditorError` `unknown shape type: <name> (is the plugin loaded?)`
   * when the type is not registered, and the provider's own `EditorError`s for invalid values.
   */
  build(typeName: string, id: string, values: ReadonlyMap<string, string>): Shape;
}
