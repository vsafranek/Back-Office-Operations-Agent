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

  it("nemovitosti + rekonstrukce + stavební úpravy (vzorová věta uživatele)", () => {
    const p = fallbackPlanFromQuestion(
      "Najdi nemovitosti, u kterých nám v systému chybí data o rekonstrukci a stavebních úpravách a připrav jejich seznam k doplnění."
    );
    expect(p.dataset).toBe("missing_reconstruction");
    expect(p.filter_label).toContain("Nemovitosti");
  });

  it("nemovitosti + stavební úpravy bez slova rekonstrukce", () => {
    const p = fallbackPlanFromQuestion(
      "Vylistuj nemovitosti, kde chybí údaje o stavebních úpravách v CRM."
    );
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

  it("obecný dotaz bez signálu presetu — default clients (ne Q1 view)", () => {
    const p = fallbackPlanFromQuestion("Jak overit ze bezi migrace databaze?");
    expect(p.dataset).toBe("clients");
    expect(p.suggest_source_channel_chart).toBe(false);
  });

  it("parafráze: první čtvrtletí + odkud (české ctn)", () => {
    const p = fallbackPlanFromQuestion("Klienti za první čtvrtletí — odkud jsou?");
    expect(p.dataset).toBe("new_clients_q1");
    expect(p.suggest_source_channel_chart).toBe(true);
  });

  it("parafráze: nováčci + Q1 bez slova kvartal", () => {
    const p = fallbackPlanFromQuestion("Kolik máme nováčků v Q1 a jaký mají zdroj?");
    expect(p.dataset).toBe("new_clients_q1");
    expect(p.suggest_source_channel_chart).toBe(true);
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

  it("řádky z fn_missing_reconstruction_data: shoda v městě / internal_ref / UUID", () => {
    const rows = [
      {
        property_id: "01cc0001-01cc-41cc-81cc-010000000001",
        title: "TEST Byt",
        city: "Plzeň",
        internal_ref: "TEST-DQI-001",
        missing_reconstruction: true,
        missing_structural_changes: true
      },
      {
        property_id: "01cc0002-01cc-41cc-81cc-010000000002",
        title: "Jiný",
        city: "Brno",
        internal_ref: "X",
        missing_reconstruction: false,
        missing_structural_changes: true
      }
    ];
    expect(narrowRowsByText(rows, "Plzeň")).toHaveLength(1);
    expect(narrowRowsByText(rows, "TEST-DQI-001")).toHaveLength(1);
    expect(narrowRowsByText(rows, "01cc0002")).toHaveLength(1);
  });

  it("shoda v address jsonb (město / čtvrť bez samostatného sloupce city)", () => {
    const rows = [
      {
        property_id: "p1",
        title: "Byt",
        address: { city: "Ostrava", district: "Centrum", country: "CZ" },
        internal_ref: "PF-X"
      }
    ];
    expect(narrowRowsByText(rows, "Ostrava")).toHaveLength(1);
    expect(narrowRowsByText(rows, "Centrum")).toHaveLength(1);
  });
});
