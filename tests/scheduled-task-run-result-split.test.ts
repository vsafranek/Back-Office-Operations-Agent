import { describe, expect, it } from "vitest";
import {
  splitCronOkNotification,
  splitScheduledTaskCallerPrompt
} from "@/components/agent/ScheduledTaskRunResultCard";

describe("splitCronOkNotification", () => {
  it("returns single block when summary equals detail", () => {
    const r = splitCronOkNotification("Krátká odpověď.", "Krátká odpověď.");
    expect(r.notice).toBeNull();
    expect(r.agentReply).toBe("Krátká odpověď.");
  });

  it("splits truncated summary from full detail", () => {
    const long =
      "A".repeat(600);
    const short = `${"A".repeat(477)}…`;
    const r = splitCronOkNotification(short, long);
    expect(r.notice).toBe(short);
    expect(r.agentReply).toBe(long);
  });

  it("uses summary alone when detail missing", () => {
    const r = splitCronOkNotification("Jen shrnutí", null);
    expect(r.notice).toBeNull();
    expect(r.agentReply).toBe("Jen shrnutí");
  });
});

describe("splitScheduledTaskCallerPrompt", () => {
  it("returns prefix before cron delimiter", () => {
    expect(
      splitScheduledTaskCallerPrompt(
        "PREFIX systému\n\n--- Dotaz / šablona úlohy ---\nUživatelský dotaz"
      )
    ).toBe("PREFIX systému");
  });

  it("returns null when delimiter missing", () => {
    expect(splitScheduledTaskCallerPrompt("Jen jeden blok")).toBeNull();
  });
});
