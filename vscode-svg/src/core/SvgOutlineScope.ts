/**
 * Which documents get the SVG outline (VA14): the `DocumentFilter` content,
 * as plain data so it stays testable without `vscode`.
 *
 * - `language: "xml"` — VSCode's built-in language ID for `.svg`, `.SVG` and
 *   `.Svg` alike (observations.md items 1–3). If another extension maps `.svg`
 *   to a different language (e.g. `svg`), this provider steps aside: that
 *   extension owns the language, and two outlines would only compete.
 * - `pattern` — the file name must end in `.svg` in any letter case (VA3),
 *   with at least one character before it, so a hidden file named just `.svg`
 *   is not an SVG (VA4) while `..svg` and `.foo.svg` are. VSCode globs are
 *   case-sensitive, hence `[sS][vV][gG]`; `?` is exactly one character. The
 *   language alone would also match every plain `.xml` file.
 * - no `scheme`: every scheme qualifies (VA15) — the outline only reads text
 *   VSCode already holds, unlike the badge's `stat` (VA6).
 */
export class SvgOutlineScope {
  static readonly LANGUAGE = "xml";
  static readonly PATTERN = "**/?*.[sS][vV][gG]";

  documentFilter(): { readonly language: string; readonly pattern: string } {
    return { language: SvgOutlineScope.LANGUAGE, pattern: SvgOutlineScope.PATTERN };
  }
}
