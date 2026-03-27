import { describe, expect, it } from "vitest";
import { detectQueryPresetFromQuestion } from "@/lib/agent/tools/sql-tool";

describe("detectQueryPresetFromQuestion", () => {
  it("Q1 klienti + zdroj + graf (vzorova veta)", () => {
    const q =
      "Jaké nové klienty máme za 1. kvartál? Odkud přišli? Můžeš to znázornit graficky?";
    expect(detectQueryPresetFromQuestion(q)).toBe("new_clients_q1");
  });

  it("klienti a prvni kvartal", () => {
    expect(detectQueryPresetFromQuestion("Novi klienti v prvnim kvartálu")).toBe("new_clients_q1");
  });

  it("rekonstrukce má přednost", () => {
    expect(
      detectQueryPresetFromQuestion("Kde chybí poznámky k rekonstrukci u klientů v Q1?")
    ).toBe("missing_reconstruction");
  });

  it("lead / prodeje", () => {
    expect(detectQueryPresetFromQuestion("Porovnej leady a prodané byty za 6 měsíců")).toBe("leads_vs_sales_6m");
  });
});
