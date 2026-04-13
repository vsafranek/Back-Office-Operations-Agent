import { beforeEach, describe, expect, it, vi } from "vitest";

const { requireOperatorAccessMock, listIngestionRunsMock } = vi.hoisted(() => ({
  requireOperatorAccessMock: vi.fn(),
  listIngestionRunsMock: vi.fn()
}));

vi.mock("@/lib/security/operator-auth", () => ({
  requireOperatorAccess: requireOperatorAccessMock
}));

vi.mock("@/lib/integrations/ingestion/ingestion-history", () => ({
  listIngestionRuns: listIngestionRunsMock
}));

import { GET } from "@/app/api/integrations/sreality/ingest/runs/route";

describe("GET /api/integrations/sreality/ingest/runs", () => {
  beforeEach(() => {
    requireOperatorAccessMock.mockReset();
    listIngestionRunsMock.mockReset();
  });

  it("returns ingestion runs for operator", async () => {
    requireOperatorAccessMock.mockResolvedValue({ id: "operator-key" });
    listIngestionRunsMock.mockResolvedValue([{ id: "run-1", status: "succeeded" }]);

    const response = await GET(new Request("https://example.test/api/integrations/sreality/ingest/runs?limit=25"));
    const body = (await response.json()) as { items: Array<{ id: string }> };

    expect(response.status).toBe(200);
    expect(body.items).toHaveLength(1);
    expect(listIngestionRunsMock).toHaveBeenCalledWith(25);
  });

  it("returns 403 when operator auth fails", async () => {
    requireOperatorAccessMock.mockRejectedValue(new Error("Forbidden"));

    const response = await GET(new Request("https://example.test/api/integrations/sreality/ingest/runs"));
    expect(response.status).toBe(403);
  });
});
