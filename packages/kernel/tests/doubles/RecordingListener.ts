import type { DocumentListener } from "../../src/extension/DocumentListener.js";
import type { DocumentView } from "../../src/model/DocumentView.js";

/**
 * Test double: writes every event it receives to a shared log as
 * `<tag>:replaced(<path>)`, `<tag>:saved(<path>)` or `<tag>:edited`, after
 * running the optional `probe` (to observe the editor at delivery time, or to throw).
 */
export class RecordingListener implements DocumentListener {
  private readonly tag: string;
  private readonly log: string[];
  private readonly probe: (event: string, document: DocumentView) => void;

  constructor(tag: string, log: string[], probe: (event: string, document: DocumentView) => void = () => undefined) {
    this.tag = tag;
    this.log = log;
    this.probe = probe;
  }

  documentReplaced(document: DocumentView, path: string | null): void {
    this.record(`replaced(${path ?? "null"})`, document);
  }

  documentSaved(document: DocumentView, path: string): void {
    this.record(`saved(${path})`, document);
  }

  documentEdited(document: DocumentView): void {
    this.record("edited", document);
  }

  private record(event: string, document: DocumentView): void {
    this.probe(event, document);
    this.log.push(`${this.tag}:${event}`);
  }
}
