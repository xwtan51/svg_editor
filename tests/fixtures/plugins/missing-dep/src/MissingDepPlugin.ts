import type { Plugin, PluginContext } from "@svgframe/kernel";
// @ts-expect-error The dependency is missing on purpose: importing this module must fail.
import { helper } from "@fixture/does-not-exist";

/** Loader fixture: the module exists, but a package it imports does not (`plugin failed to load`, not `not found`). */
export default class MissingDepPlugin implements Plugin {
  activate(_context: PluginContext): void {
    helper();
  }
}
