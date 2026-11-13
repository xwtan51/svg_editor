import { describe, expect, it } from "vitest";
import { Badge } from "../../src/core/Badge.js";

describe("Badge", () => {
  it("the SVG badge is exactly [] with a tooltip", () => {
    expect(Badge.SVG.text()).toBe("[]");
    expect(Badge.SVG.tooltip()).toBe("SVG file");
  });

  // Guard against "[svg]" and the like: VSCode's FileDecoration.validate throws
  // for badges longer than 2 characters, which would break every decoration.
  it("the SVG badge stays within VSCode's 2-character limit", () => {
    expect(Badge.MAX_LENGTH).toBe(2);
    expect(Array.from(Badge.SVG.text()).length).toBeGreaterThanOrEqual(1);
    expect(Array.from(Badge.SVG.text()).length).toBeLessThanOrEqual(2);
    expect(Badge.SVG.text().length).toBeLessThanOrEqual(2); // UTF-16 units too
  });

  it("accepts 1 and 2 characters", () => {
    expect(new Badge("S", "t").text()).toBe("S");
    expect(new Badge("[]", "t").text()).toBe("[]");
  });

  it("rejects an empty badge and anything longer than 2 characters", () => {
    expect(() => new Badge("", "t")).toThrow(/1-2 characters, got 0/);
    expect(() => new Badge("[s]", "t")).toThrow(/got 3/);
    expect(() => new Badge("[svg]", "t")).toThrow(/got 5/);
  });

  it("counts code points, so one astral character is one character", () => {
    expect(new Badge("🖼", "t").text()).toBe("🖼");
    expect(() => new Badge("🖼🖼🖼", "t")).toThrow(/got 3/);
  });
});
