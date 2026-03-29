import PptxGenJS from "pptxgenjs";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { z } from "zod";
import { WEEKLY_REPORT_DEFAULT_SLIDE_COUNT } from "@/lib/agent/defaults";
import { generateWithAzureProxy } from "@/lib/llm/azure-proxy-provider";
import { getEnv } from "@/lib/config/env";
import { resolvePresentationTemplate } from "@/lib/config/presentation-template";
import { logger } from "@/lib/observability/logger";
import { ensurePublicStorageBucket } from "@/lib/supabase/ensure-storage-bucket";
import { getSupabaseAdminClient } from "@/lib/supabase/server-client";
import { generatePptxFromBlueWhiteTemplate } from "@/lib/agent/tools/presentation-from-template";

type SlideSpec = {
  title: string;
  bullets: string[];
};

export type PresentationArtifactInput = {
  runId: string;
  title: string;
  rows: Record<string, unknown>[];
  context?: string;
  slideCount?: number;
};

export type PresentationArtifactOutput = {
  publicUrl: string;
  pdfPublicUrl: string;
  slides: SlideSpec[];
};

const SlideSpecSchema = z.object({
  title: z.string().min(1),
  bullets: z.array(z.string().min(1)).min(4).max(8)
});

const PresentationArtifactInputSchema = z.object({
  runId: z.string().min(3),
  title: z.string().min(3).max(120),
  rows: z.array(z.record(z.string(), z.unknown())).default([]),
  context: z.string().max(2000).optional(),
  slideCount: z.coerce.number().int().min(2).max(15).optional()
});

const PresentationArtifactOutputSchema = z.object({
  publicUrl: z.string().url(),
  pdfPublicUrl: z.string().url(),
  slides: z.array(SlideSpecSchema)
});

export const presentationToolContract = {
  role: "subagent" as const,
  name: "runPresentationAgent",
  auth: "service-role" as const,
  description:
    "Prezentacni specialista (MCP subagent): z tabulkovych radku a zadani vygeneruje PPTX + PDF v cestine a nahraje do Supabase Storage (reports/{runId}/). " +
    "Vstupy: runId, title (nazev decku), rows (data pro obsah slidů), volitelne context (ukol/tagline pro titulni slide a LLM), slideCount 2-15. " +
    "Pokud je k dispozici PPTX šablona (env PRESENTATION_*), vystupni PPTX pouzije firemni layout ({{BOA_*}}). " +
    "PDF je jednoduchy export ze stejnych bulletu (vizualne muze odlisovat od šablony) nebo PRESENTATION_SKIP_PDF. " +
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

function toSafeSlideSpecs(value: unknown, expectedCount: number): SlideSpec[] | null {
  if (!Array.isArray(value)) return null;
  const cleaned = value
    .slice(0, expectedCount)
    .map((item) => {
      if (!item || typeof item !== "object") return null;
      const rawTitle = (item as { title?: unknown }).title;
      const rawBullets = (item as { bullets?: unknown }).bullets;
      const title = typeof rawTitle === "string" ? rawTitle.trim() : "";
      const bullets = Array.isArray(rawBullets)
        ? rawBullets.filter((v): v is string => typeof v === "string").map((v) => v.trim()).filter(Boolean)
        : [];
      if (!title) return null;
      const trimmedBullets = bullets.slice(0, 8);
      if (trimmedBullets.length < 4) return null;
      return { title, bullets: trimmedBullets };
    })
    .filter((item): item is SlideSpec => Boolean(item));
  return cleaned.length === expectedCount ? cleaned : null;
}

function safeNum(value: unknown): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function buildFallbackSlides(rows: Record<string, unknown>[], slideCount: number): SlideSpec[] {
  const months = rows.map((row) => String(row.month ?? "n/a"));
  const totalLeads = rows.reduce((acc, row) => acc + safeNum(row.leads_count), 0);
  const totalSold = rows.reduce((acc, row) => acc + safeNum(row.sold_count), 0);
  const conversion = totalLeads > 0 ? ((totalSold / totalLeads) * 100).toFixed(1) : "0.0";
  const topRows = rows.slice(0, 10).map((row) => JSON.stringify(row));
  const padBullets = (bullets: string[]) => {
    const next = bullets.slice(0, 8);
    while (next.length < 4) {
      next.push("Doplnte relevantni metriky pro rozhodovani vedení.");
    }
    return next;
  };

  const base: SlideSpec[] = [
    {
      title: "Executive shrnuti",
      bullets: [
        `Analyzovano zaznamu: ${rows.length}`,
        `Celkem leads: ${totalLeads}`,
        `Celkem prodano: ${totalSold}`,
        `Konverzni pomer leads -> prodej: ${conversion} %`,
        "Obsah vychazi z datoveho exportu za posledni obdobi."
      ]
    },
    {
      title: "Trend a sezonnost",
      bullets: [
        `Pokryte mesice: ${months.join(", ") || "bez mesicnich dat"}`,
        "Sledujte odchylky mezi novymi leady a uzavrenymi obchody.",
        "Identifikujte vrcholy a propady v pipeline.",
        "Pri poklesu leadu zkontrolujte zdroje akvizice.",
        "Pri poklesu prodeju zkontrolujte rychlost follow-upu."
      ]
    },
    {
      title: "Detailni metriky",
      bullets: rows.length > 0
        ? padBullets(topRows.slice(0, 6))
        : [
            "Nejsou dostupna zadna data pro vypocet detailnich metrik.",
            "Zkontrolujte SQL preset a zdrojove tabulky.",
            "Po doplneni dat workflow spustte znovu.",
            "Doporuceni: pravidelna validace pred kazdym reportingem."
          ]
    },
    {
      title: "Rizika a doporucene kroky",
      bullets: [
        "Nastavte odpovednost za kazdy klicovy KPI ukazatel.",
        "Zavedte tydenni kontrolu kvality dat pred prezentaci.",
        "Prioritizujte leady s nejvyssim potencialem uzavreni.",
        "Sledujte dobu od prvniho kontaktu po uzavreni.",
        "Pripravte akcni plan na pristi reportovaci obdobi."
      ]
    }
  ];

  while (base.length < slideCount) {
    const i = base.length + 1;
    base.push({
      title: `Doplnujici analyza ${i}`,
      bullets: [
        "Doplnte segmentaci podle lokality a cenove hladiny.",
        "Porovnejte vykonnost jednotlivych obchodniku.",
        "Vyhodnotte lead source ROI a efektivitu kampani.",
        "Oznacte data, kde chybi vstupy pro rozhodovani.",
        "Definujte rozhodnuti, ktera z reportu plynou."
      ]
    });
  }

  return base.slice(0, slideCount);
}

const TEMPLATE_MAX_TITLE_CHARS = 64;
const TEMPLATE_MAX_BULLET_CHARS = 180;

function clampSlidesForTemplateLayout(slides: SlideSpec[]): SlideSpec[] {
  const ell = (s: string, max: number) => (s.length <= max ? s : `${s.slice(0, Math.max(0, max - 1))}…`);
  return slides.map((s) => ({
    title: ell(s.title.trim(), TEMPLATE_MAX_TITLE_CHARS),
    bullets: s.bullets.map((b) => ell(b.trim(), TEMPLATE_MAX_BULLET_CHARS))
  }));
}

async function buildSlideSpecs(params: {
  runId: string;
  title: string;
  rows: Record<string, unknown>[];
  context?: string;
  slideCount: number;
  layoutMode: "plain" | "branded_template";
}) {
  const sample = params.rows.slice(0, 16);
  const maxTokens = Math.min(1800, Math.max(900, params.slideCount * 180));
  const threeSlideStructure =
    params.slideCount === 3
      ? "\nStruktura (presne 3 slidy): 1) Executive shrnuti a klicova KPI z dat. 2) Vyvoj v case / trendy a strucny komentar. 3) Rizika, prilezitosti a konkretni doporucene akce pro vedeni.\n"
      : "";
  const templateHint =
    params.layoutMode === "branded_template"
      ? " Vystup bude vlozen do firemniho PPTX: kazdy titulek slidu musi byt kratky (nadcas nadpis, max ~55 znaku). " +
        "Kazdy bullet strucny (idealne do ~140 znaku), jedna myslenka, zadne odradkovani uvnitr bulletu. "
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
            `Jsi senior analytik. Vrat pouze validni JSON pole delky ${params.slideCount}. ` +
            "Kazdy prvek musi mit tvar {\"title\":\"...\",\"bullets\":[\"...\",\"...\"]}. " +
            "Pis vyhradne cesky (bez anglictiny). Kazdy slide musi mit 4 az 8 konkretni bullet bodu s datovym obsahem, " +
            "zaverem nebo doporucenim. Zadny markdown, zadne vysvetleni mimo JSON." +
            templateHint
        },
        {
          role: "user",
          content:
            `Nazev prezentace: ${params.title}\n` +
            `Pozadovany pocet slidu: ${params.slideCount}\n` +
            `Kontext: ${params.context ?? "tydenni executive report"}\n` +
            threeSlideStructure +
            `Ukazka dat:\n${JSON.stringify(sample)}`
        }
      ]
    });
    llmText = llm.text.trim();
  } catch {
    return buildFallbackSlides(params.rows, params.slideCount);
  }

  const raw = llmText;
  let parsed: unknown = null;
  try {
    parsed = JSON.parse(raw);
  } catch {
    const match = raw.match(/\[[\s\S]*\]/);
    if (match) {
      try {
        parsed = JSON.parse(match[0]);
      } catch {
        parsed = null;
      }
    }
  }

  return toSafeSlideSpecs(parsed, params.slideCount) ?? buildFallbackSlides(params.rows, params.slideCount);
}

async function generateSkippedPdfPlaceholder(): Promise<Buffer> {
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const page = pdf.addPage([595, 420]);
  const msg =
    "PDF export byl vypnut (PRESENTATION_SKIP_PDF). Stahnete prosim soubor presentation.pptx pro aktualni obsah a firemni vizual.";
  page.drawText(msg, { x: 40, y: 360, size: 11, font, maxWidth: 520, lineHeight: 13 });
  return Buffer.from(await pdf.save());
}

async function generatePdfBuffer(params: { title: string; slides: SlideSpec[] }): Promise<Buffer> {
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);

  for (let index = 0; index < params.slides.length; index += 1) {
    const slide = params.slides[index];
    const page = pdf.addPage([842, 595]); // A4 landscape
    const { width, height } = page.getSize();

    page.drawText(`${params.title} - Slide ${index + 1}`, {
      x: 32,
      y: height - 42,
      size: 14,
      font,
      color: rgb(0.15, 0.2, 0.28)
    });

    page.drawText(slide.title, {
      x: 32,
      y: height - 84,
      size: 26,
      font: bold,
      color: rgb(0.12, 0.15, 0.2)
    });

    let y = height - 126;
    slide.bullets.forEach((bullet) => {
      page.drawText(`- ${bullet}`, {
        x: 44,
        y,
        size: 14,
        font,
        color: rgb(0.1, 0.1, 0.1)
      });
      y -= 24;
    });
  }

  const bytes = await pdf.save();
  return Buffer.from(bytes);
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

  const slideCount = Math.min(15, Math.max(2, parsedInput.data.slideCount ?? WEEKLY_REPORT_DEFAULT_SLIDE_COUNT));
  const templateCfg = resolvePresentationTemplate(env);
  const slidesRaw = await buildSlideSpecs({
    ...parsedInput.data,
    slideCount,
    layoutMode: templateCfg.useTemplate ? "branded_template" : "plain"
  });
  const slides = templateCfg.useTemplate ? clampSlidesForTemplateLayout(slidesRaw) : slidesRaw;
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
      slides
    });
  } else {
    const pptx = new PptxGenJS();
    pptx.layout = "LAYOUT_WIDE";
    pptx.author = "Back Office Operations Agent";
    pptx.subject = parsedInput.data.title;
    pptx.title = parsedInput.data.title;

    slides.forEach((slideSpec) => {
      const slide = pptx.addSlide();
      slide.background = { color: "F8FAFC" };
      slide.addText(slideSpec.title, {
        x: 0.5,
        y: 0.35,
        w: 12.3,
        h: 0.8,
        bold: true,
        fontFace: "Calibri",
        fontSize: 30,
        color: "1F2937"
      });
      slide.addText(
        slideSpec.bullets.map((b) => ({ text: b, options: { bullet: { indent: 18 } } })),
        {
          x: 0.8,
          y: 1.4,
          w: 11.8,
          h: 5.2,
          fontFace: "Calibri",
          fontSize: 20,
          color: "111827",
          breakLine: true
        }
      );
    });

    buffer = (await pptx.write({ outputType: "nodebuffer" })) as Buffer;
  }
  const pptxPath = `reports/${parsedInput.data.runId}/presentation.pptx`;
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
        message: "PDF je stale generovany staticky pres pdf-lib ze SlideSpec; layout odpovida textu, ne PPTX šabloně."
      });
    }
    pdfBuffer = await generatePdfBuffer({ title: parsedInput.data.title, slides });
  }
  const pdfPath = `reports/${parsedInput.data.runId}/presentation.pdf`;
  const pdfUpload = await supabase.storage.from(bucketName).upload(pdfPath, pdfBuffer, {
    upsert: true,
    contentType: "application/pdf"
  });
  if (pdfUpload.error) {
    throw new Error(`PRESENTATION_UPLOAD_FAILED: ${pdfUpload.error.message}`);
  }

  const publicUrl = supabase.storage.from(bucketName).getPublicUrl(pptxPath).data.publicUrl;
  const pdfPublicUrl = supabase.storage.from(bucketName).getPublicUrl(pdfPath).data.publicUrl;

  const output: PresentationArtifactOutput = { publicUrl, pdfPublicUrl, slides };
  const checked = PresentationArtifactOutputSchema.safeParse(output);
  if (!checked.success) {
    throw new Error(`INVALID_OUTPUT: ${checked.error.issues.map((i) => i.message).join("; ")}`);
  }
  return checked.data;
}
