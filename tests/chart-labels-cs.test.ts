import { describe, expect, it } from "vitest";
import { COLUMN_LABEL_CS, columnLabelCs } from "@/lib/agent/analytics/chart-labels-cs";

describe("chart-labels-cs", () => {
  it("maps known CRM columns to Czech labels", () => {
    expect(COLUMN_LABEL_CS.source_channel).toBe("Zdroj / kanál");
    expect(COLUMN_LABEL_CS.preferred_city).toBe("Preferované město");
  });

  it("title-cases unknown snake_case without raw key in common cases", () => {
    const t = columnLabelCs("custom_field_name");
    expect(t).not.toContain("custom_field_name");
    expect(t.length).toBeGreaterThan(3);
  });
});
