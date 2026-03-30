import fs from "node:fs";
import path from "node:path";
import fontkit from "@pdf-lib/fontkit";
import { PDFDocument, PDFPage, rgb } from "pdf-lib";
import type { PDFFont } from "pdf-lib";
import PptxGenJS from "pptxgenjs";
import { z } from "zod";

type PptxSlide = ReturnType<InstanceType<typeof PptxGenJS>["addSlide"]>;

const statPairSchema = z.object({
  value: z.string().min(1),
  label: z.string().min(1)
});

export const titleSlideSchema = z.object({
  type: z.literal("title"),
  title: z.string().min(1),
  subtitle: z.string().optional()
});

const contentTableSchema = z.object({
  headers: z.array(z.string().min(1)).min(1).max(8),
  rows: z.array(z.array(z.string()).min(1)).min(1).max(14)
});

const contentChartSchema = z.object({
  kind: z.enum(["bar", "line"]),
  title: z.string().max(80).optional(),
  categories: z.array(z.string().min(1)).min(2).max(12),
  series: z
    .array(
      z.object({
        name: z.string().min(1).max(48),
        values: z.array(z.number()).min(2).max(12)
      })
    )
    .min(1)
    .max(3)
});

export const contentSlideSchema = z
  .object({
    type: z.literal("content"),
    title: z.string().min(1),
    bullets: z.array(z.string().min(1)).max(8).default([]),
    table: contentTableSchema.optional(),
    chart: contentChartSchema.optional()
  })
  .superRefine((data, ctx) => {
    const nb = data.bullets.length;
    const hasT = data.table != null;
    const hasC = data.chart != null;
    if (nb < 3 && !hasT && !hasC) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "content: aspon 3 bullets nebo vyplnte table nebo chart",
        path: ["bullets"]
      });
    }
    if (data.chart) {
      for (const s of data.chart.series) {
        if (s.values.length !== data.chart.categories.length) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: "chart: pocet values v kazde serii musi byt stejny jako categories",
            path: ["chart"]
          });
          break;
        }
      }
    }
    if (data.table) {
      const hc = data.table.headers.length;
      for (let ri = 0; ri < data.table.rows.length; ri++) {
        if (data.table.rows[ri]!.length !== hc) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: "table: kazdy radek musi mit stejny pocet sloupcu jako headers",
            path: ["table", "rows", ri]
          });
          break;
        }
      }
    }
  });

export const statsSlideSchema = z.object({
  type: z.literal("stats"),
  title: z.string().min(1),
  stats: z.array(statPairSchema).min(2).max(6)
});

export const quoteSlideSchema = z.object({
  type: z.literal("quote"),
  title: z.string().optional(),
  quote: z.string().min(1),
  attribution: z.string().optional()
});

export const sectionSlideSchema = z.object({
  type: z.literal("section"),
  title: z.string().min(1),
  subtitle: z.string().optional()
});

export const presentationSlideSchema = z.discriminatedUnion("type", [
  titleSlideSchema,
  contentSlideSchema,
  statsSlideSchema,
  quoteSlideSchema,
  sectionSlideSchema
]);

export type PresentationSlide = z.infer<typeof presentationSlideSchema>;

export const presentationSlideArraySchema = (n: number) =>
  z.array(presentationSlideSchema).length(n);

/** Rozměry a barvy (soulad s dřívějším native deckem). LAYOUT_WIDE. */
export const NATIVE_DECK = {
  W: 13.333,
  H: 7.5,
  headerH: 1.42,
  accentH: 0.07,
  pageBg: "DDE7F0",
  headerFill: "163A59",
  accentFill: "3D9AE8",
  cardFill: "FFFFFF",
  cardLine: "94A3B8",
  titleOnHeader: "FFFFFF",
  bodyColor: "1E293B",
  footerColor: "64748B",
  cardMarginX: 0.48,
  gapUnderHeader: 0.26,
  footerStripH: 0.48,
  cardRadius: 0.07,
  innerPadX: 0.5,
  innerPadTop: 0.4
} as const;

const TEMPLATE_MAX_TITLE_CHARS = 64;
const TEMPLATE_MAX_BULLET_CHARS = 180;
const NATIVE_MAX_TITLE_HEADER = 68;
const NATIVE_MAX_BODY_LINE = 220;

const BOA_TITLE_MASTER = "BOA_TITLE_MASTER";
const BOA_CONTENT_MASTER = "BOA_CONTENT_MASTER";

function padTemplateBullets(lines: string[]): string[] {
  const out = lines.map((s) => s.trim()).filter(Boolean);
  const padded = [...out];
  while (padded.length < 4) padded.push("—");
  return padded.slice(0, 8);
}

function safeNum(value: unknown): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

/** Ploché slidové položky pro výpočet fallbacku (interní). */
function buildFallbackFlatSlides(rows: Record<string, unknown>[], slideCount: number) {
  const months = rows.map((row) => String(row.month ?? "n/a"));
  const totalLeads = rows.reduce((acc, row) => acc + safeNum(row.leads_count), 0);
  const totalSold = rows.reduce((acc, row) => acc + safeNum(row.sold_count), 0);
  const conversion = totalLeads > 0 ? ((totalSold / totalLeads) * 100).toFixed(1) : "0.0";
  const topRows = rows.slice(0, 10).map((row) => JSON.stringify(row));
  const padBullets = (bullets: string[]) => {
    const next = bullets.slice(0, 8);
    while (next.length < 4) {
      next.push("Doplňte relevantní metriky pro rozhodování vedení.");
    }
    return next;
  };

  const base = [
    {
      title: "Executive shrnutí",
      bullets: [
        `Analyzováno záznamů: ${rows.length}`,
        `Celkem leadů: ${totalLeads}`,
        `Celkem prodáno: ${totalSold}`,
        `Konverzní poměr lead → prodej: ${conversion} %`,
        "Obsah vychází z datového exportu za poslední období."
      ]
    },
    {
      title: "Trend a sezónnost",
      bullets: [
        `Pokryté měsíce: ${months.join(", ") || "bez měsíčních dat"}`,
        "Sledujte odchylky mezi novými leady a uzavřenými obchody.",
        "Identifikujte vrcholy a propady v pipeline.",
        "Při uzdravování leadů zkontrolujte zdroje akvizice.",
        "Při poklesu prodejů zkontrolujte rychlost follow-upu."
      ]
    },
    {
      title: "Detailní metriky",
      bullets:
        rows.length > 0
          ? padBullets(topRows.slice(0, 6))
          : [
              "Nejsou dostupná žádná data pro výpočet detailních metrik.",
              "Zkontrolujte SQL preset a zdrojové tabulky.",
              "Po doplnění dat workflow spusťte znovu.",
              "Doporučení: pravidelná validace před každým reportingem."
            ]
    },
    {
      title: "Rizika a doporučené kroky",
      bullets: [
        "Nastavte odpovědnost za každý klíčový KPI ukazatel.",
        "Zaveďte týdenní kontrolu kvality dat před prezentací.",
        "Prioritizujte leady s nejvyšším potenciálem uzavření.",
        "Sledujte dobu od prvního kontaktu po uzavření.",
        "Připravte akční plán na příští reportovací období."
      ]
    }
  ];

  while (base.length < slideCount) {
    const i = base.length + 1;
    base.push({
      title: `Doplňující analýza ${i}`,
      bullets: [
        "Doplňte segmentaci podle lokality a cenové hladiny.",
        "Porovnejte výkonnost jednotlivých obchodníků.",
        "Vyhodnoťte lead source ROI a efektivitu kampaní.",
        "Označte data, kde chybí vstupy pro rozhodování.",
        "Definujte rozhodnutí, která z reportu plynou."
      ]
    });
  }

  return base.slice(0, slideCount).map((s) => ({
    title: s.title,
    bullets: padBullets(s.bullets)
  }));
}

export function buildFallbackPresentationSlides(
  rows: Record<string, unknown>[],
  slideCount: number,
  deckTitle: string,
  options?: { includeOpeningTitleSlide?: boolean }
): PresentationSlide[] {
  const includeOpening = options?.includeOpeningTitleSlide !== false;
  const flat = buildFallbackFlatSlides(rows, slideCount);
  if (!includeOpening) {
    return flat.slice(0, slideCount).map((f) => ({
      type: "content" as const,
      title: f.title,
      bullets: f.bullets
    }));
  }
  if (slideCount <= 1) {
    return flat.map((f) => ({ type: "content" as const, title: f.title, bullets: f.bullets }));
  }
  return [
    {
      type: "title",
      title: deriveHeroTitle(deckTitle, "Executive shrnutí"),
      subtitle: "Executive shrnutí (generováno z dat, fallback)"
    },
    ...flat.slice(0, slideCount - 1).map((f) => ({
      type: "content" as const,
      title: f.title,
      bullets: f.bullets
    }))
  ];
}

const ell = (s: string, max: number) => (s.length <= max ? s : `${s.slice(0, Math.max(0, max - 1))}…`);

export function clampPresentationSlidesForTemplate(slides: PresentationSlide[]): PresentationSlide[] {
  return slides.map((s) => {
    switch (s.type) {
      case "title":
        return { ...s, title: ell(s.title, TEMPLATE_MAX_TITLE_CHARS), subtitle: s.subtitle ? ell(s.subtitle, TEMPLATE_MAX_BULLET_CHARS) : s.subtitle };
      case "content":
        return {
          ...s,
          title: ell(s.title, TEMPLATE_MAX_TITLE_CHARS),
          bullets: s.bullets.map((b) => ell(b, TEMPLATE_MAX_BULLET_CHARS)),
          table: s.table
            ? {
                headers: s.table.headers.map((h) => ell(h, 40)),
                rows: s.table.rows.map((r) => r.map((c) => ell(String(c), TEMPLATE_MAX_BULLET_CHARS)))
              }
            : undefined,
          chart: s.chart
            ? {
                ...s.chart,
                categories: s.chart.categories.map((c) => ell(c, 32)),
                series: s.chart.series.map((ser) => ({
                  ...ser,
                  name: ell(ser.name, 40)
                }))
              }
            : undefined
        };
      case "stats":
        return {
          ...s,
          title: ell(s.title, TEMPLATE_MAX_TITLE_CHARS),
          stats: s.stats.map((st) => ({
            value: ell(st.value, 32),
            label: ell(st.label, TEMPLATE_MAX_BULLET_CHARS)
          }))
        };
      case "quote":
        return {
          ...s,
          title: s.title ? ell(s.title, TEMPLATE_MAX_TITLE_CHARS) : s.title,
          quote: ell(s.quote, TEMPLATE_MAX_BULLET_CHARS),
          attribution: s.attribution ? ell(s.attribution, 80) : s.attribution
        };
      case "section":
        return {
          ...s,
          title: ell(s.title, TEMPLATE_MAX_TITLE_CHARS),
          subtitle: s.subtitle ? ell(s.subtitle, TEMPLATE_MAX_BULLET_CHARS) : s.subtitle
        };
      default:
        return s;
    }
  });
}

export function clampPresentationSlidesForNative(slides: PresentationSlide[]): PresentationSlide[] {
  return slides.map((s) => {
    switch (s.type) {
      case "title":
        return { ...s, title: ell(s.title, 100), subtitle: s.subtitle ? ell(s.subtitle, 200) : s.subtitle };
      case "content":
        return {
          ...s,
          title: ell(s.title, NATIVE_MAX_TITLE_HEADER),
          bullets: s.bullets.map((b) => ell(b, NATIVE_MAX_BODY_LINE)),
          table: s.table
            ? {
                headers: s.table.headers.map((h) => ell(h, 48)),
                rows: s.table.rows.map((r) => r.map((c) => ell(String(c), 64)))
              }
            : undefined,
          chart: s.chart
            ? {
                ...s.chart,
                title: s.chart.title ? ell(s.chart.title, 80) : undefined,
                categories: s.chart.categories.map((c) => ell(c, 40)),
                series: s.chart.series.map((ser) => ({
                  ...ser,
                  name: ell(ser.name, 48),
                  values: ser.values
                }))
              }
            : undefined
        };
      case "stats":
        return {
          ...s,
          title: ell(s.title, NATIVE_MAX_TITLE_HEADER),
          stats: s.stats.map((st) => ({
            value: ell(st.value, 40),
            label: ell(st.label, NATIVE_MAX_BODY_LINE)
          }))
        };
      case "quote":
        return {
          ...s,
          title: s.title ? ell(s.title, NATIVE_MAX_TITLE_HEADER) : s.title,
          quote: ell(s.quote, 500),
          attribution: s.attribution ? ell(s.attribution, 120) : s.attribution
        };
      case "section":
        return {
          ...s,
          title: ell(s.title, 72),
          subtitle: s.subtitle ? ell(s.subtitle, 200) : s.subtitle
        };
      default:
        return s;
    }
  });
}

/** Konverze pro externí .pptx šablonu (jen title + bullets). */
export function presentationSlidesToTemplateSpecs(
  slides: PresentationSlide[]
): Array<{ title: string; bullets: string[] }> {
  return slides.map((s) => {
    switch (s.type) {
      case "title":
        return {
          title: s.title,
          bullets: padTemplateBullets([s.subtitle ?? "Back Office · report", "—", "—"])
        };
      case "content": {
        const extra: string[] = [];
        if (s.table) {
          extra.push(s.table.headers.join(" · "));
          for (const r of s.table.rows) {
            extra.push(r.join(" · "));
          }
        }
        if (s.chart) {
          extra.push(`Graf ${s.chart.kind}: ${s.chart.categories.join(", ")}`);
          for (const ser of s.chart.series) {
            extra.push(`${ser.name}: ${ser.values.join(", ")}`);
          }
        }
        return {
          title: s.title,
          bullets: padTemplateBullets([...s.bullets, ...extra])
        };
      }
      case "stats":
        return {
          title: s.title,
          bullets: padTemplateBullets(s.stats.map((st) => `${st.value} — ${st.label}`))
        };
      case "quote":
        return {
          title: s.title ?? "Citát",
          bullets: padTemplateBullets([`„${s.quote}“`, s.attribution ?? "—", "—"])
        };
      case "section":
        return {
          title: s.title,
          bullets: padTemplateBullets([s.subtitle ?? "—", "—", "—"])
        };
      default:
        return { title: "Slide", bullets: padTemplateBullets(["—"]) };
    }
  });
}

export function parsePresentationSlidesFromLlmJson(json: unknown, expectedCount: number): PresentationSlide[] | null {
  if (!Array.isArray(json)) return null;
  const slice = json.slice(0, expectedCount);
  const parsed = presentationSlideArraySchema(expectedCount).safeParse(slice);
  return parsed.success ? parsed.data : null;
}

const HERO_TITLE_MAX_CHARS = 52;
const HERO_TITLE_MAX_WORDS = 8;

/** Krátký nadpis titulního slidu — nesmí být celý prompt; preferuje LLM titulek. */
export function deriveHeroTitle(deckTitle: string, llmTitleFromOpening?: string): string {
  const fromLlm = llmTitleFromOpening?.trim().replace(/\s+/g, " ");
  if (fromLlm && fromLlm.length >= 2) {
    return truncateHeroTitleWords(fromLlm, HERO_TITLE_MAX_WORDS, HERO_TITLE_MAX_CHARS);
  }
  const deck = deckTitle.trim().replace(/\s+/g, " ");
  const words = deck.split(" ").filter(Boolean);
  const longLikePrompt = deck.length > 72 || words.length > 12;
  if (longLikePrompt) {
    return "Prezentace";
  }
  const t = truncateHeroTitleWords(deck, HERO_TITLE_MAX_WORDS, HERO_TITLE_MAX_CHARS);
  return t || "Prezentace";
}

function truncateHeroTitleWords(text: string, maxWords: number, maxChars: number): string {
  let s = text
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, maxWords)
    .join(" ");
  if (s.length > maxChars) {
    s = s.slice(0, maxChars).trim();
    const sp = s.lastIndexOf(" ");
    if (sp > 12) s = s.slice(0, sp).trim();
  }
  return s.trim();
}

/** První slide je vždy titulní (velký středový nadpis); krátký titulek z LLM / heuristiky, ne celý prompt. */
export function ensureOpeningTitleSlide(
  slides: PresentationSlide[],
  deckTitle: string,
  slideCount: number
): PresentationSlide[] {
  const clipped = slides.slice(0, slideCount);
  if (clipped.length === 0) return clipped;
  const deck = deckTitle.trim().slice(0, 120) || "Report";

  if (slideCount === 1 && clipped[0]!.type !== "title") {
    const only = clipped[0]!;
    if (only.type === "content") {
      return [
        {
          type: "title",
          title: deriveHeroTitle(deck, only.title),
          subtitle: [only.title, ...only.bullets.slice(0, 5)].join(" · ").slice(0, 280)
        }
      ];
    }
    const hint = "title" in only && only.title ? only.title : undefined;
    return [
      {
        type: "title",
        title: deriveHeroTitle(deck, hint),
        subtitle: only.type === "section" ? only.subtitle ?? only.title : undefined
      }
    ];
  }

  if (clipped[0]!.type === "title") {
    const t = clipped[0] as Extract<PresentationSlide, { type: "title" }>;
    const hero = deriveHeroTitle(deck, t.title);
    return [{ ...t, title: hero }, ...clipped.slice(1)].slice(0, slideCount);
  }

  const oldFirst = clipped[0]!;
  let tail = clipped.slice(1);
  const subtitle =
    oldFirst.type === "content"
      ? oldFirst.title
      : oldFirst.type === "section"
        ? oldFirst.subtitle ?? oldFirst.title
        : oldFirst.type === "stats"
          ? oldFirst.title
          : undefined;

  const openingHint =
    oldFirst.type === "quote" ? oldFirst.title : "title" in oldFirst ? oldFirst.title : undefined;
  const titleSlide: PresentationSlide = {
    type: "title",
    title: deriveHeroTitle(deck, openingHint),
    subtitle
  };

  if (oldFirst.type === "content" && tail[0]?.type === "content") {
    const a = oldFirst;
    const b = tail[0];
    tail = [
      {
        type: "content",
        title: a.title,
        bullets: [...a.bullets, ...b.bullets].slice(0, 8),
        table: b.table ?? a.table,
        chart: b.chart ?? a.chart
      },
      ...tail.slice(1)
    ];
  } else {
    tail = [oldFirst, ...tail];
  }

  return [titleSlide, ...tail].slice(0, slideCount);
}

/** Odstraní úvodní slide(y) typu title (např. vypnutý titulní slide v nastavení). */
export function stripLeadingTitleSlides(slides: PresentationSlide[]): PresentationSlide[] {
  let s = slides;
  while (s[0]?.type === "title") s = s.slice(1);
  return s;
}

function headerLineForSlide(s: PresentationSlide, deckTitle: string): string {
  switch (s.type) {
    case "title":
      return deckTitle.slice(0, 80);
    case "quote":
      return s.title ?? "Citát";
    default:
      return s.title;
  }
}

function defineSlideMasters(pptx: InstanceType<typeof PptxGenJS>) {
  const d = NATIVE_DECK;
  const bottomBar = {
    rect: {
      x: 0,
      y: d.H - 0.2,
      w: d.W,
      h: 0.1,
      fill: { color: d.accentFill },
      line: { width: 0 }
    }
  } as const;

  pptx.defineSlideMaster({
    title: BOA_TITLE_MASTER,
    background: { color: d.pageBg },
    objects: [bottomBar]
  });

  pptx.defineSlideMaster({
    title: BOA_CONTENT_MASTER,
    background: { color: d.pageBg },
    objects: [
      {
        rect: {
          x: 0,
          y: 0,
          w: d.W,
          h: d.headerH,
          fill: { color: d.headerFill },
          line: { width: 0 }
        }
      },
      {
        rect: {
          x: 0,
          y: d.headerH,
          w: d.W,
          h: d.accentH,
          fill: { color: d.accentFill },
          line: { width: 0 }
        }
      },
      bottomBar
    ]
  });
}

function addFooter(slide: PptxSlide, deckTitle: string, index: number, total: number) {
  const d = NATIVE_DECK;
  const footY = d.H - d.footerStripH + 0.1;
  slide.addText(deckTitle.slice(0, 88), {
    x: d.cardMarginX,
    y: footY,
    w: d.W - 2.4,
    h: 0.34,
    fontSize: 9,
    color: d.footerColor,
    fontFace: "Calibri"
  });
  slide.addText(`${index + 1} / ${total}`, {
    x: d.W - 1.4,
    y: footY,
    w: 0.95,
    h: 0.34,
    fontSize: 9,
    color: d.footerColor,
    fontFace: "Calibri",
    align: "right"
  });
}

function addHeaderTitle(slide: PptxSlide, text: string) {
  const d = NATIVE_DECK;
  slide.addText(text, {
    x: d.cardMarginX + 0.25,
    y: 0.34,
    w: d.W - 2 * (d.cardMarginX + 0.25),
    h: d.headerH - 0.5,
    fontSize: 40,
    bold: true,
    color: d.titleOnHeader,
    fontFace: "Calibri",
    valign: "middle",
    shrinkText: true
  });
}

function contentCardBox(pptx: InstanceType<typeof PptxGenJS>, slide: PptxSlide) {
  const d = NATIVE_DECK;
  const contentBlockH = d.H - d.headerH - d.accentH - d.gapUnderHeader - d.footerStripH;
  const cardY = d.headerH + d.accentH + d.gapUnderHeader;
  const cardW = d.W - 2 * d.cardMarginX;
  const cardH = contentBlockH;
  slide.addShape(pptx.ShapeType.roundRect, {
    x: d.cardMarginX,
    y: cardY,
    w: cardW,
    h: cardH,
    fill: { color: d.cardFill },
    line: { color: d.cardLine, width: 0.75 },
    rectRadius: d.cardRadius
  });
  return { cardY, cardW, cardH, contentBlockH };
}

const CONTENT_BULLET_FONT_PT = 21;
const CONTENT_BULLET_LINE_SPACING_PT = 30;

/**
 * Odhad výšky bloku odrážek (PPTX) — záměrně horší případ (užší řádky, mezery odstavce),
 * aby poslední řádek nezasahoval pod tabulku/graf.
 */
/** Jedna odrážka na řádek — odstraní nadbytečné prefixy, aby se v PPTX neopakovaly symboly. */
function normalizeBulletLine(raw: string): string {
  const oneLine = raw.replace(/\s+/g, " ").trim();
  return oneLine.replace(/^[\s•\-\*·]+/, "").trim() || oneLine;
}

/** Minimální výška tabulky v in podle počtu řádků (14 pt, rezerva na wrapped buňky). */
function estimateTableHeightInches(rowCount: number): number {
  if (rowCount <= 0) return 0.4;
  const perRowIn = 0.3;
  return Math.min(4.6, perRowIn * rowCount + 0.12);
}

function estimateBulletBlockHeightInches(
  bullets: string[],
  textWidthInches: number,
  fontSizePt: number,
  lineSpacingPt: number
): number {
  const bulletIndentFactor = 0.92;
  const effectiveW = textWidthInches * bulletIndentFactor;
  const avgCharWInch = (fontSizePt / 72) * 0.56;
  const charsPerLine = Math.max(12, Math.floor(effectiveW / Math.max(0.015, avgCharWInch)));
  const lineStepIn = lineSpacingPt / 72;
  const paraGapIn = 12 / 72;
  let h = 0.14;
  for (const raw of bullets) {
    const b = raw.trim();
    const lines = Math.max(1, Math.ceil((b.length + 2) / charsPerLine));
    h += lines * lineStepIn + paraGapIn;
  }
  h += 0.16;
  return Math.min(4.35, h);
}

export async function buildNativeTypedPptxBuffer(deckTitle: string, slides: PresentationSlide[]): Promise<Buffer> {
  const pptx = new PptxGenJS();
  pptx.layout = "LAYOUT_WIDE";
  pptx.author = "Back Office Operations Agent";
  pptx.company = "Back Office Operations";
  const first = slides[0];
  const docTitle =
    first?.type === "title"
      ? first.title
      : deriveHeroTitle(
          deckTitle,
          first && "title" in first && typeof (first as { title?: string }).title === "string"
            ? (first as { title: string }).title
            : undefined
        );
  pptx.subject = docTitle;
  pptx.title = docTitle;

  defineSlideMasters(pptx);
  const d = NATIVE_DECK;

  slides.forEach((spec, index) => {
    const isHeroTitle = index === 0 && spec.type === "title";

    if (isHeroTitle) {
      const slide = pptx.addSlide({ masterName: BOA_TITLE_MASTER });
      slide.addShape(pptx.ShapeType.roundRect, {
        x: d.cardMarginX,
        y: 0.85,
        w: d.W - 2 * d.cardMarginX,
        h: d.H - 1.35,
        fill: { color: d.cardFill },
        line: { color: d.cardLine, width: 0.75 },
        rectRadius: d.cardRadius
      });
      slide.addText(spec.title, {
        x: d.cardMarginX + d.innerPadX,
        y: 2.15,
        w: d.W - 2 * (d.cardMarginX + d.innerPadX),
        h: 2.2,
        fontSize: 58,
        bold: true,
        color: d.headerFill,
        fontFace: "Calibri",
        align: "center",
        valign: "middle",
        shrinkText: true
      });
      if (spec.subtitle) {
        slide.addText(spec.subtitle, {
          x: d.cardMarginX + d.innerPadX,
          y: 4.35,
          w: d.W - 2 * (d.cardMarginX + d.innerPadX),
          h: 1.15,
          fontSize: 26,
          color: d.footerColor,
          fontFace: "Calibri",
          align: "center",
          valign: "top",
          italic: true
        });
      }
      addFooter(slide, deckTitle, index, slides.length);
      return;
    }

    const slide = pptx.addSlide({ masterName: BOA_CONTENT_MASTER });
    addHeaderTitle(slide, headerLineForSlide(spec, deckTitle));
    const { cardY, cardW, cardH } = contentCardBox(pptx, slide);
    const textX = d.cardMarginX + d.innerPadX;
    const textW = cardW - 2 * d.innerPadX;

    switch (spec.type) {
      case "title":
        break;
      case "section": {
        slide.addText(spec.title, {
          x: textX,
          y: cardY + 1.35,
          w: textW,
          h: 1.4,
          fontSize: 38,
          bold: true,
          color: d.headerFill,
          fontFace: "Calibri",
          valign: "middle",
          align: "center"
        });
        if (spec.subtitle) {
          slide.addText(spec.subtitle, {
            x: textX,
            y: cardY + 2.9,
            w: textW,
            h: 1,
            fontSize: 20,
            color: d.bodyColor,
            fontFace: "Calibri",
            align: "center",
            valign: "top"
          });
        }
        break;
      }
      case "content": {
        const contentTop = cardY + d.innerPadTop;
        /** Spodní okraj obsahu uvnitř karty — nic z obsahu nesmí přesáhnout (jinak „ujede“ ze slidu). */
        const contentBottom = cardY + cardH - 0.1;
        const maxInnerH = Math.max(0.5, contentBottom - contentTop);

        const gap = 0.2;
        const hasBullets = spec.bullets.length > 0;
        const tableRowsTotal = spec.table ? spec.table.rows.length + 1 : 0;
        const bulletBlockH = hasBullets
          ? Math.min(
              4.25,
              estimateBulletBlockHeightInches(spec.bullets, textW, CONTENT_BULLET_FONT_PT, CONTENT_BULLET_LINE_SPACING_PT)
            )
          : 0;
        const tableBlockH = spec.table ? estimateTableHeightInches(tableRowsTotal) : 0;
        const chartBlockH = spec.chart ? 2.85 : 0;

        const gapAfterBullets = hasBullets && (spec.table || spec.chart) ? gap : 0;
        const gapTableChart = spec.table && spec.chart ? gap : 0;

        let bh = bulletBlockH;
        let th = tableBlockH;
        let ch = chartBlockH;

        const MIN_CHART_H_IN = 1.72;
        if (spec.chart && ch > 0 && ch < MIN_CHART_H_IN) {
          const deficit = MIN_CHART_H_IN - ch;
          ch = MIN_CHART_H_IN;
          if (spec.table && th > deficit + 0.48) {
            th = Math.max(0.42, th - deficit * 0.72);
          } else if (bh > deficit + 0.55) {
            bh = Math.max(0.62, bh - deficit * 0.58);
          }
        }

        const totalGaps = gapAfterBullets + gapTableChart;
        const stackH = (hasBullets ? bh : 0) + (spec.table ? th : 0) + (spec.chart ? ch : 0) + totalGaps;

        if (stackH > maxInnerH && stackH > 0.01) {
          const minBh = hasBullets ? 0.58 : 0;
          const minTh = spec.table ? Math.max(0.42, 0.22 * tableRowsTotal) : 0;
          const minCh = spec.chart ? Math.max(1.15, MIN_CHART_H_IN * 0.65) : 0;
          const minSum = minBh + minTh + minCh + totalGaps;
          let room = maxInnerH - totalGaps;
          if (room <= 0.35) room = 0.35;

          if (minSum <= room + 1e-6) {
            let extra = room - minSum;
            // Rozdělit zbývající prostor proporcionálně původním váhám.
            const wB = hasBullets ? Math.max(0.2, bh - minBh) : 0;
            const wT = spec.table ? Math.max(0.2, th - minTh) : 0;
            const wC = spec.chart ? Math.max(0.2, ch - minCh) : 0;
            const wSum = wB + wT + wC || 1;
            bh = hasBullets ? minBh + extra * (wB / wSum) : 0;
            th = spec.table ? minTh + extra * (wT / wSum) : 0;
            ch = spec.chart ? minCh + extra * (wC / wSum) : 0;
          } else {
            let shrink = minSum - room;
            if (hasBullets && bh > minBh) {
              const t = Math.min(shrink, Math.max(0, bh - minBh));
              bh -= t;
              shrink -= t;
            }
            if (spec.table && th > minTh && shrink > 0) {
              const t = Math.min(shrink, Math.max(0, th - minTh));
              th -= t;
              shrink -= t;
            }
            if (spec.chart && ch > minCh && shrink > 0) {
              ch -= shrink;
            }
            if (hasBullets) bh = Math.max(minBh, bh);
            if (spec.table) th = Math.max(minTh, th);
            if (spec.chart) ch = Math.max(minCh, ch);
          }
        }

        let yNext = contentTop;

        if (hasBullets) {
          slide.addText(
            spec.bullets.map((b) => ({
              text: normalizeBulletLine(b),
              options: {
                bullet: true,
                fontSize: CONTENT_BULLET_FONT_PT,
                color: d.bodyColor,
                fontFace: "Calibri",
                paraSpaceBefore: 2,
                paraSpaceAfter: 4,
                lineSpacing: CONTENT_BULLET_LINE_SPACING_PT
              }
            })),
            {
              x: textX,
              y: yNext,
              w: textW,
              h: bh,
              valign: "top",
              fontFace: "Calibri"
            }
          );
          yNext += bh + (spec.table || spec.chart ? gap : 0);
        }

        if (spec.table) {
          const spaceLeft = contentBottom - yNext - (spec.chart ? gap + ch : 0);
          th = Math.min(th, Math.max(0, spaceLeft));
          const colCount = spec.table.headers.length;
          const colWEach = textW / colCount;
          const headerRow = spec.table.headers.map((h) => ({
            text: h,
            options: { bold: true, fill: { color: "E2E8F0" }, fontSize: 15 }
          }));
          const bodyRows = spec.table.rows.map((row) =>
            row.map((cell) => ({ text: cell, options: { fontSize: 14 } }))
          );
          const tableRowHeights = Array(tableRowsTotal).fill(th / tableRowsTotal);
          slide.addTable([headerRow, ...bodyRows], {
            x: textX,
            y: yNext,
            w: textW,
            h: th,
            colW: Array(colCount).fill(colWEach),
            rowH: tableRowHeights,
            border: { pt: 0.5, color: d.cardLine },
            fontFace: "Calibri",
            valign: "middle",
            align: "left",
            autoPage: false
          });
          yNext += th + (spec.chart ? gap : 0);
        }

        if (spec.chart) {
          const spaceLeft = contentBottom - yNext;
          ch = Math.min(ch, Math.max(0, spaceLeft));
          const chartData = spec.chart.series.map((s) => ({
            name: s.name,
            labels: spec.chart!.categories,
            values: s.values
          }));
          slide.addChart(
            spec.chart.kind === "line" ? pptx.ChartType.line : pptx.ChartType.bar,
            chartData,
            {
              x: textX,
              y: yNext,
              w: textW,
              h: ch,
              chartColors: ["3D9AE8", "163A59", "64748B"],
              showLegend: true,
              showTitle: true,
              title: spec.chart.title ?? spec.title,
              titleFontSize: 14,
              titleColor: d.bodyColor
            }
          );
        }
        break;
      }
      case "stats": {
        const cols = 2;
        const rowCount = Math.ceil(spec.stats.length / cols);
        const cellW = (textW - 0.4) / cols;
        const cellH = Math.min(1.35, (cardH - d.innerPadTop - 0.4) / Math.max(rowCount, 1));
        spec.stats.forEach((st, i) => {
          const col = i % cols;
          const row = Math.floor(i / cols);
          const cx = textX + col * (cellW + 0.2);
          const cy = cardY + d.innerPadTop + row * (cellH + 0.2);
          slide.addText(st.value, {
            x: cx,
            y: cy,
            w: cellW,
            h: 0.55,
            fontSize: 30,
            bold: true,
            color: d.accentFill,
            fontFace: "Calibri"
          });
          slide.addText(st.label, {
            x: cx,
            y: cy + 0.52,
            w: cellW,
            h: 0.55,
            fontSize: 14,
            color: d.footerColor,
            fontFace: "Calibri",
            valign: "top"
          });
        });
        break;
      }
      case "quote": {
        slide.addText(`„${spec.quote}“`, {
          x: textX,
          y: cardY + 0.85,
          w: textW,
          h: 3.2,
          fontSize: 23,
          color: d.bodyColor,
          fontFace: "Calibri",
          italic: true,
          valign: "top",
          lineSpacing: 30
        });
        if (spec.attribution) {
          slide.addText(`— ${spec.attribution}`, {
            x: textX,
            y: cardY + 4.2,
            w: textW,
            h: 0.45,
            fontSize: 13,
            color: d.footerColor,
            fontFace: "Calibri",
            align: "right"
          });
        }
        break;
      }
      default:
        break;
    }

    addFooter(slide, deckTitle, index, slides.length);
  });

  return (await pptx.write({ outputType: "nodebuffer" })) as Buffer;
}

let cachedNotoSansBytes: { regular: Uint8Array; bold: Uint8Array } | null = null;

function getNotoSansFontBytes(): { regular: Uint8Array; bold: Uint8Array } {
  if (cachedNotoSansBytes) return cachedNotoSansBytes;
  const base = path.join(process.cwd(), "assets", "fonts");
  const regularPath = path.join(base, "NotoSans-Regular.ttf");
  const boldPath = path.join(base, "NotoSans-Bold.ttf");
  if (!fs.existsSync(regularPath) || !fs.existsSync(boldPath)) {
    throw new Error(
      `PDF_UNICODE_FONTS_MISSING: Chybí ${regularPath} nebo ${boldPath}. V repu jsou pod assets/fonts (Noto Sans z googlefonts/noto-fonts, OFL).`
    );
  }
  cachedNotoSansBytes = {
    regular: new Uint8Array(fs.readFileSync(regularPath)),
    bold: new Uint8Array(fs.readFileSync(boldPath))
  };
  return cachedNotoSansBytes;
}

async function embedNotoSansFonts(pdf: PDFDocument) {
  pdf.registerFontkit(fontkit);
  const { regular, bold } = getNotoSansFontBytes();
  const font = await pdf.embedFont(regular, { subset: true });
  const boldFont = await pdf.embedFont(bold, { subset: true });
  return { font, boldFont };
}

function clipPdfCellText(raw: string, maxChars: number): string {
  const t = raw.replace(/\s+/g, " ").trim();
  if (t.length <= maxChars) return t;
  return `${t.slice(0, Math.max(1, maxChars - 1))}…`;
}

function wrapPdfTextToLines(text: string, font: PDFFont, size: number, maxWidth: number): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  if (words.length === 0) return [""];
  const lines: string[] = [];
  let cur = "";
  for (const w of words) {
    const trial = cur ? `${cur} ${w}` : w;
    if (font.widthOfTextAtSize(trial, size) <= maxWidth) cur = trial;
    else {
      if (cur) lines.push(cur);
      cur = w;
    }
  }
  if (cur) lines.push(cur);
  return lines;
}

function drawPdfTableBlock(params: {
  page: PDFPage;
  x: number;
  startY: number;
  width: number;
  bottomLim: number;
  headers: string[];
  rows: string[][];
  font: PDFFont;
  bold: PDFFont;
  bodyFill: ReturnType<typeof rgb>;
  headerInk: ReturnType<typeof rgb>;
}): number {
  const rowCount = params.rows.length + 1;
  const colCount = params.headers.length;
  if (colCount === 0) return params.startY;
  const colW = params.width / colCount;
  const rowH = Math.min(28, Math.max(18, (params.startY - params.bottomLim - 16) / Math.max(rowCount, 1)));
  const headerBg = rgb(226 / 255, 232 / 255, 240 / 255);
  const border = rgb(148 / 255, 163 / 255, 184 / 255);
  let yTop = params.startY;
  for (let ri = 0; ri < rowCount; ri += 1) {
    const yRowBottom = yTop - rowH;
    for (let ci = 0; ci < colCount; ci += 1) {
      const cellX = params.x + ci * colW;
      const raw = ri === 0 ? params.headers[ci]! : params.rows[ri - 1]![ci] ?? "";
      const text = clipPdfCellText(String(raw), 64);
      if (ri === 0) {
        params.page.drawRectangle({
          x: cellX,
          y: yRowBottom,
          width: colW,
          height: rowH,
          color: headerBg,
          borderColor: border,
          borderWidth: 0.5
        });
        params.page.drawText(text, {
          x: cellX + 5,
          y: yRowBottom + rowH * 0.28,
          size: 13,
          font: params.bold,
          color: params.headerInk,
          maxWidth: colW - 10,
          lineHeight: 15
        });
      } else {
        params.page.drawRectangle({
          x: cellX,
          y: yRowBottom,
          width: colW,
          height: rowH,
          color: rgb(1, 1, 1),
          borderColor: border,
          borderWidth: 0.5
        });
        params.page.drawText(text, {
          x: cellX + 5,
          y: yRowBottom + rowH * 0.28,
          size: 12,
          font: params.font,
          color: params.bodyFill,
          maxWidth: colW - 10,
          lineHeight: 14
        });
      }
    }
    yTop -= rowH;
  }
  return yTop - 12;
}

type ChartSpec = NonNullable<Extract<PresentationSlide, { type: "content" }>["chart"]>;

function drawPdfChartBlock(params: {
  page: PDFPage;
  x: number;
  topY: number;
  width: number;
  bottomLim: number;
  chart: ChartSpec;
  font: PDFFont;
  bold: PDFFont;
  accent: ReturnType<typeof rgb>;
  bodyFill: ReturnType<typeof rgb>;
  headerInk: ReturnType<typeof rgb>;
}): void {
  const { chart } = params;
  const title = chart.title?.trim();
  let y = params.topY;
  if (title) {
    params.page.drawText(title, {
      x: params.x,
      y,
      size: 13,
      font: params.bold,
      color: params.headerInk,
      maxWidth: params.width,
      lineHeight: 16
    });
    y -= 24;
  }

  let legX = params.x;
  const legY = y;
  for (let si = 0; si < chart.series.length; si += 1) {
    const ser = chart.series[si]!;
    const colors = [
      params.accent,
      rgb(22 / 255, 58 / 255, 89 / 255),
      rgb(100 / 255, 116 / 255, 139 / 255)
    ];
    const c = colors[si % colors.length]!;
    params.page.drawRectangle({ x: legX, y: legY - 10, width: 8, height: 8, color: c });
    const w = params.font.widthOfTextAtSize(clipPdfCellText(ser.name, 28), 8);
    params.page.drawText(clipPdfCellText(ser.name, 28), {
      x: legX + 12,
      y: legY - 8,
      size: 8,
      font: params.font,
      color: params.bodyFill,
      maxWidth: 120,
      lineHeight: 9
    });
    legX += 18 + Math.min(w, 120) + 16;
  }
  y = legY - 26;

  const labelH = 22;
  const plotH = Math.min(150, Math.max(72, y - params.bottomLim - labelH - 8));
  const plotYBase = params.bottomLim + labelH;
  const n = chart.categories.length;
  const groupW = params.width / Math.max(n, 1);
  const allVals = chart.series.flatMap((s) => s.values);
  const maxV = Math.max(0.001, ...allVals.map((v) => Math.abs(v)));
  const seriesColors = [
    params.accent,
    rgb(22 / 255, 58 / 255, 89 / 255),
    rgb(100 / 255, 116 / 255, 139 / 255)
  ];

  if (chart.kind === "bar") {
    const nSer = chart.series.length;
    const innerW = groupW * 0.72;
    const barW = innerW / Math.max(nSer, 1);
    for (let j = 0; j < n; j += 1) {
      const gx = params.x + j * groupW + groupW * 0.08;
      for (let si = 0; si < nSer; si += 1) {
        const val = chart.series[si]!.values[j] ?? 0;
        const bh = (Math.max(0, val) / maxV) * plotH;
        const bx = gx + si * barW;
        params.page.drawRectangle({
          x: bx,
          y: plotYBase,
          width: barW * 0.92,
          height: Math.max(1, bh),
          color: seriesColors[si % seriesColors.length]!
        });
      }
      const lab = clipPdfCellText(chart.categories[j] ?? "", 14);
      params.page.drawText(lab, {
        x: params.x + j * groupW + 2,
        y: plotYBase - 8,
        size: 8,
        font: params.font,
        color: params.bodyFill,
        maxWidth: groupW - 4,
        lineHeight: 9
      });
    }
  } else {
    const step = groupW;
    for (let si = 0; si < chart.series.length; si += 1) {
      const ser = chart.series[si]!;
      const c = seriesColors[si % seriesColors.length]!;
      for (let j = 0; j < n - 1; j += 1) {
        const v0 = ser.values[j] ?? 0;
        const v1 = ser.values[j + 1] ?? 0;
        const x0 = params.x + j * step + step * 0.5;
        const x1 = params.x + (j + 1) * step + step * 0.5;
        const y0 = plotYBase + (Math.max(0, v0) / maxV) * plotH;
        const y1 = plotYBase + (Math.max(0, v1) / maxV) * plotH;
        params.page.drawLine({
          start: { x: x0, y: y0 },
          end: { x: x1, y: y1 },
          thickness: 2,
          color: c
        });
      }
    }
    for (let j = 0; j < n; j += 1) {
      const lab = clipPdfCellText(chart.categories[j] ?? "", 14);
      params.page.drawText(lab, {
        x: params.x + j * groupW + 2,
        y: plotYBase - 8,
        size: 8,
        font: params.font,
        color: params.bodyFill,
        maxWidth: groupW - 4,
        lineHeight: 9
      });
    }
  }
}

export async function generateSkippedPdfPlaceholder(): Promise<Buffer> {
  const pdf = await PDFDocument.create();
  const { font } = await embedNotoSansFonts(pdf);
  const page = pdf.addPage([595, 420]);
  const msg =
    "PDF export byl vypnut (PRESENTATION_SKIP_PDF). Stáhněte prosím vygenerovaný soubor .pptx ze Storage (prezentace-boa.pptx) pro aktuální obsah.";
  page.drawText(msg, { x: 40, y: 360, size: 11, font, maxWidth: 520, lineHeight: 13 });
  return Buffer.from(await pdf.save());
}

export async function generateTypedPdfBuffer(params: {
  title: string;
  slides: PresentationSlide[];
}): Promise<Buffer> {
  const pdf = await PDFDocument.create();
  const { font, boldFont: bold } = await embedNotoSansFonts(pdf);

  const bodyFill = rgb(30 / 255, 41 / 255, 59 / 255);
  const footerMuted = rgb(100 / 255, 116 / 255, 139 / 255);
  const accentRgb = rgb(61 / 255, 154 / 255, 232 / 255);
  const pageBg = rgb(221 / 255, 231 / 255, 240 / 255);
  const headerFill = rgb(22 / 255, 58 / 255, 89 / 255);
  const accentFill = rgb(61 / 255, 154 / 255, 232 / 255);
  const cardBorder = rgb(148 / 255, 163 / 255, 184 / 255);

  for (let index = 0; index < params.slides.length; index += 1) {
    const spec = params.slides[index]!;
    const page = pdf.addPage([842, 595]);
    const { width, height } = page.getSize();

    const cardPad = 26;
    const heroTitle = index === 0 && spec.type === "title";

    page.drawRectangle({ x: 0, y: 0, width, height, color: pageBg });
    page.drawRectangle({ x: 0, y: 8, width, height: 4, color: accentFill });

    if (heroTitle) {
      const cardH = height * 0.62;
      const cardY = height * 0.22;
      const heroTextW = width - 2 * cardPad - 64;
      const heroTextX = (width - heroTextW) / 2;
      page.drawRectangle({
        x: cardPad,
        y: cardY,
        width: width - 2 * cardPad,
        height: cardH,
        color: rgb(1, 1, 1),
        borderColor: cardBorder,
        borderWidth: 0.75
      });
      page.drawText(spec.title, {
        x: heroTextX,
        y: cardY + cardH * 0.52,
        size: 42,
        font: bold,
        color: bodyFill,
        maxWidth: heroTextW,
        lineHeight: 48
      });
      if (spec.subtitle) {
        page.drawText(spec.subtitle, {
          x: heroTextX,
          y: cardY + cardH * 0.22,
          size: 17,
          font,
          color: footerMuted,
          maxWidth: heroTextW,
          lineHeight: 21
        });
      }
    } else {
      const headerH = 72;
      const accentH = 5;
      page.drawRectangle({ x: 0, y: height - headerH, width, height: headerH, color: headerFill });
      page.drawRectangle({ x: 0, y: height - headerH - accentH, width, height: accentH, color: accentFill });

      const cardTop = height - headerH - accentH - 14;
      const cardBottom = 34;
      page.drawRectangle({
        x: cardPad,
        y: cardBottom,
        width: width - 2 * cardPad,
        height: cardTop - cardBottom,
        color: rgb(1, 1, 1),
        borderColor: cardBorder,
        borderWidth: 0.75
      });

      const head = headerLineForSlide(spec, params.title);
      page.drawText(head, {
        x: cardPad + 10,
        y: height - 50,
        size: 22,
        font: bold,
        color: rgb(1, 1, 1),
        maxWidth: width - 2 * cardPad - 20,
        lineHeight: 26
      });

      const textLeft = cardPad + 28;
      const textW = width - textLeft - cardPad - 16;
      let y = cardTop - 28;

      switch (spec.type) {
      case "title":
        break;
      case "section":
        page.drawText(spec.title, {
          x: textLeft,
          y: cardTop - 48,
          size: 28,
          font: bold,
          color: headerFill,
          maxWidth: textW,
          lineHeight: 33
        });
        if (spec.subtitle) {
          page.drawText(spec.subtitle, {
            x: textLeft,
            y: cardTop - 110,
            size: 14,
            font,
            color: bodyFill,
            maxWidth: textW,
            lineHeight: 18
          });
        }
        break;
      case "content": {
        const bottomLim = cardBottom + 56;
        const gap = 12;
        const hangPt = 14;
        const innerW = textW - hangPt;
        const hasB = spec.bullets.length > 0;
        const hasT = spec.table != null;
        const hasC = spec.chart != null;
        const approxBulletPt = 17;
        let bulletEst = 0;
        if (hasB) {
          for (const bullet of spec.bullets) {
            const lines = wrapPdfTextToLines(bullet.trim(), font, approxBulletPt, innerW).length;
            bulletEst += lines * (approxBulletPt + 5) + 7;
          }
        }
        let est = bulletEst;
        if (hasT && spec.table) est += (spec.table.rows.length + 1) * 22 + 20;
        if (hasC) est += 200;
        const avail = Math.max(40, y - bottomLim);
        const scale = est > avail && est > 0 ? Math.max(0.58, Math.min(1, avail / est)) : 1;
        const bulletSize = Math.round(11 + 9 * scale);
        const lineStep = bulletSize + 5;

        if (hasB) {
          for (const bullet of spec.bullets) {
            const lines = wrapPdfTextToLines(bullet.trim(), font, bulletSize, innerW);
            for (let li = 0; li < lines.length; li += 1) {
              const line = lines[li]!;
              const prefix = li === 0 ? "• " : "";
              const lx = li === 0 ? textLeft : textLeft + hangPt;
              page.drawText(`${prefix}${line}`, {
                x: lx,
                y,
                size: bulletSize,
                font,
                color: bodyFill,
                maxWidth: li === 0 ? textW : innerW + hangPt,
                lineHeight: lineStep
              });
              y -= lineStep;
            }
            y -= 6;
          }
          if (hasT || hasC) y -= gap;
        }

        if (hasT && spec.table) {
          y = drawPdfTableBlock({
            page,
            x: textLeft,
            startY: y,
            width: textW,
            bottomLim,
            headers: spec.table.headers,
            rows: spec.table.rows,
            font,
            bold,
            bodyFill,
            headerInk: headerFill
          });
          if (hasC) y -= gap;
        }

        if (hasC && spec.chart) {
          drawPdfChartBlock({
            page,
            x: textLeft,
            topY: y,
            width: textW,
            bottomLim,
            chart: spec.chart,
            font,
            bold,
            accent: accentRgb,
            bodyFill,
            headerInk: headerFill
          });
        }
        break;
      }
      case "stats":
        spec.stats.forEach((st) => {
          page.drawText(st.value, { x: textLeft, y, size: 17, font: bold, color: accentRgb, maxWidth: textW });
          y -= 20;
          page.drawText(st.label, { x: textLeft, y, size: 11, font, color: footerMuted, maxWidth: textW });
          y -= 24;
        });
        break;
      case "quote":
        page.drawText(`„${spec.quote}“`, {
          x: textLeft,
          y: cardTop - 36,
          size: 14,
          font,
          color: bodyFill,
          maxWidth: textW,
          lineHeight: 18
        });
        if (spec.attribution) {
          page.drawText(`— ${spec.attribution}`, {
            x: textLeft,
            y: cardBottom + 40,
            size: 11,
            font,
            color: footerMuted,
            maxWidth: textW
          });
        }
        break;
      default:
        break;
    }
    }

    page.drawText(params.title.slice(0, 96), {
      x: cardPad,
      y: 22,
      size: 8,
      font,
      color: footerMuted,
      maxWidth: width - cardPad - 70
    });
    page.drawText(`${index + 1} / ${params.slides.length}`, {
      x: width - cardPad - 50,
      y: 22,
      size: 8,
      font,
      color: footerMuted
    });
  }

  return Buffer.from(await pdf.save());
}
