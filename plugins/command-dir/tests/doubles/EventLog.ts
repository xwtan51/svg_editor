import type { DocumentListener, DocumentView } from "@svgframe/kernel";

/** Test double: a document listener that writes down every event it receives, in order (design §3.4). */
export class EventLog implements DocumentListener {
  private readonly received: string[] = [];

  documentReplaced(_document: DocumentView, path: string | null): void {
    this.received.push(`replaced ${String(path)}`);
  }

  documentSaved(_document: DocumentView, path: string): void {
    this.received.push(`saved ${path}`);
  }

  documentEdited(_document: DocumentView): void {
    this.received.push("edited");
  }

  events(): string[] {
    return [...this.received];
  }
}
