import type { DocumentListener } from "../extension/DocumentListener.js";
import type { DocumentView } from "../model/DocumentView.js";

/**
 * The event buffer of one session (design §3.4). The three trigger points
 * (`EditorSession.replaceDocument`, `EditorSession.markSaved`, the history's
 * edit callback) only add an event here; the `Editor` delivers the buffer
 * after a command succeeded and drops it after any failure. Each pending
 * event is kept as the call it makes on a listener, so no event kind is ever
 * named or compared.
 */
export class DocumentEvents {
  private pending: Array<(listener: DocumentListener) => void> = [];

  replaced(document: DocumentView, path: string | null): void {
    this.pending.push((listener) => listener.documentReplaced(document, path));
  }

  saved(document: DocumentView, path: string): void {
    this.pending.push((listener) => listener.documentSaved(document, path));
  }

  edited(document: DocumentView): void {
    this.pending.push((listener) => listener.documentEdited(document));
  }

  /**
   * Delivers the buffered events in the order they arose, each to `listeners`
   * in subscription order. The buffer is taken and emptied first, so a
   * throwing listener (a programming error) leaves nothing to deliver twice.
   */
  flush(listeners: readonly DocumentListener[]): void {
    const events = this.pending;
    this.pending = [];
    for (const event of events) {
      for (const listener of listeners) {
        event(listener);
      }
    }
  }

  /** Drops the buffered events (the command failed). */
  discard(): void {
    this.pending = [];
  }
}
