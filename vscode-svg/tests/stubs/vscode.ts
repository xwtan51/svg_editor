/**
 * Minimal stand-in for the `vscode` module, aliased in vitest.config.mts.
 *
 * It mirrors only what src/host and src/extension.ts touch at run time. It is a
 * test double, not a VSCode emulator: the real host's behaviour (badge
 * validation, decoration caching, file watching, outline refresh) is not
 * reproduced here and is verified by the integration tests and manually (README).
 *
 * One exception: `DocumentSymbol` copies the two checks VSCode's own
 * constructor performs (`validate` in `extHostTypes.ts`, identical in 1.85.0
 * and 1.146.0), so a unit test fails exactly where the real host would throw.
 */
export class FileDecoration {
  badge?: string;
  tooltip?: string;

  constructor(badge?: string, tooltip?: string) {
    this.badge = badge;
    this.tooltip = tooltip;
  }
}

export class Position {
  readonly line: number;
  readonly character: number;

  constructor(line: number, character: number) {
    this.line = line;
    this.character = character;
  }

  isBeforeOrEqual(other: Position): boolean {
    return this.line < other.line || (this.line === other.line && this.character <= other.character);
  }
}

export class Range {
  readonly start: Position;
  readonly end: Position;

  constructor(start: Position, end: Position) {
    this.start = start;
    this.end = end;
  }

  contains(other: Range): boolean {
    return this.start.isBeforeOrEqual(other.start) && other.end.isBeforeOrEqual(this.end);
  }
}

/** Same numeric values as `vscode.SymbolKind`. */
export enum SymbolKind {
  File = 0,
  Module = 1,
  Namespace = 2,
  Field = 7,
  String = 14,
}

export class DocumentSymbol {
  name: string;
  detail: string;
  kind: SymbolKind;
  range: Range;
  selectionRange: Range;
  children: DocumentSymbol[] = [];

  constructor(name: string, detail: string, kind: SymbolKind, range: Range, selectionRange: Range) {
    this.name = name;
    this.detail = detail;
    this.kind = kind;
    this.range = range;
    this.selectionRange = selectionRange;
    if (!name) throw new Error("name must not be falsy");
    if (!range.contains(selectionRange)) throw new Error("selectionRange must be contained in fullRange");
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

export const languages = {
  registerDocumentSymbolProvider(..._args: unknown[]): { dispose(): void } {
    throw new Error("stub: mock languages.registerDocumentSymbolProvider in the test");
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
