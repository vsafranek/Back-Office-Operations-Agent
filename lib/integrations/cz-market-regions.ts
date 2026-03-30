/**
 * Regiony pro portály: Bezrealitky (regionOsmIds, prefix R…) a Sreality (locality_region_id).
 *
 * Strategie:
 * 1) `resolveCzMarketRegionFromText` — rychlé substringy (častá města/kraje), bez sítě.
 * 2) `resolveCzMarketRegionFromKrajState` — mapa jen ~14 oficiálních krajů (vstup typicky z Nominatim `address.state`).
 * 3) Volání Nominatim je v `nominatim-cz-region.ts` (obec v ČR → kraj), aby nebylo nutné udržovat kompletní seznam obcí.
 */
export type ResolvedCzMarketRegion = {
  label: string;
  bezrealitkyRegionOsmIds: string[];
  srealityLocalityRegionId: number;
};

export function normCs(s: string): string {
  return s
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase();
}

const REGION_ROWS: Array<{
  label: string;
  bezrealitkyRegionOsmIds: string[];
  srealityLocalityRegionId: number;
  needles: string[];
}> = [
  {
    label: "Praha",
    bezrealitkyRegionOsmIds: ["R435514"],
    srealityLocalityRegionId: 10,
    needles: [
      "praha",
      "praze",
      "holešovice",
      "karlín",
      "smíchov",
      "vinohrady",
      "letňany",
      "modřany",
      "čakovice",
      "vysočany",
      "dejvice",
      "chodov",
      "řepy",
      "stodůlky",
      "hlavní město"
    ]
  },
  {
    label: "Středočeský kraj",
    bezrealitkyRegionOsmIds: ["R442397"],
    srealityLocalityRegionId: 11,
    needles: [
      "středočesk",
      "stredočesk",
      "kladno",
      "mělník",
      "melník",
      "mladá boleslav",
      "příbram",
      "benešov",
      "beroun",
      "nymburk",
      "kolín",
      "kutná hora",
      "brandýs",
      "říčany"
    ]
  },
  {
    label: "Jihočeský kraj",
    bezrealitkyRegionOsmIds: ["R442311"],
    srealityLocalityRegionId: 1,
    needles: ["jihočeský kraj", "jihocesky kraj", "české budějovice", "tábor", "písek", "strakonice"]
  },
  {
    label: "Plzeňský kraj",
    bezrealitkyRegionOsmIds: ["R442466"],
    srealityLocalityRegionId: 2,
    /* „Plzeň“ / „v Plzni“ neuvádějte — město řeší Nominatim + okres. Krajské tvary kvůli skloňování: */
    needles: [
      "plzeňský kraj",
      "plzensky kraj",
      "plzeňském kraji",
      "plzeňského kraje",
      "rokycany",
      "klatovy"
    ]
  },
  {
    label: "Karlovarský kraj",
    bezrealitkyRegionOsmIds: ["R442314"],
    srealityLocalityRegionId: 3,
    needles: ["karlovarský kraj", "karlovarsky kraj", "karlovy vary", "cheb", "sokolov"]
  },
  {
    label: "Ústecký kraj",
    bezrealitkyRegionOsmIds: ["R442321"],
    srealityLocalityRegionId: 4,
    needles: ["ústecký kraj", "ustecky kraj", "ústí nad labem", "děčín", "decin", "teplice", "chomutov", "město most"]
  },
  {
    label: "Liberecký kraj",
    bezrealitkyRegionOsmIds: ["R442463"],
    srealityLocalityRegionId: 5,
    needles: ["liberecký kraj", "liberecky kraj", "liberec", "jablonec", "česká lípa"]
  },
  {
    label: "Královéhradecký kraj",
    bezrealitkyRegionOsmIds: ["R442464"],
    srealityLocalityRegionId: 6,
    needles: [
      "královéhradecký kraj",
      "kralovehradecky kraj",
      "hradec králové",
      "hradec kralove",
      "náchod",
      "jičín",
      "trutnov"
    ]
  },
  {
    label: "Pardubický kraj",
    bezrealitkyRegionOsmIds: ["R442461"],
    srealityLocalityRegionId: 7,
    needles: ["pardubický kraj", "pardubicky kraj", "pardubice", "chrudim", "svitavy", "česká třebová"]
  },
  {
    label: "Kraj Vysočina",
    bezrealitkyRegionOsmIds: ["R442453"],
    srealityLocalityRegionId: 13,
    needles: ["kraj vysočina", "vysocina kraj", "jihlava", "třebíč", "havlíčkův brod", "pelhřimov"]
  },
  {
    label: "Jihomoravský kraj",
    bezrealitkyRegionOsmIds: ["R442459"],
    srealityLocalityRegionId: 14,
    needles: ["jihomoravský kraj", "jihomoravsky kraj", "brno", "brně", "břeclav", "znojmo", "blansko"]
  },
  {
    label: "Olomoucký kraj",
    bezrealitkyRegionOsmIds: ["R442460"],
    srealityLocalityRegionId: 8,
    needles: ["olomoucký kraj", "olomoucky kraj", "olomouc", "prosťejov", "prostejov", "přerov", "šumperk"]
  },
  {
    label: "Zlínský kraj",
    bezrealitkyRegionOsmIds: ["R442462"],
    srealityLocalityRegionId: 9,
    needles: ["zlínský kraj", "zlinsky kraj", "zlín", "zlin", "uherské hradiště", "vsetín"]
  },
  {
    label: "Moravskoslezský kraj",
    bezrealitkyRegionOsmIds: ["R442458"],
    srealityLocalityRegionId: 12,
    needles: ["moravskoslezský kraj", "moravskoslezsky kraj", "ostrava", "opava", "karviná", "karvina", "frýdek"]
  }
];

function resolvedFromRow(row: (typeof REGION_ROWS)[number]): ResolvedCzMarketRegion {
  return {
    label: row.label,
    bezrealitkyRegionOsmIds: row.bezrealitkyRegionOsmIds,
    srealityLocalityRegionId: row.srealityLocalityRegionId
  };
}

const KRAJ_BY_NORMALIZED_STATE: Map<string, ResolvedCzMarketRegion> = (() => {
  const m = new Map<string, ResolvedCzMarketRegion>();
  for (const row of REGION_ROWS) {
    m.set(normCs(row.label), resolvedFromRow(row));
  }
  const praha = REGION_ROWS.find((r) => r.label === "Praha");
  if (praha) {
    const r = resolvedFromRow(praha);
    m.set("hlavni mesto praha", r);
    m.set("prague", r);
  }
  const vys = REGION_ROWS.find((r) => r.label === "Kraj Vysočina");
  if (vys) {
    const r = resolvedFromRow(vys);
    m.set("vysocina", r);
    m.set("vysocina region", r);
  }
  return m;
})();

/**
 * Mapuje oficiální název kraje (jako z Nominatim `address.state`) na naše ID portálů.
 */
export function resolveCzMarketRegionFromKrajState(stateRaw: string | null | undefined): ResolvedCzMarketRegion | null {
  if (!stateRaw?.trim()) return null;
  const n = normCs(stateRaw.trim());
  const hit = KRAJ_BY_NORMALIZED_STATE.get(n);
  if (hit) return hit;
  if (n.endsWith(" region")) {
    const stripped = n.replace(/\s+region$/u, "").trim();
    const h2 = KRAJ_BY_NORMALIZED_STATE.get(stripped);
    if (h2) return h2;
  }
  if (n.includes("praha") && n.includes("hlavni")) {
    const praha = REGION_ROWS.find((r) => r.label === "Praha");
    return praha ? resolvedFromRow(praha) : null;
  }
  return null;
}

/**
 * null = žádný známý region → celostátní výsledek (Bezrealitky bez regionOsmIds, Sreality bez locality_region_id).
 */
export function resolveCzMarketRegionFromText(text: string): ResolvedCzMarketRegion | null {
  const n = normCs(text);
  for (const row of REGION_ROWS) {
    if (row.needles.some((needle) => n.includes(normCs(needle)))) {
      return resolvedFromRow(row);
    }
  }
  return null;
}
