import type { Plugin, PluginContext, PluginOptions } from "@svgframe/kernel";
import { BoxAttributeHandler } from "./BoxAttributeHandler.js";
import { BoxProvider } from "./BoxProvider.js";
import { BoxTypeLabel } from "./BoxTypeLabel.js";

/**
 * The plugin entry (design §3.1, §8.3): the `box` shape type with its attribute
 * semantics and tree tag. It builds its parts through the shape types `rect`
 * and `text`, so it refuses to activate unless they were installed before it
 * (design §2.1.5); it takes no options.
 */
export default class BoxPlugin implements Plugin {
  constructor(_options: PluginOptions) {}

  activate(context: PluginContext): void {
    const types = context.shapeTypes();
    if (!types.has("rect") || !types.has("text")) {
      throw new Error("requires shape types: rect, text");
    }
    context.registerShape(new BoxProvider());
    context.registerAttributeHandler(new BoxAttributeHandler());
    context.registerTreeDecorator(new BoxTypeLabel());
  }
}
