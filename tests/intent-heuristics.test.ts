import { describe, expect, it } from "vitest";
import {
  applyPresentationIntentHeuristics,
  inferSlideCountFromUserText,
  shouldPreferWeeklyReportBundle
} from "@/lib/agent/llm/intent-heuristics";

const USER_PROMPT =
  "Shrň výsledky minulého týdne do krátkého reportu pro vedení a připrav k tomu prezentaci se třemi slidy.";

describe("intent-heuristics (Czech weekly report + slides)", () => {
  it("parses slide count from třemi slidy", () => {
    expect(inferSlideCountFromUserText(USER_PROMPT)).toBe(3);
    expect(inferSlideCountFromUserText("deck se 4 slidy")).toBe(4);
    expect(inferSlideCountFromUserText("powerpoint 2 slid")).toBe(2);
  });

  it("prefers full weekly bundle when report for management + deck", () => {
    expect(shouldPreferWeeklyReportBundle(USER_PROMPT)).toBe(true);
  });

  it("does not prefer bundle for deck-only asks", () => {
    expect(
      shouldPreferWeeklyReportBundle("Jen prezentaci o prodejích, 5 slidů, žádný CSV.")
    ).toBe(false);
  });

  it("upgrades presentation → weekly_report and sets slideCount 3 for the real user prompt", () => {
    const out = applyPresentationIntentHeuristics(
      { intent: "presentation", slideCount: undefined },
      USER_PROMPT
    );
    expect(out.intent).toBe("weekly_report");
    expect(out.slideCount).toBe(3);
  });

  it("overrides classifier slideCount when text says three", () => {
    const out = applyPresentationIntentHeuristics(
      { intent: "weekly_report", slideCount: 8 },
      USER_PROMPT
    );
    expect(out.intent).toBe("weekly_report");
    expect(out.slideCount).toBe(3);
  });
});
