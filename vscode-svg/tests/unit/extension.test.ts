import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ExtensionContext } from "vscode";
import { EventEmitter } from "../stubs/vscode.js";

const registered: unknown[] = [];
const watcherArgs: unknown[][] = [];
const registration = { dispose: vi.fn() };
const symbolRegistrations: unknown[][] = [];
const symbolRegistration = { dispose: vi.fn() };

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
    languages: {
      registerDocumentSymbolProvider: (...args: unknown[]) => {
        symbolRegistrations.push(args);
        return symbolRegistration;
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
const { SvgDocumentSymbolProvider } = await import("../../src/host/SvgDocumentSymbolProvider.js");

describe("extension entry", () => {
  beforeEach(() => {
    registered.length = 0;
    watcherArgs.length = 0;
    symbolRegistrations.length = 0;
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

  it("registers one SvgDocumentSymbolProvider for XML documents named *.svg in any case (VA14)", () => {
    const context = { subscriptions: [] as { dispose(): unknown }[] } as unknown as ExtensionContext;
    activate(context);
    expect(symbolRegistrations).toHaveLength(1);
    const [selector, provider, metadata] = symbolRegistrations[0]!;
    expect(selector).toEqual({ language: "xml", pattern: "**/?*.[sS][vV][gG]" });
    expect(provider).toBeInstanceOf(SvgDocumentSymbolProvider);
    expect(metadata).toEqual({ label: "SVG" });
    expect(context.subscriptions).toContain(symbolRegistration);
  });

  it("deactivate does nothing and does not throw", () => {
    expect(() => deactivate()).not.toThrow();
  });
});
