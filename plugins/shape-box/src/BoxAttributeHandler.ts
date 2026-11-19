import type { AttributeChange, AttributeHandler, AttributeTarget, ShapeView } from "@svgframe/kernel";
import { BoxFillChange } from "./BoxFillChange.js";
import { BoxLabelChange } from "./BoxLabelChange.js";
import { BoxShape } from "./BoxShape.js";

/**
 * The `AttributeHandler` of box (design §2.4.2, §8.3): `set <box> fill` goes to
 * the frame rect, `set <box> label` rewrites the title text. It works only
 * through `AttributeTarget`, so the kernel's `set` transaction makes each one
 * undo unit and rolls back a rejected value (design §2.4.3).
 */
export class BoxAttributeHandler implements AttributeHandler {
  private static readonly FILL = "fill";
  private static readonly LABEL = "label";
  private static readonly TEXT = "text";

  readonly name = "box-attributes";
  readonly priority = 0;

  handles(target: ShapeView, attribute: string): boolean {
    return target.kindName() === BoxShape.KIND
      && (attribute === BoxAttributeHandler.FILL || attribute === BoxAttributeHandler.LABEL);
  }

  apply(target: AttributeTarget, attribute: string, value: string): AttributeChange {
    const id = target.view().getId();
    const label = target.view().label();
    if (attribute === BoxAttributeHandler.FILL) {
      const frameId = `${id}-rect`;
      target.part(frameId).setAttribute(BoxAttributeHandler.FILL, value);
      return new BoxFillChange(label, frameId);
    }
    const text = target.part(`${id}-label`);
    const old = text.view().textContent() ?? "";
    text.setAttribute(BoxAttributeHandler.TEXT, value);
    return new BoxLabelChange(label, value, old);
  }
}
