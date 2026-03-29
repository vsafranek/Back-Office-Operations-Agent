import { describe, expect, it } from "vitest";
import {
  expandAgentSearchTermsForDb,
  normalizeSearchKey,
  scoreClientAgainstTokens
} from "@/lib/agent/calendar-email-recipient-search";

describe("expandAgentSearchTermsForDb", () => {
  it("rozšíří víceslovné jméno z LLM na dílčí výrazy", () => {
    const e = expandAgentSearchTermsForDb(["Lucii Dvořákové"]);
    expect(e.length).toBeGreaterThanOrEqual(2);
    const flat = e.map((x) => normalizeSearchKey(x)).join(" ");
    expect(flat).toContain("lucii");
    expect(flat).toContain("dvorakove");
  });
});

describe("scoreClientAgainstTokens", () => {
  it("najde Lucii Dvořákovou i při skloňování a diakritice v DB", () => {
    const tokens = expandAgentSearchTermsForDb(["Lucii Dvořákové"]);
    const score = scoreClientAgainstTokens(
      "Lucie Dvořáková",
      "lucie.dvorakova@example.com",
      tokens
    );
    expect(score).toBeGreaterThanOrEqual(3);
  });

  it("nepřiřadí vysoké skóre náhodnému klientovi bez shody jména", () => {
    const tokens = expandAgentSearchTermsForDb(["Lucii Dvořákové"]);
    const score = scoreClientAgainstTokens("Jan Novák", "jan.novak@example.com", tokens);
    expect(score).toBeLessThan(3);
  });
});
