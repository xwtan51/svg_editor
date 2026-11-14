import { StaticShapeProvider } from "@svgframe/kernel";
import type { ElementView, ShapeProvider } from "@svgframe/kernel";
import type { Editor } from "@svgframe/kernel/host";
import { describe, expect, it } from "vitest";
import { FakeDot } from "./doubles/FakeDot.js";
import { TestEditor } from "./doubles/TestEditor.js";

/**
 * `read` through the shape catalog (design §2.1.3, §3.8): a read that the
 * read-back rules reject leaves the document, the default path and the history
 * exactly as they were and prints no warning (F20). Test shapes only.
 */

/** A second provider claiming `<dot>` with the same score as the dot type: every `<dot>` is ambiguous. */
class DotTwin extends StaticShapeProvider {
  override get typeName(): string {
    return "dot-twin";
  }

  override matchScore(element: ElementView): number {
    return element.name() === FakeDot.typeName ? 1 : 0;
  }
}

const FILES = {
  "good.svg": '<svg width="10" height="10"><dot id="d1" x="1" y="2"/><circle id="c"/></svg>',
  "tie.svg": '<svg width="10" height="10"><dot id="d9"/></svg>',
};

function editor(extra: ShapeProvider[] = []): Editor {
  return TestEditor.create(extra, FILES);
}

describe("read with providers", () => {
  it("reads what the catalog supports and skips the rest with a warning", () => {
    expect(editor().executeLine("read good.svg")).toEqual(["warning: skipped unsupported element <circle>", "read good.svg (1 elements)"]);
  });

  it("an ambiguous element rejects the read; document, path and history are unchanged", () => {
    const e = editor([new DotTwin(FakeDot)]);
    e.executeLine("init");
    e.executeLine("create dot d0 5 5");
    const tree = e.executeLine("tree");
    expect(e.executeLine("read tie.svg")).toEqual(["error: cannot parse file: tie.svg (ambiguous shape providers for dot: dot, dot-twin)"]);
    expect(e.executeLine("tree")).toEqual(tree);
    expect(e.executeLine("save")).toEqual(["error: no file path. use 'save <file.svg>'"]);
    expect(e.executeLine("undo")).toEqual(["dot#d0 removed"]);
  });
});
