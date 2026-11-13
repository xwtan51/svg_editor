import { OutlineTreeBuilder } from "./OutlineTreeBuilder.js";
import type { SvgOutline } from "./SvgOutline.js";
import { XmlSyntaxError } from "./XmlSyntaxError.js";
import { XmlTokenizer } from "./XmlTokenizer.js";

/**
 * Spec A.2's pure logic: text → outline tree with source spans (VA13).
 *
 * Every call parses the given text from scratch, so a new version of a
 * document always yields a new tree ("edit → outline updates" for the pure
 * part). A syntax error is not thrown: the result holds the nodes before it and
 * the error itself (VA16). Any other exception would be a bug.
 */
export class SvgOutlineParser {
  parse(text: string): SvgOutline {
    const tokens = new XmlTokenizer(text);
    const builder = new OutlineTreeBuilder();
    try {
      for (let token = tokens.next(); token !== undefined; token = tokens.next()) {
        token.applyTo(builder);
      }
      return builder.finish(text.length);
    } catch (error) {
      if (error instanceof XmlSyntaxError) {
        return builder.abort(error);
      }
      throw error;
    }
  }
}
