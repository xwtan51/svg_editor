import { describe, expect, it } from "vitest";
import type { CommandContext } from "../../src/commands/CommandContext.js";
import { CommandResult } from "../../src/commands/CommandResult.js";
import { EditCommand } from "../../src/commands/EditCommand.js";
import { EditorError } from "../../src/model/EditorError.js";
import type { Shape } from "../../src/model/Shape.js";
import { SvgDocument } from "../../src/model/SvgDocument.js";
import { FakeContainer } from "../doubles/FakeContainer.js";
import { FakeLeaf } from "../doubles/FakeLeaf.js";
import { GuardedContainer } from "../doubles/GuardedContainer.js";

/** A command whose `prepare` only runs the guard on one shape, then removes it in `apply`. */
class Detach extends EditCommand {
  private readonly id: string;
  private target!: Shape;

  constructor(id: string) {
    super();
    this.id = id;
  }

  undo(): CommandResult {
    return CommandResult.of("undone");
  }

  protected prepare(document: SvgDocument): void {
    this.target = this.findShape(document, this.id);
    this.checkReleasable(this.target);
  }

  protected apply(): void {
    this.target.parentContainer()?.remove(this.target);
  }

  protected describe(): string {
    return `${this.target.label()} detached`;
  }
}

function contextFor(document: SvgDocument): CommandContext {
  return { document: () => document } as unknown as CommandContext;
}

describe("EditCommand.checkReleasable (design §3.7)", () => {
  function setup(): SvgDocument {
    const doc = new SvgDocument();
    const guarded = new GuardedContainer("n1", ["n1-part"]);
    doc.insertAt(guarded, 0);
    guarded.insertAt(new FakeLeaf("n1-part"), 0);
    guarded.insertAt(new FakeLeaf("extra"), 1);
    const plain = new FakeContainer("g1");
    doc.insertAt(plain, 1);
    plain.insertAt(new FakeLeaf("free"), 0);
    return doc;
  }

  it("a container that refuses: EditorError with the fixed message, nothing changed", () => {
    const doc = setup();
    const before = doc.allShapes().map((shape) => `${shape.getId()}<${shape.parentId() ?? "svg"}`);
    let error: unknown;
    try {
      new Detach("n1-part").execute(contextFor(doc));
    } catch (e) {
      error = e;
    }
    expect(error).toBeInstanceOf(EditorError);
    expect((error as Error).message).toBe("cannot detach required part of composite shape: n1-part");
    expect(doc.allShapes().map((shape) => `${shape.getId()}<${shape.parentId() ?? "svg"}`)).toEqual(before);
  });

  it("the same container lets other children go", () => {
    const doc = setup();
    expect(new Detach("extra").execute(contextFor(doc)).lines()).toEqual(["fake-leaf#extra detached"]);
    expect(doc.findById("extra")).toBeNull();
  });

  it("the document root and a plain container always let go (the built-in behaviour)", () => {
    const doc = setup();
    expect(() => new Detach("free").execute(contextFor(doc))).not.toThrow();
    expect(() => new Detach("n1").execute(contextFor(doc))).not.toThrow();
    expect(new SvgDocument().canRelease(new FakeLeaf("x"))).toBe(true);
    expect(new FakeContainer("c").canRelease(new FakeLeaf("x"))).toBe(true);
  });
});
