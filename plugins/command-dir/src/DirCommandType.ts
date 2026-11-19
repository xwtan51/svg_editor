import { CommandCategory } from "@svgframe/kernel";
import type { ArgList, CommandType } from "@svgframe/kernel";
import { DirCommand } from "./DirCommand.js";
import type { DirectoryLister } from "./DirectoryLister.js";
import type { WorkingDirectory } from "./WorkingDirectory.js";

/**
 * The registered static side of `dir` (design §2.2.1, G11): an instance, not
 * the command class, because it carries the two Targets the Client needs and
 * a static field holding them would be module-level state (L8). `parse` hands
 * them to every `DirCommand` it builds.
 */
export class DirCommandType implements CommandType {
  readonly commandName = "dir";
  readonly usage = "dir";
  readonly summary = "list the files and directories of the working directory";
  readonly category = CommandCategory.DISPLAY;
  /** Usable before `init` or `read` (spec §2.2). */
  readonly requiresDocument = false;

  private readonly lister: DirectoryLister;
  private readonly workingDirectory: WorkingDirectory;

  constructor(lister: DirectoryLister, workingDirectory: WorkingDirectory) {
    this.lister = lister;
    this.workingDirectory = workingDirectory;
  }

  /** No argument: `dir x` is `usage: dir` (decision X12). */
  parse(args: ArgList): DirCommand {
    args.expectEnd();
    return new DirCommand(this.lister, this.workingDirectory);
  }
}
