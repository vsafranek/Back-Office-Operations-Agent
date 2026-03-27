import { describe, expect, it } from "vitest";
import {
  shouldSuppressChartInPanel,
  userMentionsChartRequest
} from "@/lib/agent/question-panel-hints";

describe("question-panel-hints", () => {
  it("detekuje potlaceni grafu", () => {
    expect(shouldSuppressChartInPanel("Dej mi jen tabulku leadů")).toBe(true);
    expect(shouldSuppressChartInPanel("Bez grafu, jen čísla")).toBe(true);
    expect(shouldSuppressChartInPanel("Vytvoř graf vývoje")).toBe(false);
  });

  it("detekuje zadost o graf", () => {
    expect(userMentionsChartRequest("Zobraz graficky")).toBe(true);
    expect(userMentionsChartRequest("Jen export")).toBe(false);
  });
});
