import { describe, expect, it } from "vitest";
import {
  formatViewingSlotRange,
  parseViewingConfirmedSlotFromBody
} from "@/lib/agent/viewing-email-slot-body";

describe("parseViewingConfirmedSlotFromBody", () => {
  it("round-trips cs-CZ formatted line with range hint", () => {
    const start = new Date(2026, 2, 15, 14, 0, 0).toISOString();
    const end = new Date(2026, 2, 15, 15, 30, 0).toISOString();
    const human = formatViewingSlotRange(start, end);
    const body = `Ahoj.\n\nTermín prohlídky: ${human}\n\nS pozdravem,`;
    const hint = { rangeStart: "2026-03-01T00:00:00.000Z", rangeEnd: "2026-03-31T23:59:59.999Z" };
    const parsed = parseViewingConfirmedSlotFromBody(body, hint);
    expect(parsed).not.toBeNull();
    expect(parsed!.start.slice(0, 16)).toBe(start.slice(0, 16));
    expect(parsed!.end.slice(0, 16)).toBe(end.slice(0, 16));
  });

  it("supports legacy label Potvrzený termín prohlídky", () => {
    const start = new Date(2026, 0, 12, 10, 0, 0).toISOString();
    const end = new Date(2026, 0, 12, 11, 0, 0).toISOString();
    const human = formatViewingSlotRange(start, end);
    const body = `Text\n\nPotvrzený termín prohlídky: ${human}`;
    const hint = { rangeStart: "2026-01-01T00:00:00.000Z", rangeEnd: "2026-01-20T00:00:00.000Z" };
    const parsed = parseViewingConfirmedSlotFromBody(body, hint);
    expect(parsed).not.toBeNull();
    expect(new Date(parsed!.start).getDate()).toBe(12);
  });

  it("returns null when no line", () => {
    expect(parseViewingConfirmedSlotFromBody("Jen text")).toBeNull();
  });
});
