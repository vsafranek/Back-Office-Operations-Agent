import { describe, expect, it, vi, beforeEach } from "vitest";
import type { ToolRunner } from "@/lib/agent/mcp-tools/tool-runner";
import type { AgentToolContext } from "@/lib/agent/types";

vi.mock("@/lib/agent/llm/user-facing-reply", () => ({
  generateUserFacingReply: vi.fn().mockResolvedValue({
    answer_text: "Hotovo.",
    confidence: 0.9,
    next_actions: []
  })
}));

vi.mock("@/lib/agent/tools/market-listings-tool", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/agent/tools/market-listings-tool")>();
  return {
    ...actual,
    fetchMarketListings: vi.fn()
  };
});

vi.mock("@/lib/agent/subagents/presentation-subagent", () => ({
  runPresentationFromRowsSubAgent: vi.fn()
}));

vi.mock("@/lib/supabase/server-client", () => ({
  getSupabaseAdminClient: vi.fn(() => ({
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          in: vi.fn(async () => ({ data: [], error: null }))
        }))
      }))
    }))
  }))
}));

import { generateUserFacingReply } from "@/lib/agent/llm/user-facing-reply";
import { fetchMarketListings } from "@/lib/agent/tools/market-listings-tool";
import { runPresentationFromRowsSubAgent } from "@/lib/agent/subagents/presentation-subagent";
import { runMarketListingsChatSubAgent } from "@/lib/agent/subagents/market-listings-chat-subagent";

const mockListing = {
  external_id: "sreality:x",
  title: "Test",
  location: "Praha",
  source: "sreality",
  url: "https://www.sreality.cz/detail/x",
  created_at: "2026-01-01T00:00:00.000Z",
  image_url: "https://cdn.example/img.jpg"
};

describe("runMarketListingsChatSubAgent", () => {
  beforeEach(() => {
    vi.mocked(fetchMarketListings).mockResolvedValue([mockListing]);
    vi.mocked(runPresentationFromRowsSubAgent).mockResolvedValue({
      publicUrl: "https://cdn.example/listings.pptx",
      pdfPublicUrl: "https://cdn.example/listings.pdf",
      totalSlidesLabel: 5,
      includeOpeningTitleSlide: false
    });
  });

  it("volá fetchMarketListings a vrací panel s novými nabídkami", async () => {
    const run = vi.fn();
    const toolRunner = { run } as unknown as ToolRunner;

    const ctx: AgentToolContext = { runId: "r1", userId: "u1" };
    const answer = await runMarketListingsChatSubAgent({
      toolRunner,
      ctx,
      question: "Nabídky v Praze první stránka"
    });

    expect(run).not.toHaveBeenCalled();
    expect(fetchMarketListings).toHaveBeenCalledWith(
      expect.objectContaining({
        location: "Praha",
        sources: ["sreality", "bezrealitky"],
        bezrealitkyRegionOsmIds: ["R435514"],
        srealityLocalityRegionId: 10
      })
    );
    expect(generateUserFacingReply).toHaveBeenCalled();
    expect(answer.dataPanel?.kind).toBe("market_listings");
    if (answer.dataPanel?.kind === "market_listings") {
      expect(answer.dataPanel.title).toContain("Nové nabídky");
      expect(answer.dataPanel.listings).toHaveLength(1);
      expect(answer.dataPanel.listings[0]?.external_id).toBe("sreality:x");
    }
    expect(runPresentationFromRowsSubAgent).not.toHaveBeenCalled();
  });

  it("vytvori prezentaci z novych nabidek, kdyz ji uzivatel explicitne chce", async () => {
    const run = vi.fn();
    const toolRunner = { run } as unknown as ToolRunner;
    const ctx: AgentToolContext = { runId: "r2", userId: "u1" };
    const answer = await runMarketListingsChatSubAgent({
      toolRunner,
      ctx,
      question: "Najdi nove nabidky v Praze a priprav z nich prezentaci o 4 slidech"
    });

    expect(runPresentationFromRowsSubAgent).toHaveBeenCalledWith(
      expect.objectContaining({
        rows: [expect.objectContaining({ external_id: "sreality:x" })],
        sourceLabel: "market_listings_fetch",
        slideCount: 4
      })
    );
    expect(answer.generated_artifacts).toEqual([
      expect.objectContaining({ type: "presentation", url: "https://cdn.example/listings.pptx" }),
      expect.objectContaining({ type: "presentation", url: "https://cdn.example/listings.pdf" })
    ]);
  });
});
