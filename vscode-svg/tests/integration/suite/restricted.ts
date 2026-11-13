/**
 * Restricted Mode check (VA12), run by `npm run test:restricted`.
 *
 * The launcher installs a packaged `.vsix` into an empty `--extensions-dir`
 * and opens a folder that a fresh `--user-data-dir` has never trusted, without
 * `--disable-workspace-trust`. This code runs in the host of a throw-away
 * development extension (development extensions are exempt from the trust
 * rule; the installed one is not). `SVG_BADGE_RESTRICTED_EXPECT` says which
 * package was installed:
 *
 * - `active`: the real package, which declares `untrustedWorkspaces` support —
 *   the extension must activate and provide the outline;
 * - `disabled`: a control package without the declaration — the extension must
 *   stay inactive. This proves the window really is in Restricted Mode and
 *   that the check can tell the two apart.
 */
import * as assert from "node:assert/strict";
import { extensions, version, window, workspace } from "vscode";
import { IntegrationRunner } from "./IntegrationRunner.js";
import { OutlineProbe } from "./OutlineProbe.js";

const EXTENSION_ID = "xwtan51.svg-badge";

export async function run(): Promise<void> {
  const expect = process.env["SVG_BADGE_RESTRICTED_EXPECT"];
  assert.ok(expect === "active" || expect === "disabled", `SVG_BADGE_RESTRICTED_EXPECT=${expect}`);
  const probe = new OutlineProbe();
  const runner = new IntegrationRunner(`Restricted Mode, ${expect === "active" ? "real package" : "control package without capabilities"} — VSCode ${version}`);

  runner.test("the workspace is not trusted (Restricted Mode)", async () => {
    assert.equal(workspace.isTrusted, false);
  });

  runner.test("the extension is installed from the .vsix, not loaded for development", async () => {
    const installed = extensions.all.map((e) => e.id).filter((id) => !id.startsWith("vscode."));
    console.log(`      non-built-in extensions visible: ${JSON.stringify(installed)}`);
    if (expect === "active") {
      const extension = extensions.getExtension(EXTENSION_ID);
      assert.ok(extension, "extension not found");
      assert.ok(!extension.extensionPath.startsWith(process.env["SVG_BADGE_PROJECT"] ?? "\0"), extension.extensionPath);
      console.log(`      loaded from ${extension.extensionPath}`);
    }
  });

  if (expect === "active") {
    runner.test("opening example.svg: the extension activates and provides the outline", async () => {
      await window.showTextDocument(await workspace.openTextDocument(probe.uri("example.svg")));
      await IntegrationRunner.waitFor("activation", () => extensions.getExtension(EXTENSION_ID)?.isActive === true, 30_000);
      await IntegrationRunner.waitFor("the outline", async () => (await probe.shape(probe.uri("example.svg"))) !== "(none)");
      assert.equal(await probe.shape(probe.uri("example.svg")), "svg[g#flow[rect#start, g#nested[text]]]");
    });
  } else {
    runner.test("opening example.svg: the extension stays inactive and there is no outline", async () => {
      await window.showTextDocument(await workspace.openTextDocument(probe.uri("example.svg")));
      await new Promise((resolve) => setTimeout(resolve, 5000));
      assert.notEqual(extensions.getExtension(EXTENSION_ID)?.isActive, true);
      assert.equal(await probe.shape(probe.uri("example.svg")), "(none)");
    });
  }

  await runner.run();
}
