import { describe, expect, it } from "vitest";
import { getAnalyticsTableDisplayKeys } from "@/lib/agent/analytics/table-display-columns";

describe("getAnalyticsTableDisplayKeys", () => {
  it("leads_sales_6m keeps only month and counts when present", () => {
    const rows = [{ month: "2025-01", leads_count: 3, sold_count: 1, extra: "x" }];
    expect(getAnalyticsTableDisplayKeys("leads_sales_6m", rows)).toEqual([
      "month",
      "leads_count",
      "sold_count"
    ]);
  });

  it("clients_q1 drops empty columns and verbose notes when many rows", () => {
    const rows = Array.from({ length: 10 }, (_, i) => ({
      full_name: `U${i}`,
      email: "",
      phone: "",
      property_notes: "x".repeat(200)
    }));
    const keys = getAnalyticsTableDisplayKeys("clients_q1", rows);
    expect(keys).toContain("full_name");
    expect(keys).not.toContain("email");
    expect(keys).not.toContain("property_notes");
  });

  it("clients_filtered uses same preview rules as clients_q1 for row shape", () => {
    const rows = [{ full_name: "A", email: "a@b.c", budget_min_czk: 1_000_000 }];
    const keys = getAnalyticsTableDisplayKeys("clients_filtered", rows);
    expect(keys).toContain("full_name");
    expect(keys).toContain("email");
  });

  it("deal_sales_detail prefers transaction and property columns", () => {
    const rows = [
      {
        deal_id: "d1",
        sold_at: "2026-01-01",
        title: "Byt 1",
        city: "Praha",
        full_name: "Jan",
        sold_price: 5_000_000,
        buyer_snapshot: { note: "x" }
      }
    ];
    const keys = getAnalyticsTableDisplayKeys("deal_sales_detail", rows);
    expect(keys).not.toContain("buyer_snapshot");
    expect(keys.indexOf("sold_at")).toBeLessThan(keys.indexOf("full_name"));
  });

  it("missing_reconstruction follows DATA_BROWSER_PRESETS order and hides id-like columns", () => {
    const rows = [
      {
        property_id: "p1",
        title: "Byt 2",
        city: "Brno",
        address: { street: "x" },
        reconstruction_status: "Částečná",
        missing_reconstruction: true,
        missing_structural_changes: false,
        reconstruction_budget_estimate_czk: 250_000,
        reconstruction_last_reviewed_at: "2026-03-01",
        building_works_checklist: ["ok"]
      }
    ];
    const keys = getAnalyticsTableDisplayKeys("missing_reconstruction", rows);
    expect(keys).not.toContain("property_id");
    expect(keys).not.toContain("address");
    expect(keys).not.toContain("building_works_checklist");
    expect(keys.slice(0, 3)).toEqual(["title", "city", "reconstruction_status"]);
  });
});
