import { describe, expect, it } from "vitest";
import { Badge } from "../../src/core/Badge.js";
import { ResourceKind } from "../../src/core/ResourceKind.js";
import { ResourcePath } from "../../src/core/ResourcePath.js";
import { SvgBadgeRule } from "../../src/core/SvgBadgeRule.js";

const rule = new SvgBadgeRule();
const file = ResourceKind.file();
const directory = ResourceKind.directory();

function badgeOf(path: string, kind: ResourceKind): Badge | undefined {
  return rule.badgeFor(new ResourcePath(path), kind);
}

describe("SvgBadgeRule", () => {
  it("an ordinary .svg file gets []", () => {
    expect(badgeOf("/w/samples/example.svg", file)).toBe(Badge.SVG);
  });

  it("VA3: upper- and mixed-case extensions count as SVG", () => {
    expect(badgeOf("/w/LOGO.SVG", file)).toBe(Badge.SVG);
    expect(badgeOf("/w/Mixed.Svg", file)).toBe(Badge.SVG);
  });

  it("a directory named *.svg gets nothing", () => {
    expect(badgeOf("/w/icons.svg", directory)).toBeUndefined();
    expect(badgeOf("/w/ICONS.SVG", directory)).toBeUndefined();
  });

  it("VA5: symbolic links — to a file yes, to a directory or dangling no", () => {
    expect(badgeOf("/w/link-to-file.svg", file.throughSymbolicLink())).toBe(Badge.SVG);
    expect(badgeOf("/w/link-to-dir.svg", directory.throughSymbolicLink())).toBeUndefined();
    expect(badgeOf("/w/dangling.svg", ResourceKind.unknown().throughSymbolicLink())).toBeUndefined();
  });

  it("a .svg that is neither file nor directory (socket, device) gets nothing", () => {
    expect(badgeOf("/w/weird.svg", ResourceKind.unknown())).toBeUndefined();
  });

  it("non-SVG files get nothing, including easily confused names", () => {
    for (const path of ["/w/plain.txt", "/w/foo.svg.txt", "/w/svg", "/w/foo.svgz", "/w/foo.svg~", "/w/foo-svg"]) {
      expect(badgeOf(path, file), path).toBeUndefined();
    }
  });

  it("VA4: a hidden file named .svg gets nothing; .foo.svg does", () => {
    expect(badgeOf("/w/.svg", file)).toBeUndefined();
    expect(badgeOf("/w/.SVG", file)).toBeUndefined();
    expect(badgeOf("/w/.foo.svg", file)).toBe(Badge.SVG);
  });

  it("a file inside a *.svg directory is judged by its own name", () => {
    expect(badgeOf("/w/icons.svg/readme.txt", file)).toBeUndefined();
    expect(badgeOf("/w/icons.svg/inner.svg", file)).toBe(Badge.SVG);
  });

  it("matchesName is the name half of the rule", () => {
    expect(rule.matchesName(new ResourcePath("/w/a.SVG"))).toBe(true);
    expect(rule.matchesName(new ResourcePath("/w/a.txt"))).toBe(false);
    expect(rule.matchesName(new ResourcePath("/w/.svg"))).toBe(false);
  });

  it("watchGlob covers every letter case of the extension", () => {
    expect(rule.watchGlob()).toBe("**/*.[sS][vV][gG]");
  });
});
