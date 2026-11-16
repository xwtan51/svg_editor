import type { LoadedPlugin } from "../loader/LoadedPlugin.js";
import { AssemblyProfile } from "./AssemblyProfile.js";

/** `--bare`: the built-in shapes and commands only, the Phase 1 editor (design §4.3, N14). */
export class BareProfile extends AssemblyProfile {
  override async optionalPlugins(): Promise<readonly LoadedPlugin[]> {
    return [];
  }
}
