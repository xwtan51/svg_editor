/**
 * Integration tests for spec A.2, run inside a real VSCode extension host
 * (`npm run test:integration`, see README "集成测试"). Entry point: `run()`.
 *
 * What they can prove: the provider is registered for the right documents and
 * answers every query from the current text. What they cannot prove: how
 * often the Outline view re-queries while typing — that is the manual
 * checklist in the README.
 */
import * as assert from "node:assert/strict";
import { commands, ConfigurationTarget, extensions, Range, SymbolKind, TabInputCustom, TabInputText, version, window, workspace, WorkspaceEdit } from "vscode";
import type { TextDocument } from "vscode";
import { IntegrationRunner } from "./IntegrationRunner.js";
import { OutlineProbe } from "./OutlineProbe.js";

const EXTENSION_ID = "xwtan51.svg-badge";
const FIGURE_A2 = "svg[g#flow[rect#start, g#nested[text]]]";

export async function run(): Promise<void> {
  const probe = new OutlineProbe();
  const runner = new IntegrationRunner(`SVG outline — VSCode ${version}`);

  // What the extension logs as an unexpected failure (VA22) cannot be caught
  // in here: the extension host redefines console.error and
  // process.stderr.write as accessors whose setters do nothing
  // (ExtHostConsoleForwarder). It does copy every message to VSCode's own
  // output, which the launcher reads: it fails the run on any
  // "[svg-badge] SVG outline failed" line, and requires the self-test line
  // below so that a broken capture cannot pass silently.
  const rejections: unknown[] = [];
  process.on("unhandledRejection", (reason) => rejections.push(reason));

  runner.test("extension log messages reach the launcher (self-test of its log check)", async () => {
    console.error("[svg-badge] log-capture self-test");
  });

  async function open(name: string): Promise<TextDocument> {
    const document = await workspace.openTextDocument(probe.uri(name));
    await window.showTextDocument(document);
    return document;
  }

  async function replaceAll(document: TextDocument, text: string): Promise<void> {
    const edit = new WorkspaceEdit();
    edit.replace(document.uri, new Range(document.positionAt(0), document.positionAt(document.getText().length)), text);
    assert.ok(await workspace.applyEdit(edit), "applyEdit failed");
  }

  async function replaceOnce(document: TextDocument, search: string, replacement: string): Promise<void> {
    const at = document.getText().indexOf(search);
    assert.ok(at >= 0, `"${search}" not found`);
    const edit = new WorkspaceEdit();
    edit.replace(document.uri, new Range(document.positionAt(at), document.positionAt(at + search.length)), replacement);
    assert.ok(await workspace.applyEdit(edit), "applyEdit failed");
  }

  runner.test("runs on the requested VSCode version; reports the extension host's Node", async () => {
    console.log(`      VSCode ${version}, Node ${process.versions.node}, Electron ${process.versions["electron"]}`);
    const expected = process.env["SVG_BADGE_IT_VERSION"];
    if (expected !== undefined) assert.equal(version, expected);
  });

  runner.test("opening example.svg activates the extension; its language ID is xml", async () => {
    console.log(`      active before opening: ${extensions.getExtension(EXTENSION_ID)?.isActive ?? "not found"}`);
    const document = await open("example.svg");
    assert.equal(document.languageId, "xml");
    await IntegrationRunner.waitFor("activation", () => extensions.getExtension(EXTENSION_ID)?.isActive === true, 30_000);
  });

  runner.test("example.svg: the outline of figure A.2, rect#start on line 3", async () => {
    // Registration happens inside activate(); the first query may race it.
    await IntegrationRunner.waitFor("a non-empty outline", async () => (await probe.shape(probe.uri("example.svg"))) !== "(none)");
    const symbols = (await probe.symbols(probe.uri("example.svg")))!;
    assert.equal(OutlineProbe.render(symbols), FIGURE_A2);
    const rect = OutlineProbe.find(symbols, "rect#start");
    assert.equal(rect.range.start.line + 1, 3);
    assert.equal(rect.selectionRange.start.line + 1, 3);
    assert.deepEqual([rect.selectionRange.start.character, rect.selectionRange.end.character], [5, 9]);
    assert.ok(rect.range.contains(rect.selectionRange));
  });

  runner.test("kinds Module / Namespace / Field and empty detail reach VSCode (VA18, VA20)", async () => {
    const symbols = (await probe.symbols(probe.uri("example.svg")))!;
    assert.equal(symbols[0]!.kind, SymbolKind.Module);
    assert.equal(OutlineProbe.find(symbols, "g#flow").kind, SymbolKind.Namespace);
    assert.equal(OutlineProbe.find(symbols, "text").kind, SymbolKind.Field);
    assert.equal(symbols[0]!.detail, "");
  });

  runner.test("LOGO.SVG and Mixed.Svg: language xml, outline present (VA3, VA14)", async () => {
    for (const [name, expected] of [["LOGO.SVG", "svg[circle#dot]"], ["Mixed.Svg", "svg[rect]"]] as const) {
      const document = await workspace.openTextDocument(probe.uri(name));
      assert.equal(document.languageId, "xml", name);
      assert.equal(await probe.shape(document.uri), expected, name);
    }
  });

  runner.test("plain.xml: language xml, but no outline from this extension (VA14)", async () => {
    const document = await workspace.openTextDocument(probe.uri("plain.xml"));
    assert.equal(document.languageId, "xml");
    assert.equal(await probe.shape(document.uri), "(none)");
  });

  runner.test("the hidden file .svg gets no outline (VA4, VA14)", async () => {
    const document = await workspace.openTextDocument(probe.uri(".svg"));
    console.log(`      .svg language ID: ${document.languageId}`);
    assert.match(document.getText(), /<svg/);
    assert.equal(await probe.shape(document.uri), "(none)");
  });

  runner.test("insert an element with WorkspaceEdit: the next query shows it", async () => {
    const document = await open("example.svg");
    const original = document.getText();
    const edit = new WorkspaceEdit();
    edit.insert(document.uri, document.lineAt(4).range.end, '\n      <circle id="added" r="3"/>');
    assert.ok(await workspace.applyEdit(edit));
    const symbols = (await probe.symbols(document.uri))!;
    assert.equal(OutlineProbe.render(symbols), "svg[g#flow[rect#start, g#nested[text, circle#added]]]");
    assert.equal(OutlineProbe.find(symbols, "circle#added").selectionRange.start.line + 1, 6);
    await replaceAll(document, original);
    assert.equal(await probe.shape(document.uri), FIGURE_A2);
  });

  runner.test("incomplete XML: the query does not fail and keeps the part before the error; repaired, the outline is back (VA16)", async () => {
    const document = await open("example.svg");
    const original = document.getText();
    await replaceOnce(document, '<g id="nested">', '<g id="nested>');
    assert.equal(await probe.shape(document.uri), "svg[g#flow[rect#start]]");
    await replaceAll(document, "<svg><g");
    assert.equal(await probe.shape(document.uri), "svg");
    await replaceAll(document, "<");
    assert.equal(await probe.shape(document.uri), "(none)");
    await replaceAll(document, original);
    assert.equal(await probe.shape(document.uri), FIGURE_A2);
  });

  runner.test("samples/broken.svg: the part before the error", async () => {
    assert.equal(await probe.shape(probe.uri("broken.svg")), "svg[g#ok[rect#first]]");
  });

  runner.test("empty, comment-only and garbage documents: an empty outline, no failure (VA22)", async () => {
    const document = await open("example.svg");
    const original = document.getText();
    const garbage = String.fromCharCode(...Array.from({ length: 4096 }, (_, i) => (i * 7919) % 256));
    for (const text of ["", "<!-- only a comment -->", garbage]) {
      await replaceAll(document, text);
      // The provider returns []; the command reports "no symbols" as undefined.
      const symbols = await probe.symbols(document.uri);
      assert.ok(symbols === undefined || symbols.length === 0, OutlineProbe.render(symbols ?? []));
    }
    await replaceAll(document, original);
  });

  runner.test("untitled documents: a new file named *.svg has an outline, an unnamed XML buffer does not (VA15)", async () => {
    const named = await workspace.openTextDocument(probe.uri("new-drawing.svg").with({ scheme: "untitled" }));
    assert.equal(named.languageId, "xml");
    await replaceAll(named, '<svg><rect id="u"/></svg>');
    assert.equal(await probe.shape(named.uri), "svg[rect#u]");
    const unnamed = await workspace.openTextDocument({ language: "xml", content: "<svg><rect/></svg>" });
    assert.equal(unnamed.uri.scheme, "untitled");
    assert.equal(await probe.shape(unnamed.uri), "(none)");
  });

  runner.test("a large document: 50 000 elements", async () => {
    const big = await workspace.openTextDocument(probe.uri("big.svg").with({ scheme: "untitled" }));
    const rows = Array.from({ length: 50_000 }, (_, i) => `  <rect id="r${i}" x="${i}" width="1" height="1"/>`);
    await replaceAll(big, `<svg>\n${rows.join("\n")}\n</svg>\n`);
    const started = Date.now();
    const symbols = (await probe.symbols(big.uri))!;
    console.log(`      ${big.getText().length} characters, ${Date.now() - started} ms for the query`);
    assert.equal(symbols[0]!.children.length, 50_000);
  });

  runner.test("2 000 nesting levels: the outline stops at 256 instead of failing inside VSCode (VA22)", async () => {
    // Without the limit VSCode's own recursive conversion overflows the stack
    // (1.85.0: between 1 000 and 1 250 levels; 1.146.0: 1 500–2 000) and the
    // whole outline is empty.
    const deep = await workspace.openTextDocument(probe.uri("deep.svg").with({ scheme: "untitled" }));
    await replaceAll(deep, "<g>".repeat(2000) + "</g>".repeat(2000));
    let levels = 0;
    for (let level = (await probe.symbols(deep.uri)) ?? []; level.length > 0; level = level[0]!.children) levels += 1;
    assert.equal(levels, 256);
  });

  runner.test("samples/.vscode/settings.json opens example.svg, LOGO.SVG and Mixed.Svg in the text editor", async () => {
    for (const name of ["example.svg", "LOGO.SVG", "Mixed.Svg"]) {
      await commands.executeCommand("vscode.open", probe.uri(name));
      await IntegrationRunner.waitFor(`${name} tab`, () => window.tabGroups.activeTabGroup.activeTab?.label === name);
      const input = window.tabGroups.activeTabGroup.activeTab?.input;
      assert.ok(input instanceof TabInputText, `${name} opened in ${input?.constructor.name}`);
    }
  });

  runner.test("control: without that setting, 1.146.0 opens .svg in the image preview (observations.md item 4), 1.85.0 in the text editor", async () => {
    // 1.85.0's built-in image preview covers *.{jpg,jpe,jpeg,png,bmp,gif,ico,webp,avif};
    // 1.146.0's covers *.{…,avif,svg}. The setting is harmless where it is not needed.
    const expected = new Map([["1.85.0", "text"], ["1.146.0", "imagePreview.previewEditor"]]).get(version);
    const settings = workspace.getConfiguration("workbench");
    const configured = settings.inspect("editorAssociations")?.workspaceValue;
    assert.deepEqual(configured, { "*.svg": "default" });
    await settings.update("editorAssociations", {}, ConfigurationTarget.Workspace);
    try {
      await commands.executeCommand("workbench.action.closeAllEditors");
      for (const name of ["example.svg", "LOGO.SVG", "Mixed.Svg"]) {
        await commands.executeCommand("vscode.open", probe.uri(name));
        await IntegrationRunner.waitFor(`${name} tab`, () => window.tabGroups.activeTabGroup.activeTab?.label === name);
        const input = window.tabGroups.activeTabGroup.activeTab?.input;
        const editor = input instanceof TabInputCustom ? input.viewType : input instanceof TabInputText ? "text" : String(input);
        console.log(`      ${name}: ${editor}`);
        if (expected !== undefined) assert.equal(editor, expected, name);
      }
    } finally {
      await settings.update("editorAssociations", configured, ConfigurationTarget.Workspace);
      await commands.executeCommand("workbench.action.closeAllEditors");
    }
  });

  runner.test("no unhandled promise rejection (VA22; logged failures are checked by the launcher)", async () => {
    assert.deepEqual(rejections, []);
  });

  await runner.run();
}
