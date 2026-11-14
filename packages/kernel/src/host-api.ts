/**
 * Host entry of the kernel, `@svgframe/kernel/host` (design §3.10, P5a): what
 * only the assembly side (src/) needs to install plugins and build an editor.
 * Plugins must not import it (rule L2). Re-exports only, one name per
 * statement, each named like its source file.
 */
export { Editor } from "./app/Editor.js";
export { EditorSession } from "./app/EditorSession.js";
export { ExtensionRegistry } from "./extension/ExtensionRegistry.js";
export { PluginInstaller } from "./extension/PluginInstaller.js";
export { PluginCandidate } from "./extension/PluginCandidate.js";
export { PluginManifest } from "./extension/PluginManifest.js";
export { InstallOutcome } from "./extension/InstallOutcome.js";
