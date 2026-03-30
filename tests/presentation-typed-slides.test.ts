import { describe, expect, it } from "vitest";
import type { PresentationSlide } from "@/lib/agent/tools/presentation-typed-deck";
import {
  parsePresentationSlidesFromLlmJson,
  presentationSlideSchema,
  presentationSlidesToTemplateSpecs,
  buildFallbackPresentationSlides,
  buildNativeTypedPptxBuffer,
  formatPropertyBulletForSlide,
  clampPresentationSlidesForNative,
  deriveHeroTitle,
  ensureOpeningTitleSlide,
  expandDenseContentSlides,
  ensureContentSlidesMeetMinBullets,
  stripLeadingTitleSlides
} from "@/lib/agent/tools/presentation-typed-deck";

describe("presentation typed slides", () => {
  it("fallback deck pro nemovitosti: žádné opakované n/a měsíce ani JSON v odrážkách", () => {
    const rows: Record<string, unknown>[] = [
      {
        property_id: "01aa0001-01aa-41aa-81aa-010000000001",
        title: "Byt 2+1 Korunní",
        city: "Praha",
        address: { city: "Praha", country: "CZ", district: "Vinohrady" },
        missing_reconstruction: true,
        missing_structural_changes: true
      },
      {
        property_id: "02",
        title: "Dům Únětice",
        city: "Únětice",
        missing_reconstruction: false,
        missing_structural_changes: false
      }
    ];
    const slides = buildFallbackPresentationSlides(rows, 4, "Portfolio", { includeOpeningTitleSlide: false });
    const blob = JSON.stringify(slides);
    expect(blob).not.toMatch(/Pokryté měsíce:.*n\/a/i);
    expect(blob).not.toMatch(/"property_id"/);
    const detail = slides.find((s) => s.type === "content" && /Evidence|Detail/i.test(s.title));
    expect(detail?.type).toBe("content");
    if (detail?.type === "content") {
      expect(detail.bullets.some((b) => b.includes("Korunní"))).toBe(true);
    }
  });

  it("formatPropertyBulletForSlide: věty místo klíčů id / listed_price", () => {
    const line = formatPropertyBulletForSlide({
      id: "01dd0005-01dd-41dd-81dd-010000000005",
      title: "Luxusní loft Smíchov",
      listed_price: 18_900_000,
      reconstruction_notes: "Kompletní rekonstrukce 2022, loftový standard."
    });
    expect(line).toContain("Luxusní loft");
    expect(line.toLowerCase()).toContain("mil");
    expect(line.toLowerCase()).not.toContain("listed_price");
    expect(line.toLowerCase()).not.toContain("id:");
  });

  it("clamp přepíše i textový řádek „id: · title: · listed_price:“ na větu", () => {
    const slides = parsePresentationSlidesFromLlmJson(
      [
        {
          type: "content",
          title: "Objekty",
          bullets: [
            "id: 01dd · title: Byt test · listed_price: 7200000 · reconstruction_notes: Panel 80. let.",
            "b",
            "c"
          ]
        }
      ],
      1
    )!;
    const clamped = clampPresentationSlidesForNative(slides);
    const b0 = (clamped[0] as { bullets: string[] }).bullets[0]!;
    expect(b0.toLowerCase()).not.toContain("listed_price");
  });

  it("clamp přepíše JSON-like odrážku na čitelný text", () => {
    const raw = JSON.stringify({
      property_id: "x",
      title: "Test byt",
      city: "Praha",
      missing_reconstruction: true
    });
    const slides = parsePresentationSlidesFromLlmJson(
      [{ type: "content", title: "X", bullets: [raw, "b", "c"] }],
      1
    )!;
    const clamped = clampPresentationSlidesForNative(slides);
    expect(clamped[0]!.type).toBe("content");
    const b0 = (clamped[0] as { bullets: string[] }).bullets[0]!;
    expect(b0).toContain("Test byt");
    expect(b0).not.toContain("property_id");
  });

  it("parsuje LLM pole podle discriminated union", () => {
    const raw = [
      { type: "title", title: "Týdenní report", subtitle: "Leden" },
      {
        type: "content",
        title: "KPI",
        bullets: ["A", "B", "C", "D"]
      },
      {
        type: "stats",
        title: "Čísla",
        stats: [
          { value: "12", label: "Leadů" },
          { value: "3", label: "Uzavřeno" }
        ]
      }
    ];
    const s = parsePresentationSlidesFromLlmJson(raw, 3);
    expect(s).not.toBeNull();
    expect(s![0]!.type).toBe("title");
    expect(s![1]!.type).toBe("content");
    expect(s![2]!.type).toBe("stats");
  });

  it("flattenuje na šablonové title+bullets", () => {
    const slides = parsePresentationSlidesFromLlmJson(
      [
        { type: "title", title: "Hlavní", subtitle: "Pod" },
        { type: "quote", quote: "Citát", attribution: "Autor" }
      ],
      2
    )!;
    const leg = presentationSlidesToTemplateSpecs(slides);
    expect(leg[0]!.bullets.length).toBeGreaterThanOrEqual(4);
    expect(leg[1]!.title).toBeTruthy();
    expect(leg[1]!.bullets.some((b) => b.includes("Citát"))).toBe(true);
  });

  it("deriveHeroTitle zkrátí dlouhý prompt a respektuje LLM titulek", () => {
    const long =
      "Udělej mi prosím velmi dlouhou a podrobnou prezentaci o všem co souvisí s prodejem nemovitostí v Brně za poslední čtvrtletí včetně všech detailů";
    expect(deriveHeroTitle(long, "KPI Brno Q4")).toBe("KPI Brno Q4");
    expect(deriveHeroTitle(long, undefined)).toBe("Prezentace");
    expect(deriveHeroTitle("  Krátký název  ", undefined)).toBe("Krátký název");
  });

  it("stripLeadingTitleSlides odstraní úvodní title slide", () => {
    const slides = parsePresentationSlidesFromLlmJson(
      [
        { type: "title", title: "Titulek", subtitle: "Pod" },
        { type: "content", title: "A", bullets: ["a", "b", "c"] }
      ],
      2
    )!;
    const stripped = stripLeadingTitleSlides(slides);
    expect(stripped).toHaveLength(1);
    expect(stripped[0]!.type).toBe("content");
  });

  it("ensureOpeningTitleSlide nepřepíše LLM titulek celým deck promptem", () => {
    const deck =
      "Chci PPTX o výkonu obchodníků za poslední měsíc s důrazem na konverze leadů a čas do prvního kontaktu včetně tabulky a grafu";
    const slides = parsePresentationSlidesFromLlmJson(
      [
        { type: "title", title: "Výkon obchodníků", subtitle: "Leden" },
        { type: "content", title: "Metriky", bullets: ["a", "b", "c"] }
      ],
      2
    )!;
    const fixed = ensureOpeningTitleSlide(slides, deck, 2);
    expect(fixed[0]!.type).toBe("title");
    expect((fixed[0] as { title: string }).title).toBe("Výkon obchodníků");
  });

  it("expandDenseContentSlides: pokračování má vždy ≥3 odrážky (nebo sloučení)", () => {
    const slides = parsePresentationSlidesFromLlmJson(
      [
        { type: "title", title: "T", subtitle: "s" },
        {
          type: "content",
          title: "Tab + body",
          bullets: ["a", "b", "c", "d", "e"],
          table: { headers: ["X"], rows: [["1"]] }
        }
      ],
      2
    )!;
    const expanded = expandDenseContentSlides(slides);
    for (const sl of expanded) {
      if (sl.type !== "content") continue;
      const nb = sl.bullets.length;
      const rich = !!(sl.table ?? sl.chart);
      expect(nb >= 3 || rich).toBe(true);
      expect(presentationSlideSchema.safeParse(sl).success).toBe(true);
    }
  });

  it("ensureContentSlidesMeetMinBullets doplní textový slide pod minimum schématu", () => {
    const thin: PresentationSlide[] = [{ type: "content", title: "A", bullets: ["x", "y"] }];
    const fixed = ensureContentSlidesMeetMinBullets(thin);
    expect(fixed[0]!.type).toBe("content");
    expect((fixed[0] as { bullets: string[] }).bullets.length).toBeGreaterThanOrEqual(3);
    expect(presentationSlideSchema.safeParse(fixed[0]).success).toBe(true);
  });

  it("expandDenseContentSlides rozdělí dlouhý seznam bodů a tabulku nechá jen na prvním dílu", () => {
    const slides = parsePresentationSlidesFromLlmJson(
      [
        { type: "title", title: "T", subtitle: "s" },
        {
          type: "content",
          title: "Hustý slide",
          bullets: ["a", "b", "c", "d", "e", "f", "g"],
          table: { headers: ["X"], rows: [["1"]] }
        }
      ],
      2
    )!;
    const expanded = expandDenseContentSlides(slides);
    const contentSlides = expanded.filter((s) => s.type === "content");
    expect(contentSlides.length).toBeGreaterThanOrEqual(2);
    const first = contentSlides[0] as { table?: unknown; bullets: string[] };
    const second = contentSlides[1] as { table?: unknown; bullets: string[] };
    expect(first.table).toBeDefined();
    expect(second.table).toBeUndefined();
    expect(first.bullets.length).toBeLessThanOrEqual(4);
    expect(second.bullets.length).toBeLessThanOrEqual(4);
  });

  it("vygeneruje neprázdný pptx z nativního builderu", async () => {
    const slides = parsePresentationSlidesFromLlmJson(
      [
        { type: "title", title: "Test", subtitle: "Vitest" },
        { type: "content", title: "Body", bullets: ["j", "k", "l", "m"] }
      ],
      2
    )!;
    const buf = await buildNativeTypedPptxBuffer("Deck test", slides);
    expect(buf.byteLength).toBeGreaterThan(5_000);
  });
});
