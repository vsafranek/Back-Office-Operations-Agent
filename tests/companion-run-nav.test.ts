import { describe, expect, it } from "vitest";
import {
  companionRunNavCanGoNewer,
  companionRunNavCanGoOlder,
  companionRunNavCursor,
  companionRunNavGoNewer,
  companionRunNavGoOlder
} from "@/lib/ui/companion-run-nav";

const runs = [
  { runId: "v0", preview: "A" },
  { runId: "v1", preview: "B" },
  { runId: "v2", preview: "C" }
];

describe("companionRunNavCursor", () => {
  const timeline = ["u0", "v0", "u1", "v1", "v2", "email"];

  it("returns direct index when companion is one of the runs", () => {
    expect(companionRunNavCursor(runs, "v1", timeline)).toBe(1);
  });

  it("returns last run strictly before companion when companion is foreign (e.g. mail)", () => {
    expect(companionRunNavCursor(runs, "email", timeline)).toBe(2);
  });

  it("returns -1 when companion is before all runs in timeline", () => {
    expect(companionRunNavCursor(runs, "u0", timeline)).toBe(-1);
  });

  it("returns index 0 when companion lies between first run and second user message", () => {
    expect(companionRunNavCursor(runs, "u1", timeline)).toBe(0);
  });

  it("when companion not in timeline, anchors to newest run in list", () => {
    expect(companionRunNavCursor(runs, "unknown", timeline)).toBe(2);
  });

  it("empty runs yields -1", () => {
    expect(companionRunNavCursor([], "v0", timeline)).toBe(-1);
  });

  it("null companion yields last index", () => {
    expect(companionRunNavCursor(runs, null, timeline)).toBe(2);
  });
});

describe("companionRunNavGoNewer / GoOlder", () => {
  const timeline = ["v0", "v1", "mail"];

  it("go newer from -1 selects first run", () => {
    const log: string[] = [];
    const c = companionRunNavCursor(runs, "early", ["early", "v0", "v1", "mail"]);
    expect(c).toBe(-1);
    companionRunNavGoNewer(runs, c, (id) => log.push(id));
    expect(log).toEqual(["v0"]);
  });

  it("go older from 1 selects v0", () => {
    const log: string[] = [];
    companionRunNavGoOlder(runs, 1, (id) => log.push(id));
    expect(log).toEqual(["v0"]);
  });

  it("canGoNewer false at last slot", () => {
    expect(companionRunNavCanGoNewer(2, 3)).toBe(false);
    expect(companionRunNavCanGoNewer(-1, 3)).toBe(true);
  });

  it("canGoOlder false at 0 and -1", () => {
    expect(companionRunNavCanGoOlder(0)).toBe(false);
    expect(companionRunNavCanGoOlder(-1)).toBe(false);
  });
});
