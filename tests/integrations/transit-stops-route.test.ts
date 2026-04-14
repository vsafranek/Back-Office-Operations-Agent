import { beforeEach, describe, expect, it, vi } from "vitest";

const { listActiveTransitStopsMock } = vi.hoisted(() => ({
  listActiveTransitStopsMock: vi.fn()
}));

vi.mock("@/lib/transit/stops", () => ({
  listActiveTransitStops: listActiveTransitStopsMock
}));

import { GET } from "@/app/api/transit/stops/route";

describe("/api/transit/stops", () => {
  beforeEach(() => {
    listActiveTransitStopsMock.mockReset();
  });

  it("returns public stop payload filtered by viewport", async () => {
    listActiveTransitStopsMock.mockResolvedValue([
      {
        id: "stop-1",
        name: "Muzeum",
        mode: "metro",
        metro_line: "A",
        latitude: 50.0802,
        longitude: 14.4303,
        is_active: true
      },
      {
        id: "stop-2",
        name: "Far away",
        mode: "metro",
        metro_line: "B",
        latitude: 48.9,
        longitude: 16.3,
        is_active: true
      }
    ]);

    const response = await GET(
      new Request("https://example.test/api/transit/stops?north=50.2&south=50.0&east=14.6&west=14.2&mode=metro,tram&metroLines=A")
    );
    const body = (await response.json()) as { items: Array<{ id: string; name: string }> };

    expect(response.status).toBe(200);
    expect(listActiveTransitStopsMock).toHaveBeenCalledWith({ modes: ["metro", "tram"], metroLines: ["A"] });
    expect(body.items).toEqual([{ id: "stop-1", name: "Muzeum", mode: "metro", metroLine: "A", latitude: 50.0802, longitude: 14.4303 }]);
  });

  it("returns 400 for invalid bounds", async () => {
    const response = await GET(new Request("https://example.test/api/transit/stops?north=50.1&east=14.5&west=14.2"));
    const body = (await response.json()) as { error: string };

    expect(response.status).toBe(400);
    expect(body.error).toContain("Bounds");
  });
});
