import { Circle } from "./Circle.js";
import { EditorError } from "./EditorError.js";
import { Ellipse } from "./Ellipse.js";
import { Group } from "./Group.js";
import { Line } from "./Line.js";
import { Rect } from "./Rect.js";
import type { ShapeType } from "./ShapeType.js";
import { Text } from "./Text.js";

/**
 * Name dispatch #1 (spec §2.1): type name → shape class. Used by `create`
 * (CLI type names) and by the importer (SVG tag names), so there is exactly one
 * such table.
 *
 * TO REFACTOR (README §4.1): the built-in types are hard-wired in the
 * constructor; plugin types will be added from outside through `register`.
 */
export class ShapeFactory {
  private readonly types = new Map<string, ShapeType>();

  constructor() {
    this.register(Rect);
    this.register(Circle);
    this.register(Ellipse);
    this.register(Line);
    this.register(Text);
    this.register(Group);
  }

  /** Registering the same name twice is a programming error. */
  register(type: ShapeType): void {
    if (this.types.has(type.typeName)) {
      throw new Error(`shape type already registered: ${type.typeName}`);
    }
    this.types.set(type.typeName, type);
  }

  /** Case-sensitive; throws `unknown shape type: <name> (is the plugin loaded?)` (§4.2). */
  lookup(name: string): ShapeType {
    const type = this.types.get(name);
    if (type === undefined) {
      throw new EditorError(`unknown shape type: ${name} (is the plugin loaded?)`);
    }
    return type;
  }

  /** Registered type names in registration order (for help / usage text). */
  typeNames(): string[] {
    return [...this.types.keys()];
  }
}
