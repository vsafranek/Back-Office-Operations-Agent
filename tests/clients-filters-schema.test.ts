import { describe, expect, it } from "vitest";
import {
  ClientFilterSchema,
  ClientFiltersSchema,
  coerceTimestamptzFilterValue
} from "@/lib/agent/tools/clients-table-query";

describe("coerceTimestamptzFilterValue", () => {
  it("parsuje ISO s offsetem", () => {
    const out = coerceTimestamptzFilterValue("2025-03-15T10:00:00+01:00");
    expect(out).toBeTruthy();
    expect(out!.startsWith("2025-03-15")).toBe(true);
  });

  it("vrací null pro neplatný řetězec", () => {
    expect(coerceTimestamptzFilterValue("není datum")).toBeNull();
  });
});

describe("ClientFilterSchema", () => {
  it("akceptuje ts_gte na created_at", () => {
    const f = ClientFilterSchema.parse({
      kind: "ts_gte",
      column: "created_at",
      value: "2025-01-01T00:00:00.000Z"
    });
    expect(f.kind).toBe("ts_gte");
  });

  it("akceptuje text_in a id_eq", () => {
    expect(
      ClientFilterSchema.parse({
        kind: "text_in",
        column: "source_channel",
        values: ["web", "referral"]
      }).kind
    ).toBe("text_in");
    expect(
      ClientFilterSchema.parse({
        kind: "id_eq",
        value: "550e8400-e29b-41d4-a716-446655440000"
      }).kind
    ).toBe("id_eq");
  });

  it("akceptuje num_gt a text_starts_with", () => {
    ClientFilterSchema.parse({
      kind: "num_gt",
      column: "budget_min_czk",
      value: 5_000_000
    });
    ClientFilterSchema.parse({
      kind: "text_starts_with",
      column: "phone",
      value: "+420"
    });
  });

  it("ClientFiltersSchema max 20 položek", () => {
    const many = Array.from({ length: 20 }, (_, i) => ({
      kind: "text_eq" as const,
      column: "source_channel" as const,
      value: `c${i}`
    }));
    expect(() => ClientFiltersSchema.parse(many)).not.toThrow();
    expect(() =>
      ClientFiltersSchema.parse([
        ...many,
        { kind: "text_eq" as const, column: "source_channel" as const, value: "x" }
      ])
    ).toThrow();
  });
});
