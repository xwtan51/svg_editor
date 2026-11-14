/**
 * The options a plugin is constructed with (design §3.1, §4.4): an immutable
 * value object holding a deep, frozen copy of a JSON-like object. Both ways of
 * assembling an editor build it the same way, so a plugin receives identical
 * options whether it is listed in code or in a configuration file.
 */
export class PluginOptions {
  /** No options (what a plugin gets when none are written). */
  static readonly EMPTY: PluginOptions = new PluginOptions(Object.freeze({}));

  private readonly values: Readonly<Record<string, unknown>>;

  private constructor(values: Readonly<Record<string, unknown>>) {
    this.values = values;
  }

  /** A deep copy of `values`, frozen. A non-object (array, null, …) is a programming error. */
  static of(values: Readonly<Record<string, unknown>>): PluginOptions {
    if (typeof values !== "object" || values === null || Array.isArray(values)) {
      throw new Error("plugin options must be an object");
    }
    return new PluginOptions(PluginOptions.freeze(structuredClone(values)));
  }

  /** The raw value, or `undefined` when the option is not set. */
  get(name: string): unknown {
    return Object.hasOwn(this.values, name) ? this.values[name] : undefined;
  }

  /** The option as a string, `fallback` when unset; a value of another type throws `Error`. */
  string(name: string, fallback: string): string {
    return this.typed(name, fallback, "string");
  }

  number(name: string, fallback: number): number {
    return this.typed(name, fallback, "number");
  }

  boolean(name: string, fallback: boolean): boolean {
    return this.typed(name, fallback, "boolean");
  }

  isEmpty(): boolean {
    return Object.keys(this.values).length === 0;
  }

  private typed<T>(name: string, fallback: T, expected: string): T {
    const value = this.get(name);
    if (value === undefined) {
      return fallback;
    }
    if (typeof value !== expected) {
      throw new Error(`option ${name} must be a ${expected}`);
    }
    return value as T;
  }

  private static freeze<T>(value: T): T {
    if (typeof value === "object" && value !== null) {
      for (const child of Object.values(value)) {
        PluginOptions.freeze(child);
      }
      Object.freeze(value);
    }
    return value;
  }
}
