import type { Editor } from "@svgframe/kernel/host";

/**
 * What an assembly produced (design §4.1): the editor, and the startup
 * messages — one `error: …` line per optional plugin that failed, in
 * installation order — that the REPL prints after the banner (design §4.5).
 */
export class AssemblyResult {
  private readonly assembled: Editor;
  private readonly messages: readonly string[];

  constructor(editor: Editor, startupMessages: readonly string[]) {
    this.assembled = editor;
    this.messages = [...startupMessages];
  }

  editor(): Editor {
    return this.assembled;
  }

  startupMessages(): readonly string[] {
    return this.messages;
  }
}
