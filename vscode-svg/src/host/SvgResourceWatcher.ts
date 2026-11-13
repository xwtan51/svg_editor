import { EventEmitter } from "vscode";
import type { Disposable, Event, FileSystemWatcher, Uri } from "vscode";

/**
 * Turns file-system events for `*.svg` paths into the
 * `onDidChangeFileDecorations` event (VA7).
 *
 * Why: VSCode's `DecorationsService` caches each provider's answer per URI —
 * "no badge" included — and only drops it when the provider fires its change
 * event. A *new* URI is always queried, but when a path changes kind while
 * keeping its name (delete file `x.svg`, then `mkdir x.svg`), the stale answer
 * would stay forever. Re-announcing the URI makes VSCode ask again.
 *
 * All three event kinds are forwarded, including "changed": VSCode's watcher
 * coalesces a DELETE followed by a CREATE of the same path into one CHANGE
 * (`EventCoalescer` in `src/vs/platform/files/common/watcher.ts`), which is
 * exactly the file → directory case. The cost is one extra `stat` per save of an
 * SVG file.
 */
export class SvgResourceWatcher implements Disposable {
  private readonly emitter = new EventEmitter<Uri>();
  private readonly owned: Disposable[];

  /** Takes ownership of `watcher` and disposes it together with itself. */
  constructor(watcher: FileSystemWatcher) {
    this.owned = [
      watcher.onDidCreate((uri) => this.emitter.fire(uri)),
      watcher.onDidChange((uri) => this.emitter.fire(uri)),
      watcher.onDidDelete((uri) => this.emitter.fire(uri)),
      watcher,
      this.emitter,
    ];
  }

  get onDidChange(): Event<Uri> {
    return this.emitter.event;
  }

  dispose(): void {
    for (const disposable of this.owned) {
      disposable.dispose();
    }
  }
}
