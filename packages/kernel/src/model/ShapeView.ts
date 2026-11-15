/**
 * Read-only view of a shape (design §3.6.1), what tree decorators, the
 * `handles` of attribute handlers and document listeners get. `Shape`
 * implements it. Every method answers a primitive value or another read-only
 * view; none changes anything, and none hands out the `Shape` itself
 * (`childViews()` answers views, not shapes). Read-only is a type-level
 * guarantee: casting a view back to `Shape` is a deliberate breach of the
 * contract (design §2.3.5), rejected in plugins by the architecture test (P10).
 */
export interface ShapeView {
  getId(): string;

  /** SVG element name, e.g. `rect`, `g`. */
  tagName(): string;

  /** User-visible type name (design §3.6); equals `tagName()` unless the type says otherwise. */
  kindName(): string;

  /** Echo name `kindName#id`. */
  label(): string;

  /** Tree name `tagName#id`. */
  treeLabel(): string;

  /** The inline part of a `tree` line; empty when the type shows none. */
  summary(): string;

  /** Every attribute written on save, in save order, as a fresh copy. */
  svgAttributes(): Array<[string, string]>;

  /** Character content, or `null` for elements without content. */
  textContent(): string | null;

  /** Id of the parent shape; `null` when the shape sits directly under the document root or is detached. */
  parentId(): string | null;

  /** Whether the shape can hold children. */
  isContainer(): boolean;

  /** The direct children in z-order; empty for a leaf. */
  childViews(): readonly ShapeView[];
}
