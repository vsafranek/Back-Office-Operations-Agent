import { z } from "zod";
import { WEEKLY_REPORT_DEFAULT_SLIDE_COUNT } from "@/lib/agent/defaults";
import { generateWithAzureProxy } from "@/lib/llm/azure-proxy-provider";
import { getEnv } from "@/lib/config/env";
import { resolvePresentationTemplate } from "@/lib/config/presentation-template";
import { logger } from "@/lib/observability/logger";
import { ensurePublicStorageBucket } from "@/lib/supabase/ensure-storage-bucket";
import { getSupabaseAdminClient } from "@/lib/supabase/server-client";
import { generatePptxFromBlueWhiteTemplate } from "@/lib/agent/tools/presentation-from-template";
import {
  type PresentationSlide,
  MAX_DECK_SLIDES,
  buildFallbackPresentationSlides,
  buildNativeTypedPptxBuffer,
  clampPresentationSlidesForNative,
  clampPresentationSlidesForTemplate,
  ensureOpeningTitleSlide,
  expandDenseContentSlides,
  ensureContentSlidesMeetMinBullets,
  generateSkippedPdfPlaceholder,
  generateTypedPdfBuffer,
  parsePresentationSlidesFromLlmJson,
  presentationSlideSchema,
  presentationSlidesToTemplateSpecs,
  stripLeadingTitleSlides
} from "@/lib/agent/tools/presentation-typed-deck";
import { inferSlideCountFromUserText } from "@/lib/agent/llm/intent-heuristics";

export type { PresentationSlide };

export type PresentationArtifactInput = {
  runId: string;
  title: string;
  rows: Record<string, unknown>[];
  context?: string;
  slideCount?: number;
  /** false = bez titulního úvodního slidu (podle nastavení uživatele). Výchozí true. */
  includeOpeningTitleSlide?: boolean;
};

export type PresentationArtifactOutput = {
  publicUrl: string;
  pdfPublicUrl: string;
  slides: PresentationSlide[];
  /** Prefix složky v bucketu (např. `reports/prezentace/tydenni-report-abc123`) — otevření ve Storage `/storage?prefix=…`. */
  storagePrefix: string;
};

const PresentationArtifactInputSchema = z.object({
  runId: z.string().min(3),
  title: z.string().min(3).max(120),
  rows: z.array(z.record(z.string(), z.unknown())).default([]),
  context: z.string().max(2000).optional(),
  /** Počet obsahových slidů (bez titulního); celkem stran = +1 titulek. */
  slideCount: z.coerce.number().int().min(1).max(14).optional(),
  includeOpeningTitleSlide: z.boolean().optional()
});

const PresentationArtifactOutputSchema = z.object({
  publicUrl: z.string().url(),
  pdfPublicUrl: z.string().url(),
  slides: z.array(presentationSlideSchema).min(2).max(MAX_DECK_SLIDES),
  storagePrefix: z.string().min(3)
});

/** Názvy souborů v Storage (odlišné od generického „presentation“). */
export const PRESENTATION_STORAGE_PPTX_NAME = "prezentace-boa.pptx";
export const PRESENTATION_STORAGE_PDF_NAME = "shrnuti-boa.pdf";

/** Složka `reports/prezentace/{slug}-{run}` podle tématu a běhu. */
export function presentationArtifactStoragePrefix(runId: string, deckTitle: string): string {
  const slug =
    deckTitle
      .trim()
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 42) || "prezentace";
  const rid = runId.replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 20);
  return `reports/prezentace/${slug}-${rid}`;
}

export const presentationToolContract = {
  role: "subagent" as const,
  name: "runPresentationAgent",
  auth: "service-role" as const,
  description:
    "Prezentacni specialista (MCP subagent): z tabulkovych radku a zadani vygeneruje PPTX + PDF v cestine a nahraje do Supabase Storage pod reports/prezentace/{tema}-{run}/ (soubory prezentace-boa.pptx, shrnuti-boa.pdf). " +
    "LLM vraci strukturovane slidy (type: title|content|stats|quote|section); vzhled resi kod (Slide Master + typovane layouty). " +
    "PPTX bud vlastni deck (pptxgenjs) nebo pri PRESENTATION_USE_TEMPLATE=true externi sablona. " +
    "Pred volanim lze zjistit dalsi nastroje pres listMcpCapabilities.",
  inputSchema: PresentationArtifactInputSchema,
  outputSchema: PresentationArtifactOutputSchema,
  sideEffects: ["Storage upload (PPTX + PDF) do bucketu env.SUPABASE_STORAGE_BUCKET"],
  errorModel: [
    { code: "INVALID_INPUT", meaning: "Vstupy nesplnuji schema (napr. title/slideCount)." },
    { code: "STORAGE_BUCKET_INIT_FAILED", meaning: "Nepodarilo se inicializovat Storage bucket." },
    { code: "PRESENTATION_UPLOAD_FAILED", meaning: "Nepodarilo se nahrat PPTX/PDF do Storage." },
    { code: "LLM_FAILED", meaning: "LLM selhalo/timeoutovalo; pouzije se fallback generovani obsahu." }
  ]
};

/** Doporučený počet obsahových slidů z rozsahu dat a délky kontextu (volá se jen když uživatel v textu neřekl „N slidy“). */
function boostContentSlideCountFromPayload(rowsLen: number, contextChars: number): number {
  let c = 4;
  if (rowsLen >= 22) c = 8;
  else if (rowsLen >= 14) c = 7;
  else if (rowsLen >= 8) c = 6;
  else if (rowsLen >= 5) c = 5;
  if (contextChars > 1400) c += 2;
  else if (contextChars > 700) c += 1;
  return Math.min(14, c);
}

const SLIDE_JSON_INSTRUCTIONS = `Kazdy prvek pole je objekt s polem \"type\" a podle typu dalsi pole:
- {\"type\":\"title\",\"title\":\"...\",\"subtitle\":\"...volitelne\"} — prvni slide MUSI byt type title. Pole \"title\": strucny nazev tematu (2–6 slov, max ~40 znaku), NIKOLIV cele uzivatelske zadani ani dlouha veta; \"subtitle\" muze doplnit kontext.
- {\"type\":\"content\",\"title\":\"...\",\"bullets\":[\"...\"], \"table\":...,\"chart\":... } — aspon 3 bullets NEBO tabulka NEBO graf; na JEDNOM content slidu maximalne 5 odracek; pokud je tabulka nebo graf, maximalne 4 odracky; pokud tabulka i graf, maximalne 3. Vice bodu rozdel do DALSIHO content slidu (vic polozek v JSON poli). table/chart volitelne, kategorie a values u grafu stejna delka.
- {\"type\":\"stats\",\"title\":\"...\",\"stats\":[{\"value\":\"...\",\"label\":\"...\"}] } — 2 az 6 paru (napr. hodnota KPI + popisek).
- {\"type\":\"quote\",\"quote\":\"...\",\"title\":\"...volitelne\",\"attribution\":\"...volitelne\"}
- {\"type\":\"section\",\"title\":\"...\",\"subtitle\":\"...volitelne\"} — deli sekce, velky nadpis.

Nikdy nevkladaj cele JSON objekty ani technicke dvojice „sloupec: hodnota“ (id:, listed_price:, …). Kazdy radek tabulky prevezmi do 1–2 prirozenych vet v cestine (nazev, mesto, cena v Kc, stav rekonstrukce). Pis vyhradne cesky. Zadny markdown, zadny text mimo JSON.`;

const SLIDE_JSON_INSTRUCTIONS_NO_OPENING = `Kazdy prvek pole je objekt s polem \"type\" a podle typu dalsi pole:
- ZADNY slide s type \"title\" — vsechny slidy jsonou pouze content, stats, quote nebo section.
- {\"type\":\"content\",\"title\":\"...\",\"bullets\":[\"...\"], \"table\":...,\"chart\":... } — aspon 3 bullets NEBO tabulka NEBO graf; na jednom slidu max 5 odracek (s tabulkou/grafem max 4/3), jinak dalsi slide.
- {\"type\":\"stats\",\"title\":\"...\",\"stats\":[{\"value\":\"...\",\"label\":\"...\"}] } — 2 az 6 paru.
- {\"type\":\"quote\",\"quote\":\"...\",\"title\":\"...volitelne\",\"attribution\":\"...volitelne\"}
- {\"type\":\"section\",\"title\":\"...\",\"subtitle\":\"...volitelne\"}

Nikdy nevkladaj cele JSON objekty jako odrázky; pouze čitelné věty. Pis vyhradne cesky. Zadny markdown, zadny text mimo JSON.`;

async function buildPresentationSlides(params: {
  runId: string;
  title: string;
  rows: Record<string, unknown>[];
  context?: string;
  slideCount: number;
  layoutMode: "styled_slide" | "branded_template";
  includeOpeningTitleSlide: boolean;
}) {
  const sample = params.rows.slice(0, 16);
  const maxTokens = Math.min(2200, Math.max(900, params.slideCount * 220));
  const weeklyDeckHint =
    params.slideCount >= 6 && params.includeOpeningTitleSlide
      ? "\nMas vice slidů: rozloz temata logicky (KPI, trend, rizika, odporuceni…), na kazdem content slidu jen par odracek.\n"
      : params.slideCount >= 5 && !params.includeOpeningTitleSlide
        ? "\nBez titulku — rozdel obsah na vice obsahovych slidů, na jednom slidě malo bodů.\n"
        : "";
  const templateHint =
    params.layoutMode === "branded_template"
      ? " Sablona PPTX ma omezeny prostor: u content zvol kratsi titulky (~55 znaku) a kratsi body (~140 znaku). "
      : "";
  const styledHint =
    params.layoutMode === "styled_slide"
      ? params.includeOpeningTitleSlide
        ? " Vystup bude kreslen podle typu slidu — drz title/subtitle strucne; u content maximalne 5 odracek na slide (s tabulkou max 4, s tabulkou i grafem max 3), jinak pridej dalsi content slide. Kazdy bod jedna myslenka (~do 200 znaku). "
        : " Vystup bez titulniho slidu — stejna pravidla poctu odracek na slide jako vyse; vice slidů s malo body. "
      : "";

  let llmText = "";
  try {
    const llm = await generateWithAzureProxy({
      runId: params.runId,
      maxTokens,
      messages: [
        {
          role: "system",
          content:
            (params.includeOpeningTitleSlide
              ? `Jsi senior analytik. Vrat POUZE validni JSON pole presne delky ${params.slideCount} (prvni prvek = titulek, zbytek obsahove slidy). `
              : `Jsi senior analytik. Vrat POUZE validni JSON pole presne delky ${params.slideCount} (vsechny slidy jsou obsahove — BEZ type title). `) +
            (params.includeOpeningTitleSlide ? SLIDE_JSON_INSTRUCTIONS : SLIDE_JSON_INSTRUCTIONS_NO_OPENING) +
            templateHint +
            styledHint
        },
        {
          role: "user",
          content:
            `Interni nazev decku / metadata: ${params.title}\n` +
            (params.includeOpeningTitleSlide
              ? `Celkovy pocet slidu v poli (titulek + obsah): ${params.slideCount}\n`
              : `Celkovy pocet slidu v poli (jen obsahove, bez titulku): ${params.slideCount}\n`) +
            `Kontext: ${params.context ?? "tydenni executive report"}\n` +
            weeklyDeckHint +
            `Ukazka dat:\n${JSON.stringify(sample)}`
        }
      ]
    });
    llmText = llm.text.trim();
  } catch {
    return buildFallbackPresentationSlides(params.rows, params.slideCount, params.title, {
      includeOpeningTitleSlide: params.includeOpeningTitleSlide
    });
  }

  let parsed: unknown = null;
  try {
    parsed = JSON.parse(llmText);
  } catch {
    const match = llmText.match(/\[[\s\S]*\]/);
    if (match) {
      try {
        parsed = JSON.parse(match[0]!);
      } catch {
        parsed = null;
      }
    }
  }

  const validated = parsePresentationSlidesFromLlmJson(parsed, params.slideCount);
  return (
    validated ??
    buildFallbackPresentationSlides(params.rows, params.slideCount, params.title, {
      includeOpeningTitleSlide: params.includeOpeningTitleSlide
    })
  );
}

export async function generatePresentationArtifact(params: PresentationArtifactInput): Promise<PresentationArtifactOutput> {
  const parsedInput = PresentationArtifactInputSchema.safeParse(params);
  if (!parsedInput.success) {
    throw new Error(`INVALID_INPUT: ${parsedInput.error.issues.map((i) => i.message).join("; ")}`);
  }

  const env = getEnv();
  const supabase = getSupabaseAdminClient();
  const bucketName = env.SUPABASE_STORAGE_BUCKET;
  await ensurePublicStorageBucket(supabase, bucketName);

  const includeOpening = parsedInput.data.includeOpeningTitleSlide !== false;
  const ctxText = parsedInput.data.context ?? "";
  const explicitSlidesFromQuestion = inferSlideCountFromUserText(ctxText);

  let contentSlideCount = Math.min(14, Math.max(1, parsedInput.data.slideCount ?? WEEKLY_REPORT_DEFAULT_SLIDE_COUNT));
  if (explicitSlidesFromQuestion !== undefined) {
    contentSlideCount = Math.min(14, explicitSlidesFromQuestion);
  } else {
    const boosted = boostContentSlideCountFromPayload(parsedInput.data.rows.length, ctxText.length);
    contentSlideCount = Math.min(14, Math.max(contentSlideCount, boosted));
  }
  if (!includeOpening && contentSlideCount < 2) contentSlideCount = 2;
  const totalSlideCount = Math.min(MAX_DECK_SLIDES, includeOpening ? contentSlideCount + 1 : contentSlideCount);
  const templateCfg = resolvePresentationTemplate(env);
  const slidesRaw = await buildPresentationSlides({
    ...parsedInput.data,
    slideCount: totalSlideCount,
    layoutMode: templateCfg.useTemplate ? "branded_template" : "styled_slide",
    includeOpeningTitleSlide: includeOpening
  });
  let slidesOrdered = includeOpening
    ? ensureOpeningTitleSlide(slidesRaw, parsedInput.data.title, totalSlideCount)
    : stripLeadingTitleSlides(slidesRaw).slice(0, totalSlideCount);
  slidesOrdered = expandDenseContentSlides(slidesOrdered, MAX_DECK_SLIDES);
  if (slidesOrdered.length < 2) {
    slidesOrdered = buildFallbackPresentationSlides(
      parsedInput.data.rows,
      totalSlideCount,
      parsedInput.data.title,
      { includeOpeningTitleSlide: includeOpening }
    );
  }
  let slides = templateCfg.useTemplate
    ? clampPresentationSlidesForTemplate(slidesOrdered)
    : clampPresentationSlidesForNative(slidesOrdered);
  slides = ensureContentSlidesMeetMinBullets(slides);

  const useFlag = env.PRESENTATION_USE_TEMPLATE?.trim().toLowerCase();
  const templateForcedOn = useFlag === "true" || useFlag === "1" || useFlag === "yes" || useFlag === "on";
  if (templateForcedOn && !templateCfg.useTemplate) {
    logger.warn("presentation_template_missing", { path: templateCfg.resolvedTemplatePath });
  }

  let buffer: Buffer;
  if (templateCfg.useTemplate) {
    buffer = await generatePptxFromBlueWhiteTemplate({
      templatePath: templateCfg.resolvedTemplatePath,
      titleSlideIndex: templateCfg.titleSlideIndex,
      contentSlideIndex: templateCfg.contentSlideIndex,
      deckTitle: parsedInput.data.title,
      deckSubtitle: (env.PRESENTATION_DECK_SUBTITLE ?? "Back Office · report").trim().slice(0, 120),
      deckTagline:
        (parsedInput.data.context ?? "Týdenní executive report").slice(0, 220) ||
        "Automaticky generovaný report.",
      slides: presentationSlidesToTemplateSpecs(slides)
    });
  } else {
    buffer = await buildNativeTypedPptxBuffer(parsedInput.data.title, slides);
  }

  const storagePrefix = presentationArtifactStoragePrefix(parsedInput.data.runId, parsedInput.data.title);
  const pptxPath = `${storagePrefix}/${PRESENTATION_STORAGE_PPTX_NAME}`;
  const upload = await supabase.storage.from(bucketName).upload(pptxPath, buffer, {
    upsert: true,
    contentType: "application/vnd.openxmlformats-officedocument.presentationml.presentation"
  });
  if (upload.error) {
    throw new Error(`PRESENTATION_UPLOAD_FAILED: ${upload.error.message}`);
  }

  let pdfBuffer: Buffer;
  if (templateCfg.skipPdf) {
    pdfBuffer = await generateSkippedPdfPlaceholder();
  } else {
    if (templateCfg.useTemplate) {
      logger.warn("presentation_pdf_not_template_layout", {
        runId: parsedInput.data.runId,
        message: "PDF je generovany pres pdf-lib ze stejnych slid spec; layout muze odlisovat od externi PPTX sablony."
      });
    }
    pdfBuffer = await generateTypedPdfBuffer({ title: parsedInput.data.title, slides });
  }

  const pdfPath = `${storagePrefix}/${PRESENTATION_STORAGE_PDF_NAME}`;
  const pdfUpload = await supabase.storage.from(bucketName).upload(pdfPath, pdfBuffer, {
    upsert: true,
    contentType: "application/pdf"
  });
  if (pdfUpload.error) {
    throw new Error(`PRESENTATION_UPLOAD_FAILED: ${pdfUpload.error.message}`);
  }

  const publicUrl = supabase.storage.from(bucketName).getPublicUrl(pptxPath).data.publicUrl;
  const pdfPublicUrl = supabase.storage.from(bucketName).getPublicUrl(pdfPath).data.publicUrl;

  const output: PresentationArtifactOutput = { publicUrl, pdfPublicUrl, slides, storagePrefix };
  const checked = PresentationArtifactOutputSchema.safeParse(output);
  if (!checked.success) {
    throw new Error(`INVALID_OUTPUT: ${checked.error.issues.map((i) => i.message).join("; ")}`);
  }
  return checked.data;
}
