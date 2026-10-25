import { expect } from "vitest";
import { CommandParser } from "../../../src/commands/CommandParser.js";
import type { CommandResult } from "../../../src/commands/CommandResult.js";
import { SvgSerializer } from "../../../src/io/SvgSerializer.js";
import { EditorError } from "../../../src/model/EditorError.js";
import type { Shape } from "../../../src/model/Shape.js";
import { SvgDocument } from "../../../src/model/SvgDocument.js";
import { TestContext } from "./TestContext.js";

/**
 * Test-only stand-in for the `Editor` Invoker (which does not exist yet):
 * resolve → parse → execute → recordIn, with `EditorError` turned into an
 * `error: …` line. Also offers the round-trip and failure-atomicity checks
 * shared by the edit command tests.
 */
export class CommandRunner {
  readonly context: TestContext;
  private readonly parser: CommandParser;
  private readonly serializer = new SvgSerializer();

  constructor(document: SvgDocument = new SvgDocument()) {
    this.context = new TestContext(document);
    this.parser = new CommandParser(this.context.registry());
  }

  /** A runner whose document was built by these lines (each must succeed). */
  static with(...lines: string[]): CommandRunner {
    const runner = new CommandRunner();
    for (const line of lines) {
      const output = runner.run(line);
      if (output.some((l) => l.startsWith("error:"))) {
        throw new Error(`setup line failed: ${line} → ${output.join(" / ")}`);
      }
    }
    return runner;
  }

  /** The §6 document after `group markers c1 box`. */
  static spec6(): CommandRunner {
    return CommandRunner.with(
      "create rect bg 0 0 800 600 #ffffff",
      'create text title 20 40 "My Diagram"',
      "create circle c1 100 100 20 red",
      "create rect box 200 80 60 60 #3366ff",
      "group markers c1 box",
    );
  }

  run(line: string): string[] {
    return this.guard(() => {
      const command = this.parser.resolve(line).parse();
      const result = command.execute(this.context);
      command.recordIn(this.context.history());
      return result;
    });
  }

  undo(): string[] {
    return this.guard(() => this.context.history().undo());
  }

  redo(): string[] {
    return this.guard(() => this.context.history().redo());
  }

  document(): SvgDocument {
    return this.context.document();
  }

  svg(): string {
    return this.serializer.serialize(this.document());
  }

  shape(id: string): Shape {
    const shape = this.document().findById(id);
    if (shape === null) {
      throw new Error(`no shape ${id}`);
    }
    return shape;
  }

  /** Every shape as `id@parent[index]`, in document order. */
  structure(): string[] {
    return this.document()
      .allShapes()
      .map((shape) => {
        const parent = shape.parentContainer();
        return `${shape.getId()}@${parent?.containerLabel()}[${parent?.indexOf(shape)}]`;
      });
  }

  /** Ids of the direct children of the root, or of the container `id`. */
  childIds(id?: string): string[] {
    const container = id === undefined ? this.document() : this.shape(id).asContainer();
    return (container?.childList() ?? []).map((shape) => shape.getId());
  }

  /**
   * Runs `line` (expecting `echo`), undoes it (expecting `undoEcho`) and checks
   * that the document — serialization, positions and object identities — is
   * exactly as before; redoes it and checks output and document equal the
   * first run. Leaves the command applied.
   */
  expectRoundTrip(line: string, echo: string[], undoEcho: string[]): void {
    const before = this.snapshot();
    const undoDepth = this.context.history().undoDepth();
    expect(this.run(line)).toEqual(echo);
    expect(this.context.history().undoDepth()).toBe(undoDepth + 1);
    const after = this.snapshot();

    expect(this.undo()).toEqual(undoEcho);
    this.expectSnapshot(before);

    expect(this.redo()).toEqual(echo);
    this.expectSnapshot(after);
  }

  /** `line` prints exactly `error: <message>` and changes neither the document nor the history. */
  expectRejected(line: string, message: string): void {
    const before = this.snapshot();
    const history = this.context.history();
    const depths = [history.undoDepth(), history.redoDepth(), history.isLocked()];
    expect(this.run(line)).toEqual([`error: ${message}`]);
    this.expectSnapshot(before);
    expect([history.undoDepth(), history.redoDepth(), history.isLocked()]).toEqual(depths);
  }

  private snapshot(): { svg: string; structure: string[]; shapes: Shape[] } {
    return { svg: this.svg(), structure: this.structure(), shapes: this.document().allShapes() };
  }

  private expectSnapshot(expected: { svg: string; structure: string[]; shapes: Shape[] }): void {
    expect(this.svg()).toBe(expected.svg);
    expect(this.structure()).toEqual(expected.structure);
    const shapes = this.document().allShapes();
    expect(shapes).toHaveLength(expected.shapes.length);
    shapes.forEach((shape, i) => expect(shape).toBe(expected.shapes[i]));
  }

  private guard(action: () => CommandResult): string[] {
    try {
      return action().lines();
    } catch (error) {
      if (error instanceof EditorError) {
        return [`error: ${error.message}`];
      }
      throw error;
    }
  }
}
