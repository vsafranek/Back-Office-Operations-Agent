import { describe, expect, it } from "vitest";
import { DataPullPlanSchema, coercePlan } from "@/lib/agent/tools/data-pull-plan";

describe("DataPullPlanSchema", () => {
  it("accepts suggest_derived_charts and derived_chart_kind_hint", () => {
    const raw = DataPullPlanSchema.parse({
      dataset: "clients",
      row_text_narrowing: null,
      client_filters: null,
      filter_label: "Test",
      suggest_source_channel_chart: false,
      suggest_derived_charts: true,
      derived_chart_kind_hint: "pie"
    });
    expect(raw.suggest_derived_charts).toBe(true);
    expect(raw.derived_chart_kind_hint).toBe("pie");
  });

  it("coercePlan forces suggest_derived_charts false outside clients", () => {
    const coerced = coercePlan(
      DataPullPlanSchema.parse({
        dataset: "new_clients_q1",
        row_text_narrowing: null,
        client_filters: null,
        filter_label: null,
        suggest_source_channel_chart: true,
        suggest_derived_charts: true,
        derived_chart_kind_hint: "pie"
      })
    );
    expect(coerced.suggest_derived_charts).toBe(false);
    expect(coerced.derived_chart_kind_hint).toBeNull();
  });
});
