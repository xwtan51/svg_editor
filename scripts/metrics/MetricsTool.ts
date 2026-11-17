import fs from "node:fs";
import path from "node:path";
import { GitRepository } from "../shared/GitRepository.js";
import { FinalMapping } from "./FinalMapping.js";
import { MetricsReport } from "./MetricsReport.js";
import { SourceSnapshot } from "./SourceSnapshot.js";

/**
 * `npm run metrics -- [<rev>]` (design §5.3, decision X18): measures `<rev>`
 * (default `HEAD`) against the tag `final` and writes
 * `docs/metrics/metrics.md` and `docs/metrics/metrics.json`.
 *
 * 1. Self-check: the built-in copy of `Tokenizer.readQuoted` must have
 *    $M = 8$; otherwise exit 1 and write nothing (the parser API is
 *    `unstable`, so a changed API must not produce wrong numbers silently).
 * 2. `final` and `<rev>` are each unpacked from git with `git archive` and
 *    parsed there; the working tree is never read.
 * 3. The files of `final` are mapped to their paths in `<rev>` (`FinalMapping`).
 *
 * Reproducible: the output depends on the two commits only, so running the
 * script again with the commit recorded in the output leaves `docs/metrics`
 * unchanged.
 */
export class MetricsTool {
  static readonly USAGE = "usage: metrics [<revision>]\n";
  static readonly FINAL_TAG = "final";
  static readonly OUTPUT_DIR = "docs/metrics";

  /** The self-check sample: `readQuoted` as in `packages/kernel/src/commands/Tokenizer.ts`, $M = 8$. */
  static readonly SAMPLE = [
    "export class Tokenizer {",
    "  private readQuoted(line: string, start: number, tokens: Token[]): number {",
    '    let text = "";',
    "    let i = start + 1;",
    "    while (i < line.length) {",
    "      const c = line.charAt(i);",
    "      const next = line.charAt(i + 1);",
    "      if (c === Tokenizer.BACKSLASH && (next === Tokenizer.QUOTE || next === Tokenizer.BACKSLASH)) {",
    "        text += next;",
    "        i += 2;",
    "      } else if (c === Tokenizer.QUOTE) {",
    "        if (i + 1 < line.length && !this.isWhiteSpace(next)) {",
    '          throw new EditorError("unexpected character after closing quote");',
    "        }",
    "        tokens.push(new Token(text, true));",
    "        return i + 1;",
    "      } else {",
    "        text += c;",
    "        i++;",
    "      }",
    "    }",
    '    throw new EditorError("unterminated quote");',
    "  }",
    "}",
    "",
  ].join("\n");
  static readonly SAMPLE_FUNCTION = "readQuoted";
  static readonly SAMPLE_COMPLEXITY = 8;

  private readonly out: NodeJS.WritableStream;
  private readonly git: GitRepository;
  private readonly outputDir: string | null;

  /** `outputDir` defaults to `docs/metrics` at the top of the repository. */
  constructor(out: NodeJS.WritableStream, git: GitRepository = new GitRepository(process.cwd()), outputDir: string | null = null) {
    this.out = out;
    this.git = git;
    this.outputDir = outputDir;
  }

  main(args: readonly string[]): number {
    if (args.length > 1 || args.some((arg) => arg.startsWith("-"))) {
      this.out.write(MetricsTool.USAGE);
      return 2;
    }
    try {
      return this.generate(args[0] ?? "HEAD");
    } catch (error) {
      this.out.write(`metrics: error: ${error instanceof Error ? error.message : String(error)}\n`);
      return 1;
    }
  }

  /** $M$ of the sample's `readQuoted`, measured the way every file is. */
  static selfCheck(): number {
    const snapshot = SourceSnapshot.of({ "Tokenizer.ts": MetricsTool.SAMPLE });
    try {
      const [file] = snapshot.measure();
      return file?.functions.find((f) => f.name === MetricsTool.SAMPLE_FUNCTION)?.complexity() ?? -1;
    } finally {
      snapshot.dispose();
    }
  }

  /** The self-check's measurement; a test double overrides it to prove that a failed check writes nothing. */
  protected sampleComplexity(): number {
    return MetricsTool.selfCheck();
  }

  private generate(rev: string): number {
    const sample = this.sampleComplexity();
    if (sample !== MetricsTool.SAMPLE_COMPLEXITY) {
      this.out.write(`metrics: self-check failed: ${MetricsTool.SAMPLE_FUNCTION} has M = ${sample}, expected ${MetricsTool.SAMPLE_COMPLEXITY}; nothing written\n`);
      return 1;
    }
    const commit = this.git.commit(rev);
    if (commit === null) {
      this.out.write(`metrics: not a commit: ${rev}\n${MetricsTool.USAGE}`);
      return 2;
    }
    const finalCommit = this.git.commit(`refs/tags/${MetricsTool.FINAL_TAG}`);
    if (finalCommit === null) {
      this.out.write(`metrics: no tag ${MetricsTool.FINAL_TAG} (a shallow clone has no tags: fetch them first)\n`);
      return 2;
    }
    const subject = this.git.text(["log", "-1", "--format=%s", commit]).trim();
    const snapshot = SourceSnapshot.extract(this.git, commit, MetricsReport.isMeasured);
    const finalSnapshot = SourceSnapshot.extract(this.git, finalCommit, (file) => file.startsWith("src/"));
    try {
      const measures = snapshot.measure();
      const finalMeasures = finalSnapshot.measure();
      const runFiles = snapshot.paths().filter(MetricsReport.isRunCode);
      const mapping = FinalMapping.build(this.git, finalCommit, commit, finalSnapshot.paths(), runFiles);
      const report = new MetricsReport({ commit, subject }, finalCommit, measures, finalMeasures, mapping);
      const dir = this.outputDir ?? path.join(this.git.text(["rev-parse", "--show-toplevel"]).trim(), MetricsTool.OUTPUT_DIR);
      fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(path.join(dir, MetricsReport.MARKDOWN), report.markdown());
      fs.writeFileSync(path.join(dir, MetricsReport.JSON), report.json());
      this.out.write(`metrics: R ${commit}, final ${finalCommit}: wrote ${MetricsTool.OUTPUT_DIR}/${MetricsReport.MARKDOWN} and ${MetricsTool.OUTPUT_DIR}/${MetricsReport.JSON}\n`);
      return 0;
    } finally {
      snapshot.dispose();
      finalSnapshot.dispose();
    }
  }
}
