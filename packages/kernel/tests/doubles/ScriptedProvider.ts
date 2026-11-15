import type { ElementView } from "../../src/model/ElementView.js";
import type { ParamSpec } from "../../src/model/ParamSpec.js";
import type { Shape } from "../../src/model/Shape.js";
import type { ShapeKit } from "../../src/model/ShapeKit.js";
import type { ShapeProvider } from "../../src/model/ShapeProvider.js";
import type { ShapeReader } from "../../src/model/ShapeReader.js";

/** Test double: a provider whose `matchScore` and `read` are given as functions (to script breaches). */
export class ScriptedProvider implements ShapeProvider {
  readonly typeName: string;
  readonly params: readonly ParamSpec[] = [];
  private readonly score: (element: ElementView) => unknown;
  private readonly reading: (element: ElementView, reader: ShapeReader) => unknown;

  constructor(
    typeName: string,
    score: (element: ElementView) => unknown,
    read: (element: ElementView, reader: ShapeReader) => unknown = () => null,
  ) {
    this.typeName = typeName;
    this.score = score;
    this.reading = read;
  }

  claimedIds(id: string): readonly string[] {
    return [id];
  }

  create(_id: string, _values: ReadonlyMap<string, string>, _kit: ShapeKit): Shape {
    throw new Error("not used in read-back tests");
  }

  creationDetail(_shape: Shape): string {
    return "";
  }

  matchScore(element: ElementView): number {
    return this.score(element) as number;
  }

  read(element: ElementView, reader: ShapeReader): Shape | null {
    return this.reading(element, reader) as Shape | null;
  }
}
