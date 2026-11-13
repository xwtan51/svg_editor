import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ExtensionContext } from "vscode";
import { EventEmitter } from "../stubs/vscode.js";

const registered: unknown[] = [];
const watcherArgs: unknown[][] = [];
const registration = { dispose: vi.fn() };

vi.mock("vscode", async (importOriginal) => {
  const stub = await importOriginal<typeof import("../stubs/vscode.js")>();
  return {
    ...stub,
    window: {
      registerFileDecorationProvider: (provider: unknown) => {
        registered.push(provider);
        return registration;
      },
    },
    workspace: {
      fs: { stat: async () => ({ type: 1 }) },
      createFileSystemWatcher: (...args: unknown[]) => {
        watcherArgs.push(args);
        const none = new EventEmitter<unknown>();
        return { onDidCreate: none.event, onDidChange: none.event, onDidDelete: none.event, dispose: vi.fn() };
      },
    },
  };
});

const { activate, deactivate } = await import("../../src/extension.js");
const { SvgFileDecorationProvider } = await import("../../src/host/SvgFileDecorationProvider.js");
const { SvgResourceWatcher } = await import("../../src/host/SvgResourceWatcher.js");

describe("extension entry", () => {
  beforeEach(() => {
    registered.length = 0;
    watcherArgs.length = 0;
  });

  it("registers one SvgFileDecorationProvider via window.registerFileDecorationProvider", () => {
    const context = { subscriptions: [] as { dispose(): unknown }[] } as unknown as ExtensionContext;
    activate(context);
    expect(registered).toHaveLength(1);
    expect(registered[0]).toBeInstanceOf(SvgFileDecorationProvider);
  });

  it("puts the registration and the watcher into context.subscriptions", () => {
    const context = { subscriptions: [] as { dispose(): unknown }[] } as unknown as ExtensionContext;
    activate(context);
    expect(context.subscriptions).toContain(registration);
    expect(context.subscriptions.some((d) => d instanceof SvgResourceWatcher)).toBe(true);
  });

  it("watches *.svg in any letter case, with all event kinds enabled", () => {
    activate({ subscriptions: [] } as unknown as ExtensionContext);
    expect(watcherArgs).toEqual([["**/*.[sS][vV][gG]"]]);
  });

  it("deactivate does nothing and does not throw", () => {
    expect(() => deactivate()).not.toThrow();
  });
});
