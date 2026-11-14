import { ContainerShape } from "../../../packages/kernel/src/model/ContainerShape.js";
import { ParamSpec } from "../../../packages/kernel/src/model/ParamSpec.js";

/**
 * The `<g>` container. All Composite behaviour (children, forwarding of move
 * and scale, snapshots) is inherited from `ContainerShape`; this class only
 * adds the static side of `ShapeType` and its SVG element name.
 */
export class Group extends ContainerShape {
  static readonly typeName: string = "g";
  static readonly params: readonly ParamSpec[] = [];

  /** Static side of `ShapeType`; values are keyed by attribute name. */
  static create(id: string, values: ReadonlyMap<string, string>): Group {
    return ParamSpec.apply(new Group(id), Group.params, values);
  }

  constructor(id: string) {
    super(id);
  }

  tagName(): string {
    return Group.typeName;
  }
}
