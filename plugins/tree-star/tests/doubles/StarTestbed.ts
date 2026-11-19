import { CanvasSize, PluginOptions, SvgDocument, TreeRenderer } from "@svgframe/kernel";
import type { DocumentListener, Plugin, PluginContext, Shape, TreeDecorator } from "@svgframe/kernel";
import { ExtensionRegistry, PluginCandidate, PluginInstaller } from "@svgframe/kernel/host";
import manifest from "../../package.json" with { type: "json" };
import TreeStarPlugin from "../../src/TreeStarPlugin.js";
import { FakeBoxTag } from "./FakeBoxTag.js";
import { FakeGroup } from "./FakeGroup.js";
import { FakeRect } from "./FakeRect.js";
import { FakeText } from "./FakeText.js";

/**
 * The smallest world for testing modified-star (design §9.1): real
 * `SvgDocument`s built from stand-in shapes, the kernel's `TreeRenderer`, and
 * registries filled through the real `PluginInstaller` with the real
 * `TreeStarPlugin` (its own `package.json` as the manifest) and, when asked,
 * a stand-in `(box)` tag plugin. No other plugin is involved.
 */
export class StarTestbed {
  private static readonly BOX_TAG_PLUGIN = "test-box-tag";

  /** The real tree-star plugin with its real manifest, as the composition root hands it over. */
  static star(): PluginCandidate {
    return new PluginCandidate(manifest.name, TreeStarPlugin, manifest, PluginOptions.EMPTY);
  }

  /** A plugin registering one `FakeBoxTag`, with a matching manifest. */
  static boxTag(): PluginCandidate {
    class BoxTagPlugin implements Plugin {
      activate(context: PluginContext): void {
        context.registerTreeDecorator(new FakeBoxTag());
      }
    }
    const name = StarTestbed.BOX_TAG_PLUGIN;
    return new PluginCandidate(name, BoxTagPlugin, { name, contributes: { decorators: ["fake-box-tag"] } }, PluginOptions.EMPTY);
  }

  /** A fresh registry with `candidates` installed in order; any failure fails the set-up. */
  static install(...candidates: PluginCandidate[]): ExtensionRegistry {
    const registry = new ExtensionRegistry();
    const installer = new PluginInstaller(registry);
    for (const candidate of candidates) {
      const outcome = installer.install(candidate);
      if (!outcome.succeeded()) {
        throw new Error(`test setup: ${outcome.message()}`);
      }
    }
    return registry;
  }

  /** The decorators and listeners of `registry`, rendered and driven together. */
  static world(registry: ExtensionRegistry): { decorators: readonly TreeDecorator[]; listeners: readonly DocumentListener[] } {
    return { decorators: registry.treeDecorators(), listeners: registry.documentListeners() };
  }

  static rect(id: string, x = 0, y = 0, w = 10, h = 10): FakeRect {
    const rect = new FakeRect(id);
    const values: ReadonlyArray<readonly [string, number]> = [["x", x], ["y", y], ["width", w], ["height", h]];
    values.forEach(([name, value]) => rect.setAttribute(name, String(value)));
    return rect;
  }

  static text(id: string, content: string): FakeText {
    const text = new FakeText(id);
    text.setAttribute("x", "0");
    text.setAttribute("y", "0");
    text.setAttribute("text", content);
    return text;
  }

  /** A container holding `children` in order; `kind` = `"box"` for a stand-in box. */
  static group(id: string, children: readonly Shape[] = [], kind = "g"): FakeGroup {
    const group = new FakeGroup(id, kind);
    children.forEach((child, index) => group.insertAt(child, index));
    return group;
  }

  /** A document of `width` x `height` holding `shapes` in order. */
  static document(shapes: readonly Shape[] = [], width = 800, height = 600): SvgDocument {
    const document = new SvgDocument(new CanvasSize(width, height));
    shapes.forEach((shape, index) => document.insertAt(shape, index));
    return document;
  }

  /** `tree` of `document` with `decorators`. */
  static tree(decorators: readonly TreeDecorator[], document: SvgDocument): string[] {
    return new TreeRenderer(decorators).renderDocument(document);
  }

  /** `tree <id>` of the shape `id` in `document` with `decorators`. */
  static subtree(decorators: readonly TreeDecorator[], document: SvgDocument, id: string): string[] {
    const shape = document.findView(id);
    if (shape === null) {
      throw new Error(`test setup: no shape ${id}`);
    }
    return new TreeRenderer(decorators).renderSubtree(shape, document);
  }
}
