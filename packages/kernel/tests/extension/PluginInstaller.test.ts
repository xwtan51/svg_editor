import { afterEach, describe, expect, it, vi } from "vitest";
import { CommandCategory } from "../../src/commands/CommandCategory.js";
import type { CommandType } from "../../src/commands/CommandType.js";
import { ContributionCategory } from "../../src/extension/ContributionCategory.js";
import { ExtensionRegistry } from "../../src/extension/ExtensionRegistry.js";
import type { Plugin } from "../../src/extension/Plugin.js";
import { PluginCandidate } from "../../src/extension/PluginCandidate.js";
import type { PluginClass } from "../../src/extension/PluginClass.js";
import type { PluginContext } from "../../src/extension/PluginContext.js";
import { PluginInstaller } from "../../src/extension/PluginInstaller.js";
import { PluginOptions } from "../../src/extension/PluginOptions.js";
import type { ShapeProvider } from "../../src/model/ShapeProvider.js";
import { StaticShapeProvider } from "../../src/model/StaticShapeProvider.js";
import { FakeCommandType } from "../doubles/FakeCommandType.js";
import { FakeContainer } from "../doubles/FakeContainer.js";
import { FakeLeaf } from "../doubles/FakeLeaf.js";

/**
 * Transactional registration (design §3.3.1): manifest → activate → seal →
 * duplicates → manifest comparison → commit, all-or-nothing, first breach only.
 * Only test doubles; no real plugin is involved.
 */

const SHAPES = ContributionCategory.SHAPES;
const COMMANDS = ContributionCategory.COMMANDS;

type Contributes = Partial<Record<"shapes" | "commands" | "decorators" | "attributes", string[]>>;

/** A plugin class whose `activate` runs `body`; the result of `body` is returned as is (to test thenables). */
function pluginClass(body: (context: PluginContext) => unknown): PluginClass {
  return class implements Plugin {
    activate(context: PluginContext) {
      return body(context);
    }
  };
}

function candidate(name: string, contributes: Contributes, body: (context: PluginContext) => unknown): PluginCandidate {
  return new PluginCandidate(name, pluginClass(body), { name, contributes }, PluginOptions.EMPTY);
}

function leafProvider(typeName: string = "fake-leaf"): ShapeProvider {
  return new StaticShapeProvider(
    class extends FakeLeaf {
      static override readonly typeName = typeName;
    },
  );
}

const fixture = () => {
  const registry = new ExtensionRegistry();
  return { registry, installer: new PluginInstaller(registry) };
};

const committed = (registry: ExtensionRegistry) => ContributionCategory.all().map((c) => registry.names(c));

afterEach(() => {
  vi.restoreAllMocks();
});

describe("PluginInstaller: success", () => {
  it("commits every registration in registration order and makes it visible through the catalogs", () => {
    const { registry, installer } = fixture();
    const leaf = new StaticShapeProvider(FakeLeaf);
    const group = new StaticShapeProvider(FakeContainer);
    const alpha = new FakeCommandType("alpha");
    const beta = new FakeCommandType("beta", CommandCategory.EDIT);
    const outcome = installer.install(
      candidate("@test/a", { shapes: ["fake-group", "fake-leaf"], commands: ["beta", "alpha"] }, (context) => {
        context.registerShape(leaf);
        context.registerCommand(alpha);
        context.registerShape(group);
        context.registerCommand(beta);
      }),
    );
    expect(outcome.succeeded()).toBe(true);
    expect(() => outcome.message()).toThrow(Error);
    expect(registry.names(SHAPES)).toEqual(["fake-leaf", "fake-group"]);
    expect(registry.names(COMMANDS)).toEqual(["alpha", "beta"]);
    expect(registry.shapes().lookup("fake-leaf")).toBe(leaf);
    expect(registry.shapes().has("fake-group")).toBe(true);
    expect(registry.commands().lookup("beta")).toBe(beta);
  });

  it("constructs a new plugin instance per installation, with the candidate's options", () => {
    const seen: PluginOptions[] = [];
    class Recording implements Plugin {
      constructor(options: PluginOptions) {
        seen.push(options);
      }
      activate(_context: PluginContext): void {}
    }
    const options = PluginOptions.of({ fill: "red" });
    for (const _ of [1, 2]) {
      const { installer } = fixture();
      expect(installer.install(new PluginCandidate("@test/r", Recording, { name: "@test/r" }, options)).succeeded()).toBe(true);
    }
    expect(seen).toEqual([options, options]);
  });

  it("a plugin with no contributions and no registrations installs", () => {
    const { registry, installer } = fixture();
    expect(installer.install(candidate("@test/empty", {}, () => undefined)).succeeded()).toBe(true);
    expect(committed(registry)).toEqual([[], [], [], []]);
  });

  it("shapeTypes() shows committed types only, not the plugin's own staged ones", () => {
    const { installer } = fixture();
    installer.install(candidate("@test/a", { shapes: ["fake-leaf"] }, (c) => c.registerShape(leafProvider())));
    const seen: boolean[] = [];
    const outcome = installer.install(
      candidate("@test/b", { shapes: ["fake-group"] }, (context) => {
        context.registerShape(new StaticShapeProvider(FakeContainer));
        seen.push(context.shapeTypes().has("fake-leaf"), context.shapeTypes().has("fake-group"));
      }),
    );
    expect(outcome.succeeded()).toBe(true);
    expect(seen).toEqual([true, false]);
  });

  it("a plugin can fail its own dependency check in activate", () => {
    const { registry, installer } = fixture();
    const outcome = installer.install(
      candidate("@test/needs", { commands: ["alpha"] }, (context) => {
        context.registerCommand(new FakeCommandType("alpha"));
        if (!context.shapeTypes().has("fake-group")) {
          throw new Error("requires shape type: fake-group");
        }
      }),
    );
    expect(outcome.message()).toBe("plugin failed to activate: @test/needs (requires shape type: fake-group)");
    expect(committed(registry)).toEqual([[], [], [], []]);
  });
});

describe("PluginInstaller: activation failures roll back", () => {
  it("activate throws after registering: nothing is committed; the reason is the first line", () => {
    const { registry, installer } = fixture();
    const outcome = installer.install(
      candidate("@test/a", { shapes: ["fake-leaf"], commands: ["alpha"] }, (context) => {
        context.registerShape(leafProvider());
        context.registerCommand(new FakeCommandType("alpha"));
        throw new Error("boom\n    at somewhere");
      }),
    );
    expect(outcome.succeeded()).toBe(false);
    expect(outcome.message()).toBe("plugin failed to activate: @test/a (boom)");
    expect(committed(registry)).toEqual([[], [], [], []]);
    expect(registry.shapes().has("fake-leaf")).toBe(false);
    expect(() => registry.commands().lookup("alpha")).toThrow("unknown command: alpha");
  });

  it("the constructor throwing counts as an activation failure", () => {
    const { installer } = fixture();
    class Broken implements Plugin {
      constructor(_options: PluginOptions) {
        throw new TypeError("bad options");
      }
      activate(_context: PluginContext): void {}
    }
    expect(installer.install(new PluginCandidate("@test/b", Broken, { name: "@test/b" }, PluginOptions.EMPTY)).message()).toBe(
      "plugin failed to activate: @test/b (bad options)",
    );
  });

  it("a thrown non-Error is reported with String(value)", () => {
    const { installer } = fixture();
    const outcome = installer.install(
      candidate("@test/s", {}, () => {
        throw "plain string";
      }),
    );
    expect(outcome.message()).toBe("plugin failed to activate: @test/s (plain string)");
  });

  it("an async activate fails, its staged registrations are dropped, and its rejection is not left unhandled", async () => {
    const { registry, installer } = fixture();
    const unhandled: unknown[] = [];
    const listener = (reason: unknown) => unhandled.push(reason);
    process.on("unhandledRejection", listener);
    try {
      const outcome = installer.install(
        candidate("@test/async", { shapes: ["fake-leaf"] }, async (context) => {
          context.registerShape(leafProvider());
          throw new Error("late failure");
        }),
      );
      expect(outcome.message()).toBe("plugin failed to activate: @test/async (activate must be synchronous)");
      expect(committed(registry)).toEqual([[], [], [], []]);
      await new Promise((resolve) => setTimeout(resolve, 10));
      expect(unhandled).toEqual([]);
    } finally {
      process.off("unhandledRejection", listener);
    }
  });

  it("any thenable result counts as asynchronous", () => {
    const { installer } = fixture();
    const outcome = installer.install(candidate("@test/t", {}, () => ({ then: () => undefined })));
    expect(outcome.message()).toBe("plugin failed to activate: @test/t (activate must be synchronous)");
  });

  it("the context is sealed when activate returns: a kept context throws and changes nothing", () => {
    const { registry, installer } = fixture();
    let kept: PluginContext | null = null;
    const outcome = installer.install(
      candidate("@test/keeper", {}, (context) => {
        kept = context;
      }),
    );
    expect(outcome.succeeded()).toBe(true);
    const context = kept as unknown as PluginContext;
    expect(() => context.registerShape(leafProvider())).toThrow("plugin context used after activate returned");
    expect(() => context.registerCommand(new FakeCommandType("alpha"))).toThrow(Error);
    expect(() => context.shapeTypes()).toThrow(Error);
    expect(committed(registry)).toEqual([[], [], [], []]);
  });

  it("the context is sealed after a failed activate too", () => {
    const { installer } = fixture();
    let kept: PluginContext | null = null;
    installer.install(
      candidate("@test/keeper", {}, (context) => {
        kept = context;
        throw new Error("no");
      }),
    );
    expect(() => (kept as unknown as PluginContext).registerCommand(new FakeCommandType("alpha"))).toThrow(Error);
  });
});

describe("PluginInstaller: registration shape checks fail the activation", () => {
  const install = (register: (context: PluginContext) => void) =>
    fixture().installer.install(candidate("@test/shape", {}, register)).message();

  it.each([
    ["empty", ""],
    ["white space", "two words"],
  ])("shape type name: %s", (_case, typeName) => {
    expect(install((c) => c.registerShape(leafProvider(typeName)))).toBe(
      "plugin failed to activate: @test/shape (invalid shape provider: typeName must be a non-empty string without white space)",
    );
  });

  it("a shape provider without matchScore", () => {
    const partial = {
      typeName: "half",
      params: [],
      claimedIds: () => [],
      create: () => null,
      creationDetail: () => "",
      read: () => null,
    } as unknown as ShapeProvider;
    expect(install((c) => c.registerShape(partial))).toBe(
      "plugin failed to activate: @test/shape (invalid shape provider half: matchScore must be a function)",
    );
  });

  it.each([
    ["upper case", { commandName: "Alpha" }, "invalid command type: commandName must be a non-empty lower-case string without white space"],
    ["empty", { commandName: "" }, "invalid command type: commandName must be a non-empty lower-case string without white space"],
    ["two-line usage", { usage: "a\nb" }, "invalid command type alpha: usage must be a non-empty single line"],
    ["empty summary", { summary: "" }, "invalid command type alpha: summary must be a non-empty single line"],
    ["foreign category", { category: { title: () => "Mine", order: () => 9 } }, "invalid command type alpha: category must be one of the CommandCategory constants"],
    ["requiresDocument not boolean", { requiresDocument: "yes" }, "invalid command type alpha: requiresDocument must be a boolean"],
    ["no parse", { parse: undefined }, "invalid command type alpha: parse must be a function"],
  ])("command type: %s", (_case, override, reason) => {
    const type = { ...pick(new FakeCommandType("alpha")), ...override } as unknown as CommandType;
    expect(install((c) => c.registerCommand(type))).toBe(`plugin failed to activate: @test/shape (${reason})`);
  });

  /** The fields of a command type as a plain object (parse included). */
  function pick(type: FakeCommandType): Record<string, unknown> {
    return {
      commandName: type.commandName,
      usage: type.usage,
      summary: type.summary,
      category: type.category,
      requiresDocument: type.requiresDocument,
      parse: type.parse.bind(type),
    };
  }
});

describe("PluginInstaller: duplicates", () => {
  it("against an earlier plugin: rejected, the new plugin's other registrations are dropped", () => {
    const { registry, installer } = fixture();
    installer.install(candidate("@test/a", { shapes: ["fake-leaf"] }, (c) => c.registerShape(leafProvider())));
    const outcome = installer.install(
      candidate("@test/b", { shapes: ["fake-leaf"], commands: ["alpha"] }, (context) => {
        context.registerCommand(new FakeCommandType("alpha"));
        context.registerShape(leafProvider());
      }),
    );
    expect(outcome.message()).toBe("duplicate registration: shapes/fake-leaf");
    expect(registry.names(SHAPES)).toEqual(["fake-leaf"]);
    expect(registry.names(COMMANDS)).toEqual([]);
  });

  it("within one plugin", () => {
    const { registry, installer } = fixture();
    const outcome = installer.install(
      candidate("@test/twice", { commands: ["alpha"] }, (context) => {
        context.registerCommand(new FakeCommandType("alpha"));
        context.registerCommand(new FakeCommandType("alpha"));
      }),
    );
    expect(outcome.message()).toBe("duplicate registration: commands/alpha");
    expect(committed(registry)).toEqual([[], [], [], []]);
  });

  it("the same name in two categories is not a duplicate", () => {
    const { installer } = fixture();
    const outcome = installer.install(
      candidate("@test/both", { shapes: ["thing"], commands: ["thing"] }, (context) => {
        context.registerShape(leafProvider("thing"));
        context.registerCommand(new FakeCommandType("thing"));
      }),
    );
    expect(outcome.succeeded()).toBe(true);
  });

  it("categories are checked in the fixed order (shapes before commands), then registration order", () => {
    const { installer } = fixture();
    installer.install(
      candidate("@test/a", { shapes: ["fake-leaf"], commands: ["alpha"] }, (context) => {
        context.registerShape(leafProvider());
        context.registerCommand(new FakeCommandType("alpha"));
      }),
    );
    const outcome = installer.install(
      candidate("@test/b", { shapes: ["fake-leaf", "x"], commands: ["alpha"] }, (context) => {
        context.registerCommand(new FakeCommandType("alpha"));
        context.registerShape(leafProvider("x"));
        context.registerShape(leafProvider());
      }),
    );
    expect(outcome.message()).toBe("duplicate registration: shapes/fake-leaf");
  });
});

describe("PluginInstaller: manifest", () => {
  it("declared and registered differ: both full lists, categories in fixed order, (none) for an empty side", () => {
    const { registry, installer } = fixture();
    const outcome = installer.install(
      candidate("@test/m", { shapes: ["fake-leaf"], attributes: ["fill-handler"] }, (context) => {
        context.registerCommand(new FakeCommandType("alpha"));
        context.registerShape(leafProvider());
      }),
    );
    expect(outcome.message()).toBe(
      "plugin manifest mismatch: @test/m (declared: shapes/fake-leaf attributes/fill-handler, registered: shapes/fake-leaf commands/alpha)",
    );
    expect(committed(registry)).toEqual([[], [], [], []]);
  });

  it("nothing declared, something registered", () => {
    const { installer } = fixture();
    const outcome = installer.install(candidate("@test/m", {}, (c) => c.registerCommand(new FakeCommandType("alpha"))));
    expect(outcome.message()).toBe("plugin manifest mismatch: @test/m (declared: (none), registered: commands/alpha)");
  });

  it("compares as sets: a different declaration order is fine", () => {
    const { installer } = fixture();
    const outcome = installer.install(
      candidate("@test/m", { commands: ["beta", "alpha"] }, (context) => {
        context.registerCommand(new FakeCommandType("alpha"));
        context.registerCommand(new FakeCommandType("beta"));
      }),
    );
    expect(outcome.succeeded()).toBe(true);
  });

  it("an invalid manifest is reported with the candidate's label, and the plugin is not even constructed", () => {
    const { registry, installer } = fixture();
    let constructed = false;
    class Never implements Plugin {
      constructor(_options: PluginOptions) {
        constructed = true;
      }
      activate(_context: PluginContext): void {}
    }
    const json = { name: "@test/bad", contributes: { shape: ["fake-leaf"] } };
    const outcome = installer.install(new PluginCandidate("./plugins/bad", Never, json, PluginOptions.EMPTY));
    expect(outcome.message()).toBe("invalid plugin manifest: ./plugins/bad (unknown contributes key: shape)");
    expect(constructed).toBe(false);
    expect(committed(registry)).toEqual([[], [], [], []]);
  });
});

describe("PluginInstaller: only the first breach is reported (0 → 1 → 2 → 3)", () => {
  it("invalid manifest beats a failing activate", () => {
    const { installer } = fixture();
    const bad = new PluginCandidate(
      "label",
      pluginClass(() => {
        throw new Error("x");
      }),
      { contributes: {} },
      PluginOptions.EMPTY,
    );
    expect(installer.install(bad).message()).toBe("invalid plugin manifest: label (name must be a non-empty string)");
  });

  it("a failing activate beats duplicates and a mismatch", () => {
    const { installer } = fixture();
    const outcome = installer.install(
      candidate("@test/x", {}, (context) => {
        context.registerCommand(new FakeCommandType("alpha"));
        context.registerCommand(new FakeCommandType("alpha"));
        throw new Error("failed late");
      }),
    );
    expect(outcome.message()).toBe("plugin failed to activate: @test/x (failed late)");
  });

  it("a duplicate beats a mismatch", () => {
    const { installer } = fixture();
    const outcome = installer.install(
      candidate("@test/x", { shapes: ["other"] }, (context) => {
        context.registerShape(leafProvider());
        context.registerShape(leafProvider());
      }),
    );
    expect(outcome.message()).toBe("duplicate registration: shapes/fake-leaf");
  });
});

describe("PluginInstaller: after a rollback", () => {
  it("later plugins install normally and earlier ones stay", () => {
    const { registry, installer } = fixture();
    const results = [
      installer.install(candidate("@test/first", { commands: ["alpha"] }, (c) => c.registerCommand(new FakeCommandType("alpha")))),
      installer.install(
        candidate("@test/broken", { commands: ["beta"] }, (context) => {
          context.registerCommand(new FakeCommandType("beta"));
          throw new Error("broken");
        }),
      ),
      installer.install(candidate("@test/third", { commands: ["beta"] }, (c) => c.registerCommand(new FakeCommandType("beta")))),
    ].map((outcome) => outcome.succeeded());
    expect(results).toEqual([true, false, true]);
    expect(registry.names(COMMANDS)).toEqual(["alpha", "beta"]);
  });

  it("editors do not share registrations", () => {
    const a = fixture();
    const b = fixture();
    a.installer.install(candidate("@test/a", { commands: ["alpha"] }, (c) => c.registerCommand(new FakeCommandType("alpha"))));
    expect(b.registry.names(COMMANDS)).toEqual([]);
    expect(b.installer.install(candidate("@test/a", { commands: ["alpha"] }, (c) => c.registerCommand(new FakeCommandType("alpha")))).succeeded()).toBe(true);
  });
});
