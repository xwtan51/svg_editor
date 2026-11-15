import type { DocumentListener, DocumentView } from "@svgframe/kernel";
import { SvgSerializer } from "@svgframe/kernel";
import { describe, expect, it } from "vitest";
import { TestEditor } from "./doubles/TestEditor.js";
import type { TestAssembly } from "./doubles/TestEditor.js";

/**
 * `save` calls `markSaved` only after the write succeeded (design §3.4): the
 * default path changes and `documentSaved` is delivered then, with or without
 * a file argument; a failing `save` changes neither and delivers nothing.
 */
class SaveLog implements DocumentListener {
  readonly events: string[] = [];

  documentReplaced(_document: DocumentView, _path: string | null): void {}

  documentSaved(document: DocumentView, path: string): void {
    this.events.push(`saved ${path} (${document.elementCount()})`);
  }

  documentEdited(_document: DocumentView): void {}
}

function setup(): { assembly: TestAssembly; log: SaveLog } {
  const log = new SaveLog();
  const assembly = TestEditor.assemble([], {}, [TestEditor.plugin("save-log", {}, (context) => context.subscribe(log))]);
  assembly.editor.executeLine("init");
  assembly.editor.executeLine("create dot d1 1 2");
  return { assembly, log };
}

describe("save marks the document saved only on success", () => {
  it("save <file>: written, default path set, one documentSaved", () => {
    const { assembly, log } = setup();
    expect(assembly.editor.executeLine("save a.svg")).toEqual(["saved to a.svg (1 elements)"]);
    expect(assembly.files.readText("a.svg")).toBe(new SvgSerializer().serialize(assembly.session.document()));
    expect(assembly.session.filePath()).toBe("a.svg");
    expect(log.events).toEqual(["saved a.svg (1)"]);
  });

  it("save without an argument uses the default path and also marks it saved; save as moves the default", () => {
    const { assembly, log } = setup();
    assembly.editor.executeLine("save a.svg");
    expect(assembly.editor.executeLine("save")).toEqual(["saved to a.svg (1 elements)"]);
    expect(assembly.editor.executeLine("save b.svg")).toEqual(["saved to b.svg (1 elements)"]);
    expect(assembly.session.filePath()).toBe("b.svg");
    expect(log.events).toEqual(["saved a.svg (1)", "saved a.svg (1)", "saved b.svg (1)"]);
  });

  it("a failing write: default path unchanged, no event", () => {
    const { assembly, log } = setup();
    assembly.editor.executeLine("save a.svg");
    expect(assembly.editor.executeLine("save /no/such/dir/x.svg")).toEqual(["error: cannot write file: /no/such/dir/x.svg"]);
    expect(assembly.session.filePath()).toBe("a.svg");
    expect(log.events).toEqual(["saved a.svg (1)"]);
  });

  it("no path after init: error, no event", () => {
    const { assembly, log } = setup();
    expect(assembly.editor.executeLine("save")).toEqual(["error: no file path. use 'save <file.svg>'"]);
    expect(assembly.session.filePath()).toBeNull();
    expect(log.events).toEqual([]);
  });
});
