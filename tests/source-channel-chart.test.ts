import { describe, expect, it } from "vitest";
import { buildSourceChannelChart } from "@/lib/agent/analytics/source-channel-chart";

describe("buildSourceChannelChart", () => {
  it("vrátí prázdný graf bez řádků", () => {
    const out = buildSourceChannelChart([]);
    expect(out.labels).toEqual([]);
    expect(out.values).toEqual([]);
    expect(out.title).toContain("Q1");
  });

  it("sčítá jeden kanál", () => {
    const out = buildSourceChannelChart([{ source_channel: "Sreality" }, { source_channel: "Sreality" }]);
    expect(out.labels).toEqual(["Sreality"]);
    expect(out.values).toEqual([2]);
  });

  it("řadí podle počtu sestupně", () => {
    const out = buildSourceChannelChart([
      { source_channel: "A" },
      { source_channel: "A" },
      { source_channel: "B" },
      { source_channel: "B" },
      { source_channel: "B" }
    ]);
    expect(out.labels).toEqual(["B", "A"]);
    expect(out.values).toEqual([3, 2]);
  });

  it("null a prázdný string mapuje na (neuvedeno)", () => {
    const out = buildSourceChannelChart([{ source_channel: null }, { source_channel: "" }, { source_channel: "X" }]);
    expect(out.labels).toContain("(neuvedeno)");
    expect(out.labels).toContain("X");
    const i = out.labels.indexOf("(neuvedeno)");
    expect(out.values[i]).toBe(2);
  });
});
