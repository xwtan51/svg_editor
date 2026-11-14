import { StaticShapeProvider } from "@svgframe/kernel";
import type { Plugin, PluginContext, PluginOptions } from "@svgframe/kernel";
import { Circle } from "./Circle.js";
import { Ellipse } from "./Ellipse.js";
import { Group } from "./Group.js";
import { Line } from "./Line.js";
import { Rect } from "./Rect.js";
import { Text } from "./Text.js";

/**
 * The six shape types of Phase 1 as a plugin (design §2.1.1): each class's
 * static side is adapted by `StaticShapeProvider`. Registration order is that
 * of the former `ShapeFactory` constructor.
 */
export default class BuiltinShapesPlugin implements Plugin {
  constructor(_options: PluginOptions) {}

  activate(context: PluginContext): void {
    for (const type of [Rect, Circle, Ellipse, Line, Text, Group]) {
      context.registerShape(new StaticShapeProvider(type));
    }
  }
}
