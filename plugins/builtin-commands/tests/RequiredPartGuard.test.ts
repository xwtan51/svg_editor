import { SvgSerializer } from "@svgframe/kernel";
import type { ShapeKit } from "@svgframe/kernel";
import { describe, expect, it } from "vitest";
import { FakeDot } from "./doubles/FakeDot.js";
import { FakeLockedGroup } from "./doubles/FakeLockedGroup.js";
import { FakePairProvider } from "./doubles/FakePairProvider.js";
import { TestEditor } from "./doubles/TestEditor.js";
import type { TestAssembly } from "./doubles/TestEditor.js";

/**
 * The required-part guard in `delete`, `addto` and `group` (design §3.7):
 * `create locked n1 x y` builds a `<g>` echoed as `locked#n1` whose part
 * `n1-a` it refuses to release. A refusal leaves everything unchanged
 * (document, undo / redo depth, io lock); the Phase 1 checks come first.
 */
function lockedProvider(): FakePairProvider {
  return new FakePairProvider(
    {
      create: (id: string, values: ReadonlyMap<string, string>, kit: ShapeKit) => {
        const locked = new FakeLockedGroup(id, "locked", [`${id}-a`]);
        locked.insertAt(kit.build(FakeDot.typeName, `${id}-a`, values), 0);
        return locked;
      },
    },
    "locked",
  );
}

function setup(): TestAssembly {
  const assembly = TestEditor.assemble([lockedProvider()]);
  run(assembly, "init", "create locked n1 1 2", "create g g2", "create dot d1 3 4", "create dot d2 5 6 in n1");
  return assembly;
}

function run(assembly: TestAssembly, ...lines: string[]): string[] {
  return lines.flatMap((line) => assembly.editor.executeLine(line));
}

function state(assembly: TestAssembly): unknown[] {
  const history = assembly.session.history();
  return [
    new SvgSerializer().serialize(assembly.session.document()),
    history.undoDepth(),
    history.redoDepth(),
    history.isLocked(),
  ];
}

describe("required-part guard", () => {
  it("delete of a required part is refused; nothing changes", () => {
    const assembly = setup();
    const before = state(assembly);
    expect(run(assembly, "delete n1-a")).toEqual(["error: cannot detach required part of composite shape: n1-a"]);
    expect(state(assembly)).toEqual(before);
  });

  it("delete of the whole composite, and of a part that is not required, still works", () => {
    const assembly = setup();
    expect(run(assembly, "delete d2")).toEqual(["dot#d2 deleted"]);
    expect(run(assembly, "delete n1")).toEqual(["locked#n1 deleted"]);
  });

  it("addto into another container is refused; nothing changes", () => {
    const assembly = setup();
    const before = state(assembly);
    expect(run(assembly, "addto g2 n1-a")).toEqual(["error: cannot detach required part of composite shape: n1-a"]);
    expect(state(assembly)).toEqual(before);
  });

  it("addto into the same container (to the end) is allowed", () => {
    const assembly = setup();
    expect(run(assembly, "addto n1 n1-a")).toEqual(["dot#n1-a added to locked#n1"]);
    expect(run(assembly, "tree n1")).toEqual(["g#n1", "├── dot#d2    x=5 y=6", "└── dot#n1-a  x=1 y=2"]);
  });

  it("group taking a required part is refused, also as a later argument; nothing changes", () => {
    const assembly = setup();
    const before = state(assembly);
    expect(run(assembly, "group x n1-a")).toEqual(["error: cannot detach required part of composite shape: n1-a"]);
    expect(run(assembly, "group x d1 n1-a")).toEqual(["error: cannot detach required part of composite shape: n1-a"]);
    expect(state(assembly)).toEqual(before);
    expect(run(assembly, "show x")).toEqual(["error: no such shape: x"]);
  });

  it("group of the whole composite works", () => {
    const assembly = setup();
    expect(run(assembly, "group cluster n1 d1")).toEqual(["g#cluster created with 2 children"]);
  });

  it("the Phase 1 checks come first", () => {
    const assembly = setup();
    expect(run(assembly, "delete nope")).toEqual(["error: no such shape: nope"]);
    expect(run(assembly, "addto nope n1-a")).toEqual(["error: no such container: nope"]);
    expect(run(assembly, "addto d1 n1-a")).toEqual(["error: not a container: d1"]);
    expect(run(assembly, "addto g2 nope")).toEqual(["error: no such shape: nope"]);
    expect(run(assembly, "group n1 n1-a")).toEqual(["error: id already exists: n1"]);
    expect(run(assembly, "group x n1-a nope")).toEqual(["error: no such shape: nope"]);
    expect(run(assembly, "group x n1-a n1-a")).toEqual(["error: duplicate id in arguments: n1-a"]);
    expect(run(assembly, "group x n1 n1-a")).toEqual(["error: cannot group a container into its own descendant: n1"]);
  });

  it("commands that keep the part inside are not guarded: front, back, move, set, ungroup of an inner g", () => {
    const assembly = setup();
    run(assembly, "create g inner in n1", "create dot d3 0 0 in inner");
    expect(run(assembly, "front n1-a")).toEqual(["dot#n1-a brought to front"]);
    expect(run(assembly, "back n1-a")).toEqual(["dot#n1-a sent to back"]);
    expect(run(assembly, "move n1-a 1 1")).toEqual(["dot#n1-a moved to (2,3)"]);
    expect(run(assembly, "set n1-a fill red")).toEqual(["dot#n1-a updated: fill=red"]);
    expect(run(assembly, "ungroup inner")).toEqual(["g#inner ungrouped (1 children promoted)"]);
  });
});
