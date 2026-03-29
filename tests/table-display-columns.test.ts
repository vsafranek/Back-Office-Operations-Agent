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
});
