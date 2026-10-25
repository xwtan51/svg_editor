import { describe, expect, it } from "vitest";
import { EditorSession } from "../../../src/app/EditorSession.js";
import { CommandRegistry } from "../../../src/commands/CommandRegistry.js";
import { History } from "../../../src/commands/History.js";
import { EditorError } from "../../../src/model/EditorError.js";
import { ShapeFactory } from "../../../src/model/ShapeFactory.js";
import { SvgDocument } from "../../../src/model/SvgDocument.js";
import { MemoryFileSystem } from "../io/MemoryFileSystem.js";

describe("EditorSession", () => {
  const files = new MemoryFileSystem();
  const commands = new CommandRegistry();
  const factory = new ShapeFactory();
  const session = () => new EditorSession(files, commands, factory);

  it("starts without a document and without a save path", () => {
    const s = session();
    expect(s.hasDocument()).toBe(false);
    expect(s.filePath()).toBeNull();
  });

  it("asking for the document when there is none is a programming error, not an EditorError", () => {
    const s = session();
    expect(() => s.document()).toThrow("no document in this session");
    expect(() => s.document()).not.toThrow(EditorError);
  });

  it("replaceDocument makes the document current together with its save path (F5)", () => {
    const s = session();
    const first = new SvgDocument();
    s.replaceDocument(first, "a.svg");
    expect(s.hasDocument()).toBe(true);
    expect(s.document()).toBe(first);
    expect(s.filePath()).toBe("a.svg");

    const second = new SvgDocument();
    s.replaceDocument(second, null);
    expect(s.document()).toBe(second);
    expect(s.filePath()).toBeNull();
  });

  it("setFilePath changes only the save path", () => {
    const s = session();
    const doc = new SvgDocument();
    s.replaceDocument(doc, null);
    s.setFilePath("b.svg");
    expect(s.filePath()).toBe("b.svg");
    expect(s.document()).toBe(doc);
  });

  it("hands out the injected collaborators", () => {
    const s = session();
    expect(s.fileSystem()).toBe(files);
    expect(s.registry()).toBe(commands);
    expect(s.shapeFactory()).toBe(factory);
  });

  it("owns one empty history, stable over the session and separate per session", () => {
    const s = session();
    const history = s.history();
    expect(history).toBeInstanceOf(History);
    expect([history.undoDepth(), history.redoDepth(), history.isLocked()]).toEqual([0, 0, false]);
    expect(s.history()).toBe(history);
    expect(session().history()).not.toBe(history);
  });
});
