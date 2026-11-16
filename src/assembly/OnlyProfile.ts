import { EditorError } from "@svgframe/kernel";
import { LoadedCandidate } from "../loader/LoadedCandidate.js";
import type { LoadedPlugin } from "../loader/LoadedPlugin.js";
import { AssemblyProfile } from "./AssemblyProfile.js";
import type { CompositionRoot } from "./CompositionRoot.js";

/**
 * `--only <package>…`: part of way A — the composition root's optional plugins
 * whose package name (the candidate's label) was given, still in the order of
 * `optional()` (design §4.3). A name that is not there refuses the start.
 */
export class OnlyProfile extends AssemblyProfile {
  private readonly names: readonly string[];

  constructor(names: readonly string[]) {
    super();
    this.names = [...names];
  }

  override async optionalPlugins(root: CompositionRoot): Promise<readonly LoadedPlugin[]> {
    const optional = root.optional();
    const known = optional.map((candidate) => candidate.label());
    const unknown = this.names.find((name) => !known.includes(name));
    if (unknown !== undefined) {
      throw new EditorError(`--only: no such plugin in the code assembly: ${unknown}`);
    }
    return optional.filter((candidate) => this.names.includes(candidate.label())).map((candidate) => new LoadedCandidate(candidate));
  }
}
