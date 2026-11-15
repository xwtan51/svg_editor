import type { ElementView, ParamSpec, Shape, ShapeKit, ShapeProvider, ShapeReader } from "@svgframe/kernel";
import { FakeDot } from "./FakeDot.js";
import { FakeGroup } from "./FakeGroup.js";

/** Which parts of the contract the provider breaks; every hook defaults to the correct behaviour. */
export interface PairBreaches {
  claimedIds?: (id: string) => readonly string[];
  create?: (id: string, values: ReadonlyMap<string, string>, kit: ShapeKit) => Shape;
  creationDetail?: (shape: Shape) => string;
}

/**
 * Test double for a composite shape provider (like the future `box`):
 * `create pair <id> <x> <y>` builds a `<g>` echoed as `pair#<id>` holding a
 * `dot` part `<id>-a`, built through the kit. Claims both ids; the creation
 * detail lists the parts. `breaches` replaces single methods to break the contract.
 */
export class FakePairProvider implements ShapeProvider {
  readonly typeName = "pair";
  readonly params: readonly ParamSpec[] = FakeDot.params;

  private readonly breaches: PairBreaches;

  constructor(breaches: PairBreaches = {}) {
    this.breaches = breaches;
  }

  claimedIds(id: string): readonly string[] {
    return this.breaches.claimedIds?.(id) ?? [id, `${id}-a`];
  }

  create(id: string, values: ReadonlyMap<string, string>, kit: ShapeKit): Shape {
    if (this.breaches.create !== undefined) {
      return this.breaches.create(id, values, kit);
    }
    const pair = new FakeGroup(id, this.typeName);
    pair.insertAt(kit.build(FakeDot.typeName, `${id}-a`, values), 0);
    return pair;
  }

  creationDetail(shape: Shape): string {
    if (this.breaches.creationDetail !== undefined) {
      return this.breaches.creationDetail(shape);
    }
    const parts = shape.asContainer()?.childList() ?? [];
    return ` (${[shape.treeLabel(), ...parts.map((part) => part.label())].join(" + ")})`;
  }

  matchScore(_element: ElementView): number {
    return 0;
  }

  read(_element: ElementView, _reader: ShapeReader): Shape | null {
    return null;
  }
}
