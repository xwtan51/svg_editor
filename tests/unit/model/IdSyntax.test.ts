import { describe, expect, it } from "vitest";
import { EditorError } from "../../../src/model/EditorError.js";
import { IdSyntax } from "../../../src/model/IdSyntax.js";

describe("IdSyntax (F16)", () => {
  it.each(["r1", "_x", "start-label", "a.b:c", "Z9_", "svg"])("accepts %s", (id) => {
    expect(IdSyntax.isValid(id)).toBe(true);
    expect(() => IdSyntax.validate(id)).not.toThrow();
  });

  it.each(["", "1r", "-a", ".a", "a b", "a#b", "开始", "a/b"])("rejects %j", (id) => {
    expect(IdSyntax.isValid(id)).toBe(false);
    expect(() => IdSyntax.validate(id)).toThrow(EditorError);
    expect(() => IdSyntax.validate(id)).toThrow(`invalid id: ${id}`);
  });
});
