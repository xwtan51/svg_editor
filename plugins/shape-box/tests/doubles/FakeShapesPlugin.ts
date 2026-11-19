import { PluginOptions, StaticShapeProvider } from "@svgframe/kernel";
import type { Plugin, PluginContext, ShapeType } from "@svgframe/kernel";
import { PluginCandidate } from "@svgframe/kernel/host";
import { FakeGroup } from "./FakeGroup.js";
import { FakeRect } from "./FakeRect.js";
import { FakeText } from "./FakeText.js";

/**
 * Test double for the built-in shapes plugin: registers the given shape
 * classes (by default the stand-ins for `rect`, `text` and `g`) through
 * `StaticShapeProvider`, with a matching manifest, so box can be installed
 * without any other plugin.
 */
export class FakeShapesPlugin {
  static readonly NAME = "test-shapes";
  static readonly ALL: readonly ShapeType[] = [FakeRect, FakeText, FakeGroup];

  /** A candidate registering `types` in order. */
  static candidate(types: readonly ShapeType[] = FakeShapesPlugin.ALL): PluginCandidate {
    class ShapesPlugin implements Plugin {
      activate(context: PluginContext): void {
        types.forEach((type) => context.registerShape(new StaticShapeProvider(type)));
      }
    }
    const name = FakeShapesPlugin.NAME;
    const contributes = { shapes: types.map((type) => type.typeName) };
    return new PluginCandidate(name, ShapesPlugin, { name, contributes }, PluginOptions.EMPTY);
  }
}
