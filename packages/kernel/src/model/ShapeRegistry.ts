import { EditorError } from "./EditorError.js";
import type { Shape } from "./Shape.js";
import type { ShapeCatalog } from "./ShapeCatalog.js";
import type { ShapeProvider } from "./ShapeProvider.js";

/**
 * Name dispatch #1 (spec §2.1): type name → shape provider. Used by `create`
 * (CLI type names) and by read-back, so there is exactly one such table.
 * It starts empty: every type, the six built-in ones included, is registered
 * by a plugin through `ExtensionRegistry.commit` (design §2.1.1; README K1 resolved).
 */
export class ShapeRegistry implements ShapeCatalog {
  private readonly types = new Map<string, ShapeProvider>();

  /** Registering the same name twice is a programming error (the installer checks for duplicates first). */
  register(provider: ShapeProvider): void {
    if (this.types.has(provider.typeName)) {
      throw new Error(`shape type already registered: ${provider.typeName}`);
    }
    this.types.set(provider.typeName, provider);
  }

  /** Case-sensitive; throws `unknown shape type: <name> (is the plugin loaded?)` (§4.2). */
  lookup(typeName: string): ShapeProvider {
    const provider = this.types.get(typeName);
    if (provider === undefined) {
      throw new EditorError(`unknown shape type: ${typeName} (is the plugin loaded?)`);
    }
    return provider;
  }

  has(typeName: string): boolean {
    return this.types.has(typeName);
  }

  /** Registered type names in registration order (for usage text). */
  typeNames(): readonly string[] {
    return [...this.types.keys()];
  }

  providers(): readonly ShapeProvider[] {
    return [...this.types.values()];
  }

  build(typeName: string, id: string, values: ReadonlyMap<string, string>): Shape {
    return this.lookup(typeName).create(id, values, this);
  }
}
