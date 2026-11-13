/**
 * Minimal stand-in for the `vscode` module, aliased in vitest.config.mts.
 *
 * It mirrors only what src/host and src/extension.ts touch at run time. It is a
 * test double, not a VSCode emulator: the real host's behaviour (badge
 * validation, decoration caching, file watching) is not reproduced here and is
 * verified manually with F5 (README) and, from S2 on, by integration tests.
 */
export class FileDecoration {
  badge?: string;
  tooltip?: string;

  constructor(badge?: string, tooltip?: string) {
    this.badge = badge;
    this.tooltip = tooltip;
  }
}

type Listener<T> = (value: T) => unknown;

export class EventEmitter<T> {
  private listeners: Listener<T>[] = [];
  private disposed = false;

  readonly event = (listener: Listener<T>): { dispose(): void } => {
    this.listeners.push(listener);
    return { dispose: () => (this.listeners = this.listeners.filter((l) => l !== listener)) };
  };

  fire(value: T): void {
    for (const listener of this.listeners) listener(value);
  }

  dispose(): void {
    this.disposed = true;
    this.listeners = [];
  }

  isDisposed(): boolean {
    return this.disposed;
  }
}

export const window = {
  registerFileDecorationProvider(_provider: unknown): { dispose(): void } {
    throw new Error("stub: mock window.registerFileDecorationProvider in the test");
  },
};

export const workspace = {
  fs: {
    stat(_uri: unknown): Promise<{ type: number }> {
      throw new Error("stub: mock workspace.fs.stat in the test");
    },
  },
  createFileSystemWatcher(..._args: unknown[]): unknown {
    throw new Error("stub: mock workspace.createFileSystemWatcher in the test");
  },
};
