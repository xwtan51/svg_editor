import { describe, expect, it } from "vitest";
import { EditorError } from "../../../src/model/EditorError.js";
import { NumberFormat } from "../../../src/model/NumberFormat.js";

describe("NumberFormat.parse (R8)", () => {
  it.each([
    ["-1.5", -1.5],
    [".5", 0.5],
    ["1e3", 1000],
    ["0", 0],
    ["42", 42],
    ["+7", 7],
    ["3.", 3],
    ["-0.25", -0.25],
    ["2.5E-2", 0.025],
    ["1e+2", 100],
  ])("accepts %s", (token, expected) => {
    expect(NumberFormat.parse(token)).toBe(expected);
  });

  it.each(["0x10", "Infinity", "-Infinity", "NaN", "", " ", " 1", "1 ", "abc", "1e", "e3", ".", "-", "1.2.3", "1e400", "0b1", "1_000"])(
    "rejects %j with 'invalid number: <token>'",
    (token) => {
      expect(() => NumberFormat.parse(token)).toThrow(EditorError);
      expect(() => NumberFormat.parse(token)).toThrow(`invalid number: ${token}`);
    },
  );
});

describe("NumberFormat.format (V3)", () => {
  it.each([
    [110.00000000000001, "110"],
    [-0, "0"],
    [1 / 3, "0.333333"],
    [0.1 + 0.2, "0.3"],
    [130, "130"],
    [-2.5, "-2.5"],
    [0.5, "0.5"],
    [-0.0000001, "0"],
    [1234567.125, "1234567.125"],
    [2 / 3, "0.666667"],
  ])("formats %d as %s", (value, expected) => {
    expect(NumberFormat.format(value)).toBe(expected);
  });
});
