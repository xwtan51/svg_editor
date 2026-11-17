import type { AssemblyProfile } from "../assembly/AssemblyProfile.js";
import { BareProfile } from "../assembly/BareProfile.js";
import { ConfigProfile } from "../assembly/ConfigProfile.js";
import { FullProfile } from "../assembly/FullProfile.js";
import { OnlyProfile } from "../assembly/OnlyProfile.js";
import { StartupRefusal } from "../assembly/StartupRefusal.js";

/**
 * The command line of `svg-editor` (design §4.3): which assembly profile to
 * build. No argument is `full`; `--bare`, `--only <package>` (repeatable) and
 * `--config <file>` exclude each other. Anything else — two kinds of option,
 * `--bare` or `--config` twice, an unknown argument, `--only` / `--config`
 * without a value (a missing, empty or `--`-prefixed next argument) — refuses
 * the start with the usage line.
 */
export class CliArguments {
  static readonly USAGE = "usage: svg-editor [--bare | --only <plugin>… | --config <file>]";

  private static readonly BARE = "--bare";
  private static readonly ONLY = "--only";
  private static readonly CONFIG = "--config";
  private static readonly OPTION_PREFIX = "--";

  private bareCount = 0;
  private readonly onlyNames: string[] = [];
  private readonly configFiles: string[] = [];

  private constructor() {}

  /** `argv` without the Node binary and the script (`process.argv.slice(2)`); throws `StartupRefusal` with the usage line. */
  static parse(argv: readonly string[]): AssemblyProfile {
    const parsed = new CliArguments();
    for (let i = 0; i < argv.length; i++) {
      const argument = argv[i];
      if (argument === CliArguments.BARE) {
        parsed.bareCount++;
      } else if (argument === CliArguments.ONLY) {
        parsed.onlyNames.push(CliArguments.valueAfter(argv, i++));
      } else if (argument === CliArguments.CONFIG) {
        parsed.configFiles.push(CliArguments.valueAfter(argv, i++));
      } else {
        throw new StartupRefusal(CliArguments.USAGE);
      }
    }
    return parsed.profile();
  }

  private profile(): AssemblyProfile {
    const kinds = [this.bareCount > 0, this.onlyNames.length > 0, this.configFiles.length > 0].filter(Boolean).length;
    if (kinds > 1 || this.bareCount > 1 || this.configFiles.length > 1) {
      throw new StartupRefusal(CliArguments.USAGE);
    }
    const [configFile] = this.configFiles;
    if (configFile !== undefined) {
      return new ConfigProfile(configFile);
    }
    if (this.onlyNames.length > 0) {
      return new OnlyProfile(this.onlyNames);
    }
    return this.bareCount > 0 ? new BareProfile() : new FullProfile();
  }

  /** The value of the option at `index`. */
  private static valueAfter(argv: readonly string[], index: number): string {
    const value = argv[index + 1];
    if (value === undefined || value.length === 0 || value.startsWith(CliArguments.OPTION_PREFIX)) {
      throw new StartupRefusal(CliArguments.USAGE);
    }
    return value;
  }
}
