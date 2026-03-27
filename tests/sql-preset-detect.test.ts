import { describe, expect, it } from "vitest";
import {
  extractClientAreaSearchTerm,
  fallbackPlanFromQuestion,
  narrowRowsByText
} from "@/lib/agent/tools/data-pull-plan";

describe("fallbackPlanFromQuestion (záloha bez LLM)", () => {
  it("Q1 klienti + zdroj + graf (vzorová věta)", () => {
    const q =
      "Jaké nové klienty máme za 1. kvartál? Odkud přišli? Můžeš to znázornit graficky?";
    const p = fallbackPlanFromQuestion(q);
    expect(p.dataset).toBe("new_clients_q1");
    expect(p.suggest_source_channel_chart).toBe(true);
  });

  it("klienti a první kvartál", () => {
    const p = fallbackPlanFromQuestion("Noví klienti v prvním kvartálu");
    expect(p.dataset).toBe("new_clients_q1");
    expect(p.suggest_source_channel_chart).toBe(true);
  });

  it("Q1 bez zmínky o grafu ani zdroji — výchozí graf kanálu", () => {
    const p = fallbackPlanFromQuestion("Jaké nové klienty máme za 1. kvartál?");
    expect(p.dataset).toBe("new_clients_q1");
    expect(p.suggest_source_channel_chart).toBe(true);
  });

  it("rekonstrukce má přednost", () => {
    const p = fallbackPlanFromQuestion("Kde chybí poznámky k rekonstrukci u klientů v Q1?");
    expect(p.dataset).toBe("missing_reconstruction");
  });

  it("lead / prodeje", () => {
    const p = fallbackPlanFromQuestion("Porovnej leady a prodané byty za 6 měsíců");
    expect(p.dataset).toBe("leads_vs_sales_6m");
  });

  it("preferovaná oblast — tabulka klientů + textový filtr", () => {
    const p = fallbackPlanFromQuestion("Kdo z klientů preferuje Dejvice? (Preferovaná oblast)");
    expect(p.dataset).toBe("clients");
    expect(p.row_text_narrowing).toBe("Dejvice");
    expect(p.suggest_source_channel_chart).toBe(false);
  });
});

describe("extractClientAreaSearchTerm", () => {
  it("preferuje před závorkou", () => {
    expect(extractClientAreaSearchTerm("Kdo preferuje Dejvice? (okolí)")).toBe("Dejvice");
  });

  it("známá čtvrť v dotazu bez slovesa preferovat", () => {
    expect(extractClientAreaSearchTerm("Vypiš klienty z Karlína")).toBe("Karlín");
  });
});

describe("narrowRowsByText", () => {
  it("ponechá jen řádky se shodou v preferované čtvrti", () => {
    const rows = [
      { preferred_district: "Holešovice", full_name: "A" },
      { preferred_district: "Dejvice", full_name: "B" }
    ];
    const out = narrowRowsByText(rows, "Dejvice");
    expect(out).toHaveLength(1);
    expect(out[0]!.full_name).toBe("B");
  });
});
