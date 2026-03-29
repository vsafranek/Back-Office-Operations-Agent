/**
 * Z veřejné Supabase Storage URL vytáhne klíč objektu (bez bucketu), např. `reports/prezentace/x/soubor.pptx`.
 */
export function storageObjectPathFromPublicUrl(url: string): string | null {
  try {
    const u = new URL(url);
    const segs = u.pathname.split("/").filter(Boolean);
    const publicIdx = segs.indexOf("public");
    if (publicIdx === -1 || publicIdx + 2 >= segs.length) return null;
    return segs.slice(publicIdx + 2).join("/");
  } catch {
    return null;
  }
}

/** Prefix složky (bez názvu souboru) pro otevření ve Storage prohlížeči. */
export function storageFolderPrefixFromFilePublicUrl(url: string): string | null {
  const path = storageObjectPathFromPublicUrl(url);
  if (!path) return null;
  const i = path.lastIndexOf("/");
  if (i <= 0) return null;
  return path.slice(0, i);
}
