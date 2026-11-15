import type { ElementView } from "../../src/model/ElementView.js";
import { ParamSpec } from "../../src/model/ParamSpec.js";
import type { Shape } from "../../src/model/Shape.js";
import type { ShapeKit } from "../../src/model/ShapeKit.js";
import type { ShapeProvider } from "../../src/model/ShapeProvider.js";
import type { ShapeReader } from "../../src/model/ShapeReader.js";
import { FakeContainer } from "./FakeContainer.js";

/**
 * Test double for a composite type read back like the future `box`
 * (design §2.1.3, §2.1.4, ADR-2): a `<fake-group data-kind="composite">`
 * scores 2; its required part is the child with id `<id>-part`. `read`
 * declares both ids unique (before deciding anything), then degrades with a
 * warning when the part is missing, otherwise reads itself through the reader.
 */
export class FakeCompositeProvider implements ShapeProvider {
  static readonly MARKER = "data-kind";
  static readonly KIND = "composite";

  readonly typeName = FakeCompositeProvider.KIND;
  readonly params: readonly ParamSpec[] = [];

  claimedIds(id: string): readonly string[] {
    return [id, `${id}-part`];
  }

  create(id: string, _values: ReadonlyMap<string, string>, _kit: ShapeKit): Shape {
    return new FakeContainer(id, FakeCompositeProvider.KIND, false);
  }

  creationDetail(_shape: Shape): string {
    return "";
  }

  matchScore(element: ElementView): number {
    const marked = element.attribute(FakeCompositeProvider.MARKER) === FakeCompositeProvider.KIND;
    return element.name() === FakeContainer.typeName && marked ? 2 : 0;
  }

  read(element: ElementView, reader: ShapeReader): Shape | null {
    const id = element.attribute("id");
    if (id !== undefined && id.length > 0) {
      for (const claimed of this.claimedIds(id)) {
        reader.requireUnique(claimed);
      }
    }
    if (id === undefined || !element.children().some((child) => child.attribute("id") === `${id}-part`)) {
      reader.warn(`composite ${id ?? "(no id)"} read as plain ${FakeContainer.typeName}: missing part`);
      return reader.readWithNext(element);
    }
    const shape = new FakeContainer(reader.allocateId(element), FakeCompositeProvider.KIND, false);
    reader.applyAttributes(shape, element, [FakeCompositeProvider.MARKER]);
    reader.readChildren(element).forEach((child, i) => shape.insertAt(child, i));
    return shape;
  }
}
