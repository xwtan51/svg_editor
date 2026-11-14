import { Circle } from "../../../../plugins/builtin-shapes/src/Circle.js";
import { EditorError } from "./EditorError.js";
import { Ellipse } from "../../../../plugins/builtin-shapes/src/Ellipse.js";
import { Group } from "../../../../plugins/builtin-shapes/src/Group.js";
import { Line } from "../../../../plugins/builtin-shapes/src/Line.js";
import { Rect } from "../../../../plugins/builtin-shapes/src/Rect.js";
import type { Shape } from "./Shape.js";
import type { ShapeCatalog } from "./ShapeCatalog.js";
import type { ShapeProvider } from "./ShapeProvider.js";
import { StaticShapeProvider } from "./StaticShapeProvider.js";
import { Text } from "../../../../plugins/builtin-shapes/src/Text.js";

/**
 * Name dispatch #1 (spec §2.1): type name → shape provider. Used by `create`
 * (CLI type names) and by read-back, so there is exactly one such table.
 *
 * TO REFACTOR (README §4.1): the built-in types are still hard-wired in the
 * constructor; the next commit moves them into the built-in shapes plugin.
 */
export class ShapeRegistry implements ShapeCatalog {
  private readonly types = new Map<string, ShapeProvider>();

  constructor() {
    for (const type of [Rect, Circle, Ellipse, Line, Text, Group]) {
      this.register(new StaticShapeProvider(type));
    }
  }

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
