import { describe, expect, it } from "vitest";
import type { FileSystemWatcher, Uri } from "vscode";
import { EventEmitter } from "../stubs/vscode.js";
import { SvgResourceWatcher } from "../../src/host/SvgResourceWatcher.js";

/** A FileSystemWatcher double whose events the test fires by hand. */
class FakeWatcher {
  readonly created = new EventEmitter<Uri>();
  readonly changed = new EventEmitter<Uri>();
  readonly deleted = new EventEmitter<Uri>();
  disposed = false;

  readonly onDidCreate = this.created.event;
  readonly onDidChange = this.changed.event;
  readonly onDidDelete = this.deleted.event;

  dispose(): void {
    this.disposed = true;
  }

  asWatcher(): FileSystemWatcher {
    return this as unknown as FileSystemWatcher;
  }
}

const a = { scheme: "file", path: "/w/x.svg" } as Uri;

describe("SvgResourceWatcher", () => {
  it("VA7: re-announces created and deleted paths", () => {
    const fake = new FakeWatcher();
    const watcher = new SvgResourceWatcher(fake.asWatcher());
    const seen: Uri[] = [];
    watcher.onDidChange((uri) => seen.push(uri));
    fake.created.fire(a);
    fake.deleted.fire(a);
    expect(seen).toEqual([a, a]);
  });

  // VSCode coalesces "delete x.svg, then create x.svg" into one CHANGE event, so
  // the file -> directory case arrives as a change, not as delete + create.
  it("VA7: re-announces changed paths too (coalesced delete + create)", () => {
    const fake = new FakeWatcher();
    const watcher = new SvgResourceWatcher(fake.asWatcher());
    const seen: Uri[] = [];
    watcher.onDidChange((uri) => seen.push(uri));
    fake.changed.fire(a);
    expect(seen).toEqual([a]);
  });

  it("dispose releases the watcher and stops events", () => {
    const fake = new FakeWatcher();
    const watcher = new SvgResourceWatcher(fake.asWatcher());
    const seen: Uri[] = [];
    watcher.onDidChange((uri) => seen.push(uri));
    watcher.dispose();
    fake.created.fire(a);
    expect(fake.disposed).toBe(true);
    expect(seen).toEqual([]);
  });
});
