import PptxGenJS from "pptxgenjs";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { generateWithAzureProxy } from "@/lib/llm/azure-proxy-provider";
import { getEnv } from "@/lib/config/env";
import { getSupabaseAdminClient } from "@/lib/supabase/server-client";

type SlideSpec = {
  title: string;
  bullets: string[];
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
      if (!title || bullets.length < 4) return null;
      return { title, bullets: bullets.slice(0, 8) };
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
        ? topRows.slice(0, 6)
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

async function buildSlideSpecs(params: {
  runId: string;
  title: string;
  rows: Record<string, unknown>[];
  context?: string;
  slideCount: number;
}) {
  const sample = params.rows.slice(0, 16);
  const maxTokens = Math.min(1800, Math.max(900, params.slideCount * 180));
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
            "zaverem nebo doporucenim. Zadny markdown, zadne vysvetleni mimo JSON."
        },
        {
          role: "user",
          content:
            `Nazev prezentace: ${params.title}\n` +
            `Pozadovany pocet slidu: ${params.slideCount}\n` +
            `Kontext: ${params.context ?? "tydenni executive report"}\n` +
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

export async function generatePresentationArtifact(params: {
  runId: string;
  title: string;
  rows: Record<string, unknown>[];
  context?: string;
  slideCount?: number;
}) {
  const env = getEnv();
  const supabase = getSupabaseAdminClient();
  const bucketName = env.SUPABASE_STORAGE_BUCKET;
  const bucketCheck = await supabase.storage.getBucket(bucketName);
  if (bucketCheck.error) {
    const created = await supabase.storage.createBucket(bucketName, { public: true });
    if (created.error) throw new Error(`Storage bucket init failed: ${created.error.message}`);
  }

  const slideCount = Math.min(15, Math.max(2, params.slideCount ?? 5));
  const slides = await buildSlideSpecs({ ...params, slideCount });

  const pptx = new PptxGenJS();
  pptx.layout = "LAYOUT_WIDE";
  pptx.author = "Back Office Operations Agent";
  pptx.subject = params.title;
  pptx.title = params.title;

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

  const buffer = (await pptx.write({ outputType: "nodebuffer" })) as Buffer;
  const pptxPath = `reports/${params.runId}/presentation.pptx`;
  const upload = await supabase.storage.from(bucketName).upload(pptxPath, buffer, {
    upsert: true,
    contentType: "application/vnd.openxmlformats-officedocument.presentationml.presentation"
  });
  if (upload.error) {
    throw new Error(`Presentation upload failed: ${upload.error.message}`);
  }

  const pdfBuffer = await generatePdfBuffer({ title: params.title, slides });
  const pdfPath = `reports/${params.runId}/presentation.pdf`;
  const pdfUpload = await supabase.storage.from(bucketName).upload(pdfPath, pdfBuffer, {
    upsert: true,
    contentType: "application/pdf"
  });
  if (pdfUpload.error) {
    throw new Error(`Presentation PDF upload failed: ${pdfUpload.error.message}`);
  }

  const publicUrl = supabase.storage.from(bucketName).getPublicUrl(pptxPath).data.publicUrl;
  const pdfPublicUrl = supabase.storage.from(bucketName).getPublicUrl(pdfPath).data.publicUrl;
  return { publicUrl, pdfPublicUrl, slides };
}
