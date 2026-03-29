/**
 * Číselné parametry veřejného Sreality API (category_*, locality_*).
 * Srovnáno s mapami v projektu
 * [tomFlidr/sreality-configurable-rss/config.php](https://github.com/tomFlidr/sreality-configurable-rss/blob/master/config.php)
 * a ověřeno dotazem na `https://www.sreality.cz/api/cs/v2/estates` (např. `category_sub_cb`, kraje, okresy).
 * Starší RSS repo slouží jako dokumentace ID — chování API může být časem rozšířeno.
 */

export const SREALITY_COUNTRY_CR = 112 as const;

export type SrealityIdLabel = { id: number; label: string };

/** Kraje ČR (`locality_region_id`). */
export const SREALITY_REGIONS_CR: SrealityIdLabel[] = [
  { id: 1, label: "Jihočeský kraj" },
  { id: 14, label: "Jihomoravský kraj" },
  { id: 3, label: "Karlovarský kraj" },
  { id: 6, label: "Královéhradecký kraj" },
  { id: 5, label: "Liberecký kraj" },
  { id: 12, label: "Moravskoslezský kraj" },
  { id: 8, label: "Olomoucký kraj" },
  { id: 7, label: "Pardubický kraj" },
  { id: 2, label: "Plzeňský kraj" },
  { id: 10, label: "Praha" },
  { id: 11, label: "Středočeský kraj" },
  { id: 4, label: "Ústecký kraj" },
  { id: 13, label: "Kraj Vysočina" },
  { id: 9, label: "Zlínský kraj" }
];

/** Okresy a města Praha 1–10 (`locality_district_id`). */
export const SREALITY_DISTRICTS_CR: SrealityIdLabel[] = [
  { id: 56, label: "Praha-východ" },
  { id: 57, label: "Praha-západ" },
  { id: 5001, label: "Praha 1" },
  { id: 5002, label: "Praha 2" },
  { id: 5003, label: "Praha 3" },
  { id: 5004, label: "Praha 4" },
  { id: 5005, label: "Praha 5" },
  { id: 5006, label: "Praha 6" },
  { id: 5007, label: "Praha 7" },
  { id: 5008, label: "Praha 8" },
  { id: 5009, label: "Praha 9" },
  { id: 5010, label: "Praha 10" },
  { id: 1, label: "České Budějovice" },
  { id: 2, label: "Český Krumlov" },
  { id: 3, label: "Jindřichův Hradec" },
  { id: 4, label: "Písek" },
  { id: 5, label: "Prachatice" },
  { id: 6, label: "Strakonice" },
  { id: 7, label: "Tábor" },
  { id: 71, label: "Blansko" },
  { id: 74, label: "Břeclav" },
  { id: 72, label: "Brno-město" },
  { id: 73, label: "Brno-venkov" },
  { id: 75, label: "Hodonín" },
  { id: 76, label: "Vyškov" },
  { id: 77, label: "Znojmo" },
  { id: 9, label: "Cheb" },
  { id: 10, label: "Karlovy Vary" },
  { id: 16, label: "Sokolov" },
  { id: 28, label: "Hradec Králové" },
  { id: 30, label: "Jičín" },
  { id: 31, label: "Náchod" },
  { id: 33, label: "Rychnov nad Kněžnou" },
  { id: 36, label: "Trutnov" },
  { id: 18, label: "Česká Lípa" },
  { id: 21, label: "Jablonec nad Nisou" },
  { id: 22, label: "Liberec" },
  { id: 34, label: "Semily" },
  { id: 60, label: "Bruntál" },
  { id: 61, label: "Frýdek-Místek" },
  { id: 62, label: "Karviná" },
  { id: 63, label: "Nový Jičín" },
  { id: 64, label: "Opava" },
  { id: 65, label: "Ostrava-město" },
  { id: 46, label: "Jeseník" },
  { id: 42, label: "Olomouc" },
  { id: 43, label: "Přerov" },
  { id: 40, label: "Prostějov" },
  { id: 44, label: "Šumperk" },
  { id: 29, label: "Chrudim" },
  { id: 32, label: "Pardubice" },
  { id: 35, label: "Svitavy" },
  { id: 37, label: "Ústí nad Orlicí" },
  { id: 8, label: "Domažlice" },
  { id: 11, label: "Klatovy" },
  { id: 13, label: "Plzeň-jih" },
  { id: 12, label: "Plzeň-město" },
  { id: 14, label: "Plzeň-sever" },
  { id: 15, label: "Rokycany" },
  { id: 17, label: "Tachov" },
  { id: 48, label: "Benešov" },
  { id: 49, label: "Beroun" },
  { id: 50, label: "Kladno" },
  { id: 51, label: "Kolín" },
  { id: 52, label: "Kutná Hora" },
  { id: 54, label: "Mělník" },
  { id: 53, label: "Mladá Boleslav" },
  { id: 55, label: "Nymburk" },
  { id: 58, label: "Příbram" },
  { id: 59, label: "Rakovník" },
  { id: 20, label: "Chomutov" },
  { id: 19, label: "Děčín" },
  { id: 23, label: "Litoměřice" },
  { id: 24, label: "Louny" },
  { id: 25, label: "Most" },
  { id: 26, label: "Teplice" },
  { id: 27, label: "Ústí nad Labem" },
  { id: 66, label: "Havlíčkův Brod" },
  { id: 67, label: "Jihlava" },
  { id: 68, label: "Pelhřimov" },
  { id: 69, label: "Třebíč" },
  { id: 70, label: "Žďár nad Sázavou" },
  { id: 39, label: "Kroměříž" },
  { id: 41, label: "Uherské Hradiště" },
  { id: 45, label: "Vsetín" },
  { id: 38, label: "Zlín" }
];

/** Dispozice / typ bytu (`category_main_cb=1`, parametr `category_sub_cb`). */
export const SREALITY_CATEGORY_SUB_BYTY: SrealityIdLabel[] = [
  { id: 2, label: "1+kk" },
  { id: 3, label: "1+1" },
  { id: 4, label: "2+kk" },
  { id: 5, label: "2+1" },
  { id: 6, label: "3+kk" },
  { id: 7, label: "3+1" },
  { id: 8, label: "4+kk" },
  { id: 9, label: "4+1" },
  { id: 10, label: "5+kk" },
  { id: 11, label: "5+1" },
  { id: 12, label: "6 a více" },
  { id: 16, label: "Atypický" },
  { id: 47, label: "Pokoj" }
];

/** Typ domu (`category_main_cb=2`, `category_sub_cb`). */
export const SREALITY_CATEGORY_SUB_DOMY: SrealityIdLabel[] = [
  { id: 37, label: "Rodinný dům" },
  { id: 39, label: "Vila" },
  { id: 43, label: "Chalupa" },
  { id: 33, label: "Chata" },
  { id: 40, label: "Rodinný dům na klíč" },
  { id: 44, label: "Zemědělská usedlost" },
  { id: 35, label: "Památka a jiné" }
];

export function srealityCategorySubForMain(categoryMain: 1 | 2): SrealityIdLabel[] {
  return categoryMain === 1 ? SREALITY_CATEGORY_SUB_BYTY : SREALITY_CATEGORY_SUB_DOMY;
}

const collatorCs = new Intl.Collator("cs");

export function srealityDistrictSelectData(): { value: string; label: string }[] {
  return [...SREALITY_DISTRICTS_CR]
    .sort((a, b) => collatorCs.compare(a.label, b.label))
    .map((d) => ({ value: String(d.id), label: `${d.label} · ${d.id}` }));
}

export function srealityRegionSelectData(): { value: string; label: string }[] {
  return SREALITY_REGIONS_CR.map((r) => ({ value: String(r.id), label: `${r.label} · ${r.id}` }));
}

export function srealityCategorySubSelectData(categoryMain: 1 | 2): { value: string; label: string }[] {
  return srealityCategorySubForMain(categoryMain).map((s) => ({
    value: String(s.id),
    label: `${s.label} · ${s.id}`
  }));
}
