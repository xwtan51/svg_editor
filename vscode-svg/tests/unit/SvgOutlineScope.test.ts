import { describe, expect, it } from "vitest";
import { SvgBadgeRule } from "../../src/core/SvgBadgeRule.js";
import { SvgOutlineScope } from "../../src/core/SvgOutlineScope.js";

describe("SvgOutlineScope (VA14, VA15)", () => {
  const filter = new SvgOutlineScope().documentFilter();

  it("selects the language VSCode gives .svg/.SVG/.Svg (observations.md items 1–3)", () => {
    expect(filter.language).toBe("xml");
  });

  it("requires a case-insensitive .svg name, as the badge's watcher does (VA3)", () => {
    const extension = new SvgBadgeRule().watchGlob().replace("**/*", "");
    expect(extension).toBe(".[sS][vV][gG]");
    expect(filter.pattern.endsWith(extension)).toBe(true);
  });

  it("requires at least one character before .svg, so the hidden file .svg is excluded (VA4)", () => {
    expect(filter.pattern).toBe("**/?*.[sS][vV][gG]");
  });

  it("has no scheme restriction (VA15)", () => {
    expect(Object.keys(filter).sort()).toEqual(["language", "pattern"]);
  });
});
