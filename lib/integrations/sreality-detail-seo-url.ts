/**
 * Veřejná SEO URL detailu Sreality: `/detail/{prodej|pronajem}/{byt|dum|…}/{podtyp-slug}/{locality}/{hash_id}`.
 * Logika vychází z `completeDetailLink` v
 * [sreality-configurable-rss/global_functions.php](https://github.com/tomFlidr/sreality-configurable-rss/blob/master/bin/global_functions.php)
 * – segment „byt“ je v jednotném čísle (ne `byty`); dispozice používají znak `+` (např. `2+kk`).
 */
import {
  SREALITY_CATEGORY_SUB_BYTY,
  SREALITY_CATEGORY_SUB_DOMY,
  type SrealityIdLabel
} from "@/lib/integrations/sreality-param-catalog";

const SREALITY_ORIGIN = "https://www.sreality.cz";

const CATEGORY_TYPE_SLUG: Record<number, string> = {
  1: "prodej",
  2: "pronajem",
  3: "drazby"
};

const CATEGORY_MAIN_SLUG: Record<number, string> = {
  1: "byt",
  2: "dum",
  3: "pozemek",
  4: "komercni",
  5: "ostatni"
};

/** Výjimky oproti jednoduché slugifikaci popisku (`main:sub` → slug). */
const SUB_SLUG_OVERRIDE: Record<string, string> = {
  "2:37": "rodinny",
  "2:40": "na-klic",
  "2:35": "pamatka",
  "3:22": "louka",
  "3:23": "zahrada",
  "3:24": "ostatni-pozemky",
  "3:21": "les",
  "3:46": "rybnik",
  "4:38": "cinzovni-dum"
};

/** Dispozice / typ – slug z českého popisku (bez diakritiky), mezery → `-`, zachovat `+`. */
function slugFromDispositionLabel(label: string): string {
  return label
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .trim()
    .replace(/\s*\/\s*/g, "-")
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9+-]/g, "");
}

function subSlugFromRows(rows: SrealityIdLabel[], subCb: number): string | undefined {
  const row = rows.find((r) => r.id === subCb);
  return row ? slugFromDispositionLabel(row.label) : undefined;
}

/** Pozemky, komerční, ostatní – popisky podle běžných kategorií Sreality (config.php). */
const POZEMEK_SUB_LABELS: SrealityIdLabel[] = [
  { id: 19, label: "Bydlení" },
  { id: 18, label: "Komerční" },
  { id: 20, label: "Pole" },
  { id: 22, label: "Louky" },
  { id: 21, label: "Lesy" },
  { id: 46, label: "Rybníky" },
  { id: 48, label: "Sady/vinice" },
  { id: 23, label: "Zahrady" },
  { id: 24, label: "Ostatní" }
];

const KOMERCNI_SUB_LABELS: SrealityIdLabel[] = [
  { id: 25, label: "Kanceláře" },
  { id: 26, label: "Sklady" },
  { id: 27, label: "Výroba" },
  { id: 28, label: "Obchodní prostory" },
  { id: 29, label: "Ubytování" },
  { id: 30, label: "Restaurace" },
  { id: 31, label: "Zemědělský" },
  { id: 38, label: "Činžovní dům" },
  { id: 32, label: "Ostatní" }
];

const OSTATNI_NEM_SUB_LABELS: SrealityIdLabel[] = [
  { id: 34, label: "Garáž" },
  { id: 52, label: "Garážové stání" },
  { id: 53, label: "Mobilheim" },
  { id: 50, label: "Vinný sklep" },
  { id: 51, label: "Půdní prostor" },
  { id: 36, label: "Ostatní" }
];

export type SrealityListingSeo = {
  category_main_cb?: number;
  category_sub_cb?: number;
  category_type_cb?: number;
  locality?: string;
};

function categorySubSlug(mainCb: number, subCb: number): string | undefined {
  const okey = `${mainCb}:${subCb}`;
  if (SUB_SLUG_OVERRIDE[okey]) return SUB_SLUG_OVERRIDE[okey];

  if (mainCb === 1) {
    return subSlugFromRows(SREALITY_CATEGORY_SUB_BYTY, subCb);
  }
  if (mainCb === 2) {
    const fromTable = subSlugFromRows(SREALITY_CATEGORY_SUB_DOMY, subCb);
    if (fromTable) return fromTable;
    return undefined;
  }
  if (mainCb === 3) {
    return subSlugFromRows(POZEMEK_SUB_LABELS, subCb);
  }
  if (mainCb === 4) {
    return subSlugFromRows(KOMERCNI_SUB_LABELS, subCb);
  }
  if (mainCb === 5) {
    return subSlugFromRows(OSTATNI_NEM_SUB_LABELS, subCb);
  }
  return undefined;
}

/**
 * Sestaví klikací URL detailu. Vyžaduje `seo` z položky výpisu / detailu API (stejné jako u mapování nabídek).
 */
export function buildSrealityListingDetailUrl(hashId: number, seo: SrealityListingSeo | undefined): string | null {
  const main = seo?.category_main_cb;
  const sub = seo?.category_sub_cb;
  const typ = seo?.category_type_cb;
  const locality = seo?.locality?.trim();

  if (
    main == null ||
    sub == null ||
    typ == null ||
    !locality ||
    typeof hashId !== "number" ||
    !Number.isFinite(hashId)
  ) {
    return null;
  }

  const typeSeg = CATEGORY_TYPE_SLUG[typ];
  const mainSeg = CATEGORY_MAIN_SLUG[main];
  const subSeg = categorySubSlug(main, sub);

  if (!typeSeg || !mainSeg || !subSeg) return null;

  return `${SREALITY_ORIGIN}/detail/${typeSeg}/${mainSeg}/${subSeg}/${locality}/${hashId}`;
}
