import { beforeEach, describe, expect, it, vi } from "vitest";

const { requireOperatorAccessMock, runSrealityIngestionMock } = vi.hoisted(() => ({
  requireOperatorAccessMock: vi.fn(),
  runSrealityIngestionMock: vi.fn()
}));

vi.mock("@/lib/security/operator-auth", () => ({
  requireOperatorAccess: requireOperatorAccessMock
}));

vi.mock("@/lib/integrations/ingestion/run-ingestion", () => ({
  runSrealityIngestion: runSrealityIngestionMock
}));

import { POST } from "@/app/api/integrations/sreality/ingest/route";

describe("sreality full run ingest route", () => {
  beforeEach(() => {
    requireOperatorAccessMock.mockReset();
    runSrealityIngestionMock.mockReset();
  });

  it("accepts full apartments mode", async () => {
    requireOperatorAccessMock.mockResolvedValue({ id: "operator-key" });
    runSrealityIngestionMock.mockResolvedValue({
      runId: "run-123",
      status: "succeeded",
      fetchedCount: 100,
      parsedCount: 95,
      upsertedCount: 95,
      failedCount: 5,
      removedCount: 2
    });

    const response = await POST(
      new Request("https://example.test/api/integrations/sreality/ingest", {
        method: "POST",
        headers: { "content-type": "application/json", "x-operator-key": "secret" },
        body: JSON.stringify({ mode: "apartments_full", dryRun: false })
      })
    );

    const body = (await response.json()) as { runId: string; status: string };
    expect(response.status).toBe(202);
    expect(body.runId).toBe("run-123");
    expect(runSrealityIngestionMock).toHaveBeenCalled();
  });

  it("supports chunk mode with pageStart and chunkPages", async () => {
    requireOperatorAccessMock.mockResolvedValue({ id: "operator-key" });
    runSrealityIngestionMock.mockResolvedValue({
      runId: "run-456",
      status: "partial",
      fetchedCount: 20,
      parsedCount: 20,
      upsertedCount: 20,
      failedCount: 0,
      removedCount: 0
    });

    const response = await POST(
      new Request("https://example.test/api/integrations/sreality/ingest", {
        method: "POST",
        headers: { "content-type": "application/json", "x-operator-key": "secret" },
        body: JSON.stringify({ mode: "apartments_chunk", pageStart: 11, chunkPages: 5, dryRun: true })
      })
    );

    expect(response.status).toBe(202);
    expect(runSrealityIngestionMock).toHaveBeenCalledWith(
      expect.objectContaining({
        page: 11,
        fullScan: true,
        dryRun: true,
        sourceOptions: expect.objectContaining({ maxPages: 5 })
      })
    );
  });

  it("returns 403 for missing operator access", async () => {
    requireOperatorAccessMock.mockRejectedValue(new Error("Forbidden"));

    const response = await POST(
      new Request("https://example.test/api/integrations/sreality/ingest", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ mode: "apartments_full" })
      })
    );

    expect(response.status).toBe(403);
  });
});
