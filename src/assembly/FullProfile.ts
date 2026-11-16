import { LoadedCandidate } from "../loader/LoadedCandidate.js";
import type { LoadedPlugin } from "../loader/LoadedPlugin.js";
import { AssemblyProfile } from "./AssemblyProfile.js";
import type { CompositionRoot } from "./CompositionRoot.js";

/** No argument: way A, every optional plugin of the composition root in its order (design §4.3). */
export class FullProfile extends AssemblyProfile {
  override async optionalPlugins(root: CompositionRoot): Promise<readonly LoadedPlugin[]> {
    return root.optional().map((candidate) => new LoadedCandidate(candidate));
  }
}
