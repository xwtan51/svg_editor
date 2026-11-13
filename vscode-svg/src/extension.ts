/**
 * Extension entry point, loaded by VSCode after `onStartupFinished` (VA1).
 *
 * Exception to the "one class per file, file name = class name" rule, like
 * Phase 1's `cli/main.ts`: VSCode's extension contract requires a module that
 * exports the functions `activate` and `deactivate`. It holds no logic — it only
 * builds the objects and registers them; everything it registers goes into
 * `context.subscriptions`, so VSCode disposes it on deactivation.
 */
import { window, workspace } from "vscode";
import type { ExtensionContext } from "vscode";
import { SchemeFilter } from "./core/SchemeFilter.js";
import { SvgBadgeRule } from "./core/SvgBadgeRule.js";
import { SvgFileDecorationProvider } from "./host/SvgFileDecorationProvider.js";
import { SvgResourceWatcher } from "./host/SvgResourceWatcher.js";
import { VscodeResourceKindReader } from "./host/VscodeResourceKindReader.js";

export function activate(context: ExtensionContext): void {
  const rule = new SvgBadgeRule();
  const watcher = new SvgResourceWatcher(workspace.createFileSystemWatcher(rule.watchGlob()));
  const provider = new SvgFileDecorationProvider(
    rule,
    new VscodeResourceKindReader(workspace.fs),
    SchemeFilter.DEFAULT,
    watcher.onDidChange,
  );
  context.subscriptions.push(watcher, window.registerFileDecorationProvider(provider));
}

export function deactivate(): void {
  // Nothing to do: every resource is in context.subscriptions.
}
