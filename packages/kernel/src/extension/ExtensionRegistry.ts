import type { CommandCatalog } from "../commands/CommandCatalog.js";
import { CommandRegistry } from "../commands/CommandRegistry.js";
import type { ShapeCatalog } from "../model/ShapeCatalog.js";
import { ShapeRegistry } from "../model/ShapeRegistry.js";
import { ContributionCategory } from "./ContributionCategory.js";
import type { StagingContext } from "./StagingContext.js";

/**
 * Every committed registration of one editor (design §3.3): the shape and
 * command registries, and the registration names per category in commit
 * order. Each editor has its own instance, so nothing is shared between
 * editors in one process. Commands and plugins see only the read-only
 * catalogs; the only way in is `commit`, called by `PluginInstaller`.
 */
export class ExtensionRegistry {
  private readonly shapeRegistry = new ShapeRegistry();
  private readonly commandRegistry = new CommandRegistry();
  private readonly committed = new Map<ContributionCategory, string[]>();

  shapes(): ShapeCatalog {
    return this.shapeRegistry;
  }

  commands(): CommandCatalog {
    return this.commandRegistry;
  }

  /** Committed registration names of one category, in commit order. */
  names(category: ContributionCategory): readonly string[] {
    return [...(this.committed.get(category) ?? [])];
  }

  isRegistered(category: ContributionCategory, name: string): boolean {
    return this.names(category).includes(name);
  }

  /**
   * Appends everything staged, in staging order. Only the installer calls it,
   * after the duplicate and manifest checks, so it cannot fail half-way;
   * committing an unsealed staging context is a programming error.
   */
  commit(staging: StagingContext): void {
    if (!staging.isSealed()) {
      throw new Error("only a sealed staging context can be committed");
    }
    for (const provider of staging.shapeProviders()) {
      this.shapeRegistry.register(provider);
    }
    for (const type of staging.commandTypes()) {
      this.commandRegistry.register(type);
    }
    for (const category of ContributionCategory.all()) {
      this.committed.set(category, [...this.names(category), ...staging.names(category)]);
    }
  }
}
