import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("@/lib/llm/azure-proxy-provider", () => ({
  generateWithAzureProxy: vi.fn()
}));

import { generateWithAzureProxy } from "@/lib/llm/azure-proxy-provider";
import { classifyAgentIntent } from "@/lib/agent/llm/intent-classifier";

describe("classifyAgentIntent", () => {
  beforeEach(() => {
    vi.mocked(generateWithAzureProxy).mockReset();
  });

  it("returns calendar_email when the model emits matching JSON", async () => {
    vi.mocked(generateWithAzureProxy).mockResolvedValueOnce({
      text: '{"intent":"calendar_email"}',
      model: "mock"
    });

    const r = await classifyAgentIntent({ runId: "run-1", question: "Napis email a navrhni termin prohlidky" });
    expect(r.intent).toBe("calendar_email");
    expect(generateWithAzureProxy).toHaveBeenCalledTimes(1);
  });

  it("returns presentation when the model chooses deck-only output", async () => {
    vi.mocked(generateWithAzureProxy).mockResolvedValueOnce({
      text: '{"intent":"presentation","slideCount":5}',
      model: "mock"
    });

    const r = await classifyAgentIntent({
      runId: "run-presentation",
      question: "Udelej PPTX prezentaci z leadu, 5 slidu"
    });
    expect(r.intent).toBe("presentation");
    expect(r.slideCount).toBe(5);
  });

  it("returns weekly_report with slideCount when present", async () => {
    vi.mocked(generateWithAzureProxy).mockResolvedValueOnce({
      text: '{"intent":"weekly_report","slideCount":3}',
      model: "mock"
    });

    const r = await classifyAgentIntent({ runId: "run-2", question: "Priprav report pro vedeni a 3 slidy" });
    expect(r.intent).toBe("weekly_report");
    expect(r.slideCount).toBe(3);
  });

  it("returns market_listings when the model emits matching JSON", async () => {
    vi.mocked(generateWithAzureProxy).mockResolvedValueOnce({
      text: '{"intent":"market_listings"}',
      model: "mock"
    });

    const r = await classifyAgentIntent({
      runId: "run-ml",
      question: "Stahni nabidky z Sreality a Bezrealitky pro Prahu"
    });
    expect(r.intent).toBe("market_listings");
  });

  it("falls back to analytics when JSON is invalid", async () => {
    vi.mocked(generateWithAzureProxy)
      .mockResolvedValueOnce({ text: "not json", model: "mock" })
      .mockResolvedValueOnce({ text: "still wrong", model: "mock" });

    const r = await classifyAgentIntent({ runId: "run-3", question: "Jaci jsou novi klienti v Q1" });
    expect(r.intent).toBe("analytics");
  });
});
