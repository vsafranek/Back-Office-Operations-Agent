import { beforeEach, describe, expect, it, vi } from "vitest";

const { fetchMapyMatrixMock } = vi.hoisted(() => ({
  fetchMapyMatrixMock: vi.fn()
}));

vi.mock("@/lib/transit/mapy-matrix", () => ({
  fetchMapyMatrix: fetchMapyMatrixMock
}));

import { GET } from "@/app/api/transit/matrix/route";

describe("/api/transit/matrix", () => {
  beforeEach(() => {
    fetchMapyMatrixMock.mockReset();
  });

  it("returns normalized matrix payload for valid query", async () => {
    fetchMapyMatrixMock.mockResolvedValue([[{ length: 780, duration: 620 }]]);

    const response = await GET(
      new Request("https://example.test/api/transit/matrix?starts=14.4213,50.0878&ends=14.4343,50.0839&routeType=foot_fast")
    );
    const body = (await response.json()) as {
      routeType: string;
      matrix: Array<Array<{ distanceM: number; durationSec: number; durationMin: number }>>;
    };

    expect(response.status).toBe(200);
    expect(body.routeType).toBe("foot_fast");
    expect(body.matrix[0][0]).toEqual({ distanceM: 780, durationSec: 620, durationMin: 10 });
    expect(fetchMapyMatrixMock).toHaveBeenCalledWith(
      expect.objectContaining({
        routeType: "foot_fast",
        starts: [{ longitude: 14.4213, latitude: 50.0878 }],
        ends: [{ longitude: 14.4343, latitude: 50.0839 }]
      })
    );
  });

  it("returns 400 for invalid starts parameter", async () => {
    const response = await GET(new Request("https://example.test/api/transit/matrix?starts=invalid"));
    const body = (await response.json()) as { error: string };

    expect(response.status).toBe(400);
    expect(body.error).toContain("Invalid starts");
    expect(fetchMapyMatrixMock).not.toHaveBeenCalled();
  });

  it("returns 400 when combinations exceed matrix limit", async () => {
    const manyStarts = Array.from({ length: 11 })
      .map((_, index) => `${14.3 + index * 0.001},50.0`)
      .join(";");
    const manyEnds = Array.from({ length: 10 })
      .map((_, index) => `${14.4 + index * 0.001},50.1`)
      .join(";");

    const response = await GET(
      new Request(`https://example.test/api/transit/matrix?starts=${encodeURIComponent(manyStarts)}&ends=${encodeURIComponent(manyEnds)}`)
    );
    const body = (await response.json()) as { error: string };

    expect(response.status).toBe(400);
    expect(body.error).toContain("maximum of 100");
    expect(fetchMapyMatrixMock).not.toHaveBeenCalled();
  });
});
