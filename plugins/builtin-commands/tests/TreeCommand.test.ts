import type { TreeDecorator, TreeRowView } from "@svgframe/kernel";
import { describe, expect, it } from "vitest";
import { TestEditor } from "./doubles/TestEditor.js";
import type { TestAssembly } from "./doubles/TestEditor.js";

/**
 * `tree` renders with the tree decorators of its own editor, read from the
 * command context on every run (design §2.3, appendix A row 39): no renderer
 * is shared between editors.
 */
class MarkDots implements TreeDecorator {
  readonly name = "mark-dots";

  tagFor(row: TreeRowView): string | null {
    if (row.isDocumentRoot()) {
      return "[root]";
    }
    return row.shape()?.tagName() === "dot" ? "[dot]" : null;
  }
}

function setup(decorators: readonly TreeDecorator[]): TestAssembly {
  const plugin = TestEditor.plugin("decorators", { decorators: decorators.map((d) => d.name) }, (context) =>
    decorators.forEach((decorator) => context.registerTreeDecorator(decorator)),
  );
  const assembly = TestEditor.assemble([], {}, [plugin]);
  ["init", "create g g1", "create dot d1 1 2 in g1"].forEach((line) => assembly.editor.executeLine(line));
  return assembly;
}

describe("tree uses the decorators in the context", () => {
  it("tree and tree <id> carry the tags of the editor's decorators", () => {
    const { editor } = setup([new MarkDots()]);
    expect(editor.executeLine("tree")).toEqual(["svg (800x600) [root]", "└── g#g1", "    └── dot#d1  x=1 y=2 [dot]"]);
    expect(editor.executeLine("tree g1")).toEqual(["g#g1", "└── dot#d1  x=1 y=2 [dot]"]);
  });

  it("another editor in the same process without decorators prints the plain tree", () => {
    setup([new MarkDots()]).editor.executeLine("tree");
    const plain = setup([]);
    expect(plain.editor.executeLine("tree")).toEqual(["svg (800x600)", "└── g#g1", "    └── dot#d1  x=1 y=2"]);
  });

  it("a breaching decorator: one error line, nothing else printed, document unchanged", () => {
    const broken: TreeDecorator = {
      name: "broken",
      tagFor: () => {
        throw new Error("no tag today");
      },
    };
    const { editor } = setup([broken]);
    expect(editor.executeLine("tree")).toEqual(["error: tree decorator failed: broken (no tag today)"]);
    expect(editor.executeLine("show d1")).toEqual(["dot#d1  parent=g#g1", "  x=1 y=2"]);
  });
});
