import { describe, expect, it } from "vitest";
import { parseTaskCapabilities } from "@/lib/agent/llm/task-capabilities";

describe("parseTaskCapabilities", () => {
  it("detects presentation + slide count from Czech prompt", () => {
    const out = parseTaskCapabilities("Najdi realitky v Praze a priprav prezentaci o 4 slidech.");
    expect(out.needsPresentation).toBe(true);
    expect(out.slideCount).toBe(4);
  });

  it("detects scheduling language", () => {
    const out = parseTaskCapabilities("Kazdy den rano mi posilej nove nabidky.");
    expect(out.needsSchedule).toBe(true);
  });

  it("detects report artifacts", () => {
    const out = parseTaskCapabilities("Priprav report a exportuj CSV i Excel.");
    expect(out.needsReportArtifacts).toBe(true);
  });
});
