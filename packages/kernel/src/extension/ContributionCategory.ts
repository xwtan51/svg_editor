/**
 * The four kinds of registration names a plugin declares under `contributes`
 * (spec §6 loading contract): a closed set of value objects in the fixed order
 * shapes → commands → decorators → attributes, the order in which duplicates
 * are checked and manifest lists are written (design §3.3.1).
 */
export class ContributionCategory {
  static readonly SHAPES = new ContributionCategory("shapes");
  static readonly COMMANDS = new ContributionCategory("commands");
  static readonly DECORATORS = new ContributionCategory("decorators");
  static readonly ATTRIBUTES = new ContributionCategory("attributes");

  private readonly name: string;

  private constructor(key: string) {
    this.name = key;
  }

  /** All four, in the fixed order. */
  static all(): readonly ContributionCategory[] {
    return [
      ContributionCategory.SHAPES,
      ContributionCategory.COMMANDS,
      ContributionCategory.DECORATORS,
      ContributionCategory.ATTRIBUTES,
    ];
  }

  /** The category whose `contributes` key is `key`, or `null`. */
  static fromKey(key: string): ContributionCategory | null {
    return ContributionCategory.all().find((category) => category.name === key) ?? null;
  }

  /** The key under `contributes`, e.g. `shapes`. */
  key(): string {
    return this.name;
  }

  /** `shapes/box`: how a registration name appears in installer messages. */
  qualify(registrationName: string): string {
    return `${this.name}/${registrationName}`;
  }
}
