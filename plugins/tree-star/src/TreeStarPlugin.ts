import type { Plugin, PluginContext, PluginOptions } from "@svgframe/kernel";
import { ModifiedStar } from "./ModifiedStar.js";

/**
 * The plugin entry (design §3.1, §8.4): the tree tag `modified-star`. One
 * `ModifiedStar` per plugin instance — and so per `Editor` (X15) — is both the
 * registered `TreeDecorator` and the subscribed `DocumentListener`, so the save
 * point it records is the one it compares against. It takes no options.
 */
export default class TreeStarPlugin implements Plugin {
  constructor(_options: PluginOptions) {}

  activate(context: PluginContext): void {
    const star = new ModifiedStar();
    context.registerTreeDecorator(star);
    context.subscribe(star);
  }
}
