import { CommandCategory } from "../commands/CommandCategory.js";
import type { CommandType } from "../commands/CommandType.js";
import type { AttributeHandler } from "../model/AttributeHandler.js";
import type { ShapeCatalog } from "../model/ShapeCatalog.js";
import type { ShapeProvider } from "../model/ShapeProvider.js";
import type { TreeDecorator } from "../view/TreeDecorator.js";
import { ContributionCategory } from "./ContributionCategory.js";
import type { DocumentListener } from "./DocumentListener.js";
import type { ExtensionRegistry } from "./ExtensionRegistry.js";
import type { PluginContext } from "./PluginContext.js";

/**
 * The only implementation of `PluginContext` (design §3.3): registrations go
 * into a staging area and reach the committed registries only through
 * `ExtensionRegistry.commit`, after the installer's checks. Dropping the
 * object is the rollback. Once sealed, every call throws, so a plugin that
 * kept the context cannot register past the checks (G16).
 */
export class StagingContext implements PluginContext {
  private static readonly REGISTRATION_NAME = /^\S+$/;
  private static readonly ONE_LINE = /^[^\r\n]+$/;

  private readonly registry: ExtensionRegistry;
  private readonly shapes: ShapeProvider[] = [];
  private readonly commands: CommandType[] = [];
  private readonly decorators: TreeDecorator[] = [];
  private readonly handlers: AttributeHandler[] = [];
  private readonly listeners: DocumentListener[] = [];
  private readonly staged = new Map<ContributionCategory, string[]>();
  private sealed = false;

  constructor(registry: ExtensionRegistry) {
    this.registry = registry;
  }

  registerShape(provider: ShapeProvider): void {
    this.checkOpen();
    this.checkShape(provider);
    this.shapes.push(provider);
    this.stage(ContributionCategory.SHAPES, provider.typeName);
  }

  registerCommand(type: CommandType): void {
    this.checkOpen();
    this.checkCommand(type);
    this.commands.push(type);
    this.stage(ContributionCategory.COMMANDS, type.commandName);
  }

  registerTreeDecorator(decorator: TreeDecorator): void {
    this.checkOpen();
    this.checkDecorator(decorator);
    this.decorators.push(decorator);
    this.stage(ContributionCategory.DECORATORS, decorator.name);
  }

  registerAttributeHandler(handler: AttributeHandler): void {
    this.checkOpen();
    this.checkHandler(handler);
    this.handlers.push(handler);
    this.stage(ContributionCategory.ATTRIBUTES, handler.name);
  }

  subscribe(listener: DocumentListener): void {
    this.checkOpen();
    this.checkListener(listener);
    this.listeners.push(listener);
  }

  shapeTypes(): ShapeCatalog {
    this.checkOpen();
    return this.registry.shapes();
  }

  /** Called by the installer when `activate` has returned (or thrown). */
  seal(): void {
    this.sealed = true;
  }

  isSealed(): boolean {
    return this.sealed;
  }

  /** Staged registration names of one category, in registration order (may contain duplicates). */
  names(category: ContributionCategory): readonly string[] {
    return [...(this.staged.get(category) ?? [])];
  }

  /** Staged shape providers, in registration order. */
  shapeProviders(): readonly ShapeProvider[] {
    return [...this.shapes];
  }

  /** Staged command types, in registration order. */
  commandTypes(): readonly CommandType[] {
    return [...this.commands];
  }

  /** Staged tree decorators, in registration order. */
  treeDecorators(): readonly TreeDecorator[] {
    return [...this.decorators];
  }

  /** Staged attribute handlers, in registration order. */
  attributeHandlers(): readonly AttributeHandler[] {
    return [...this.handlers];
  }

  /** Staged document listeners, in subscription order. */
  documentListeners(): readonly DocumentListener[] {
    return [...this.listeners];
  }

  private stage(category: ContributionCategory, name: string): void {
    const names = this.staged.get(category) ?? [];
    names.push(name);
    this.staged.set(category, names);
  }

  private checkOpen(): void {
    if (this.sealed) {
      throw new Error("plugin context used after activate returned");
    }
  }

  private checkShape(provider: ShapeProvider): void {
    if (typeof provider !== "object" || provider === null) {
      throw new Error("invalid shape provider: not an object");
    }
    if (!StagingContext.isRegistrationName(provider.typeName)) {
      throw new Error("invalid shape provider: typeName must be a non-empty string without white space");
    }
    if (!Array.isArray(provider.params)) {
      throw new Error(`invalid shape provider ${provider.typeName}: params must be an array`);
    }
    const methods: readonly unknown[] = [provider.claimedIds, provider.create, provider.creationDetail, provider.matchScore, provider.read];
    if (!methods.every((method) => typeof method === "function")) {
      throw new Error(
        `invalid shape provider ${provider.typeName}: claimedIds, create, creationDetail, matchScore and read must be functions`,
      );
    }
  }

  private checkCommand(type: CommandType): void {
    if ((typeof type !== "object" && typeof type !== "function") || type === null) {
      throw new Error("invalid command type: not an object");
    }
    const name: unknown = type.commandName;
    if (!StagingContext.isRegistrationName(name) || name !== name.toLowerCase()) {
      throw new Error("invalid command type: commandName must be a non-empty lower-case string without white space");
    }
    for (const [field, value] of [["usage", type.usage], ["summary", type.summary]] as const) {
      if (typeof value !== "string" || !StagingContext.ONE_LINE.test(value)) {
        throw new Error(`invalid command type ${name}: ${field} must be a non-empty single line`);
      }
    }
    if (!CommandCategory.all().includes(type.category)) {
      throw new Error(`invalid command type ${name}: category must be one of the CommandCategory constants`);
    }
    if (typeof type.requiresDocument !== "boolean") {
      throw new Error(`invalid command type ${name}: requiresDocument must be a boolean`);
    }
    if (typeof type.parse !== "function") {
      throw new Error(`invalid command type ${name}: parse must be a function`);
    }
  }

  private checkDecorator(decorator: TreeDecorator): void {
    if (typeof decorator !== "object" || decorator === null) {
      throw new Error("invalid tree decorator: not an object");
    }
    if (!StagingContext.isRegistrationName(decorator.name)) {
      throw new Error("invalid tree decorator: name must be a non-empty string without white space");
    }
    if (typeof decorator.tagFor !== "function") {
      throw new Error(`invalid tree decorator ${decorator.name}: tagFor must be a function`);
    }
  }

  private checkHandler(handler: AttributeHandler): void {
    if (typeof handler !== "object" || handler === null) {
      throw new Error("invalid attribute handler: not an object");
    }
    if (!StagingContext.isRegistrationName(handler.name)) {
      throw new Error("invalid attribute handler: name must be a non-empty string without white space");
    }
    if (!Number.isInteger(handler.priority)) {
      throw new Error(`invalid attribute handler ${handler.name}: priority must be an integer`);
    }
    if (typeof handler.handles !== "function" || typeof handler.apply !== "function") {
      throw new Error(`invalid attribute handler ${handler.name}: handles and apply must be functions`);
    }
  }

  private checkListener(listener: DocumentListener): void {
    if (typeof listener !== "object" || listener === null) {
      throw new Error("invalid document listener: not an object");
    }
    const methods: readonly unknown[] = [listener.documentReplaced, listener.documentSaved, listener.documentEdited];
    if (!methods.every((method) => typeof method === "function")) {
      throw new Error("invalid document listener: documentReplaced, documentSaved and documentEdited must be functions");
    }
  }

  private static isRegistrationName(value: unknown): value is string {
    return typeof value === "string" && StagingContext.REGISTRATION_NAME.test(value);
  }
}
