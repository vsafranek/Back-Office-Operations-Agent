import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { listActiveTransitStopsMock, fetchMock } = vi.hoisted(() => ({
  listActiveTransitStopsMock: vi.fn(),
  fetchMock: vi.fn()
}));

vi.mock("@/lib/transit/stops", () => ({
  listActiveTransitStops: listActiveTransitStopsMock
}));

import { GET } from "@/app/api/transit/stops/route";

describe("/api/transit/stops", () => {
  beforeEach(() => {
    listActiveTransitStopsMock.mockReset();
    fetchMock.mockReset();
    fetchMock.mockResolvedValue(
      new Response(
        JSON.stringify({
          elements: [
            {
              type: "relation",
              id: 101,
              tags: { ref: "A", route: "subway" },
              members: [
                {
                  type: "way",
                  role: "",
                  geometry: [
                    { lat: 50.0802, lon: 14.4303 },
                    { lat: 50.0756, lon: 14.4378 }
                  ]
                }
              ]
            }
          ]
        }),
        {
          status: 200,
          headers: { "content-type": "application/json" }
        }
      )
    );
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
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
        id: "stop-3",
        name: "Náměstí Míru",
        mode: "metro",
        metro_line: "A",
        latitude: 50.0756,
        longitude: 14.4378,
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
    const body = (await response.json()) as { items: Array<{ id: string; name: string }>; routes?: Array<{ line: string; points: unknown[] }> };

    expect(response.status).toBe(200);
    expect(listActiveTransitStopsMock).toHaveBeenCalledWith({ modes: ["metro", "tram"], metroLines: ["A"] });
    expect(body.items).toEqual([
      { id: "stop-1", name: "Muzeum", mode: "metro", metroLine: "A", latitude: 50.0802, longitude: 14.4303 },
      { id: "stop-3", name: "Náměstí Míru", mode: "metro", metroLine: "A", latitude: 50.0756, longitude: 14.4378 }
    ]);
    expect(body.routes?.[0]).toEqual(
      expect.objectContaining({
        line: "A"
      })
    );
    expect(fetchMock).toHaveBeenCalled();
  });

  it("returns 400 for invalid bounds", async () => {
    const response = await GET(new Request("https://example.test/api/transit/stops?north=50.1&east=14.5&west=14.2"));
    const body = (await response.json()) as { error: string };

    expect(response.status).toBe(400);
    expect(body.error).toContain("Bounds");
  });
});
