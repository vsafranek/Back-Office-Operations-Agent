import { describe, expect, it } from "vitest";
import { detectIntent } from "../lib/agent";

describe("detectIntent", () => {
  it("returns calendar_email for meeting/email prompts", () => {
    expect(detectIntent("Napis email a navrhni termin prohlidky")).toBe("calendar_email");
  });

  it("returns weekly_report for report prompts", () => {
    expect(detectIntent("Priprav report pro vedeni a 3 slidy")).toBe("weekly_report");
  });

  it("falls back to analytics", () => {
    expect(detectIntent("Jaci jsou novi klienti v Q1")).toBe("analytics");
  });
});
