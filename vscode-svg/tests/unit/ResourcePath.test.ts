import { posix } from "node:path";
import { describe, expect, it } from "vitest";
import { ResourcePath } from "../../src/core/ResourcePath.js";

describe("ResourcePath", () => {
  it("takes the last segment of a URI path as base name", () => {
    expect(new ResourcePath("/work/samples/example.svg").baseName()).toBe("example.svg");
    expect(new ResourcePath("example.svg").baseName()).toBe("example.svg");
    expect(new ResourcePath("/work/icons.svg/").baseName()).toBe("icons.svg");
  });

  it("extension starts at the last dot", () => {
    expect(new ResourcePath("/a/example.svg").extension()).toBe(".svg");
    expect(new ResourcePath("/a/foo.svg.txt").extension()).toBe(".txt");
    expect(new ResourcePath("/a/foo.SVG").extension()).toBe(".SVG");
  });

  it("a dot in a directory name does not count", () => {
    expect(new ResourcePath("/a.svg/readme").extension()).toBe("");
  });

  it("VA4: a hidden file named .svg has no extension", () => {
    expect(new ResourcePath("/a/.svg").extension()).toBe("");
    expect(new ResourcePath("/a/.svg").hasExtension(".svg")).toBe(false);
  });

  it("VA3: extension comparison ignores letter case", () => {
    expect(new ResourcePath("/a/x.SVG").hasExtension(".svg")).toBe(true);
    expect(new ResourcePath("/a/x.Svg").hasExtension(".svg")).toBe(true);
    expect(new ResourcePath("/a/x.svg").hasExtension(".SVG")).toBe(true);
  });

  it("agrees with Node's path.posix.extname on easily confused names", () => {
    const names = [
      "example.svg", "foo.svg.txt", "svg", ".svg", "..svg", ".foo.svg",
      "a.", "a..svg", "foo.svgz", "foo.svg~", "x.SVG", "README",
    ];
    for (const name of names) {
      expect(new ResourcePath(`/dir/${name}`).extension(), name).toBe(posix.extname(name));
    }
  });
});
