import { PluginOptions, SvgDocument, SvgImporter, SvgSerializer, TreeRenderer } from "@svgframe/kernel";
import type { Shape } from "@svgframe/kernel";
import { EditorSession, ExtensionRegistry, PluginCandidate, PluginInstaller } from "@svgframe/kernel/host";
import manifest from "../../package.json" with { type: "json" };
import BoxPlugin from "../../src/BoxPlugin.js";
import { FakeShapesPlugin } from "./FakeShapesPlugin.js";
import { MemoryFiles } from "./MemoryFiles.js";

/**
 * The smallest world for testing box (design §9.1): a fresh registry with the
 * stand-in shapes and, unless `withBox` is false, the real `BoxPlugin` with its
 * own `package.json` as the manifest, both through the real installer. It
 * builds boxes through the registry (`BoxProvider.create` with the real
 * `ShapeKit`), reads SVG text through the real `SvgImporter`, and serializes
 * and renders with the kernel's own classes. No other plugin is involved.
 */
export class BoxTestbed {
  private static readonly FILE = "in.svg";

  private readonly registryField: ExtensionRegistry;

  private constructor(registry: ExtensionRegistry) {
    this.registryField = registry;
  }

  /** Stand-in shapes, then box (when `withBox`). */
  static create(withBox: boolean = true): BoxTestbed {
    const registry = new ExtensionRegistry();
    const installer = new PluginInstaller(registry);
    const candidates = withBox ? [FakeShapesPlugin.candidate(), BoxTestbed.box()] : [FakeShapesPlugin.candidate()];
    for (const candidate of candidates) {
      const outcome = installer.install(candidate);
      if (!outcome.succeeded()) {
        throw new Error(`test setup: ${outcome.message()}`);
      }
    }
    return new BoxTestbed(registry);
  }

  /** The real box plugin with its real manifest, as the composition root hands it over. */
  static box(): PluginCandidate {
    return new PluginCandidate(manifest.name, BoxPlugin, manifest, PluginOptions.EMPTY);
  }

  registry(): ExtensionRegistry {
    return this.registryField;
  }

  /** `create box <id> <x> <y> <w> <h> "<label>"` as the provider sees it: values keyed by attribute name. */
  box(id: string, x: string, y: string, w: string, h: string, label: string): Shape {
    const values = new Map([["x", x], ["y", y], ["width", w], ["height", h], ["label", label]]);
    return this.registryField.shapes().build("box", id, values);
  }

  /** A document holding `shapes` in order. */
  document(...shapes: Shape[]): SvgDocument {
    const document = new SvgDocument();
    shapes.forEach((shape, index) => document.insertAt(shape, index));
    return document;
  }

  serialize(document: SvgDocument): string {
    return new SvgSerializer().serialize(document);
  }

  /** Reads `text` as a file with this registry's shape types; throws what `read` would report. */
  read(text: string): { document: SvgDocument; warnings: string[] } {
    const result = new SvgImporter(this.registryField.shapes()).read(new MemoryFiles({ [BoxTestbed.FILE]: text }), BoxTestbed.FILE);
    return { document: result.document(), warnings: result.warnings() };
  }

  /** The `tree` lines of `document` with this registry's tree decorators. */
  tree(document: SvgDocument): string[] {
    return new TreeRenderer(this.registryField.treeDecorators()).renderDocument(document);
  }

  /** A session whose current document is `document`, for the attribute pipeline. */
  session(document: SvgDocument): EditorSession {
    const session = new EditorSession(new MemoryFiles(), this.registryField);
    session.replaceDocument(document, null);
    return session;
  }
}
