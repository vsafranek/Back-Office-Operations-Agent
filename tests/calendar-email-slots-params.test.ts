import { describe, expect, it } from "vitest";
import {
  extractEmailFromText,
  inferViewingSlotParams
} from "@/lib/agent/calendar-email-slots-params";

describe("inferViewingSlotParams", () => {
  it("vrací výchozí 7 dní a 60 min schůzky", () => {
    expect(inferViewingSlotParams("napiš email")).toEqual({ daysAhead: 7, limit: 5, slotDurationMinutes: 60 });
  });

  it("rozpozná 14 dní", () => {
    expect(inferViewingSlotParams("za 14 dní prohlídka").daysAhead).toBe(14);
  });

  it("rozpozná explicitní počet dnů", () => {
    expect(inferViewingSlotParams("terminy na 10 dni dopredu")).toEqual({
      daysAhead: 10,
      limit: 5,
      slotDurationMinutes: 60
    });
  });

  it("rozpozná 90min schůzku", () => {
    expect(inferViewingSlotParams("email na prohlídku, schůzka hodinu a půl").slotDurationMinutes).toBe(90);
  });

  it("rozpozná délku z „45 minut“", () => {
    expect(inferViewingSlotParams("navrhni termín 45 minut").slotDurationMinutes).toBe(45);
  });
});

describe("extractEmailFromText", () => {
  it("najde první e-mail", () => {
    expect(extractEmailFromText("napiš Janu Novákovi na jana@firma.cz")).toBe("jana@firma.cz");
  });

  it("vrátí null bez adresy", () => {
    expect(extractEmailFromText("bez kontaktu")).toBeNull();
  });
});
