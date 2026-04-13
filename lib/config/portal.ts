export function isPortalModeOnly(): boolean {
  const raw = process.env.PORTAL_MODE_ONLY ?? process.env.NEXT_PUBLIC_PORTAL_MODE_ONLY ?? "";
  const normalized = String(raw).trim().toLowerCase();
  return normalized === "1" || normalized === "true" || normalized === "yes" || normalized === "on";
}

export function assertLegacyFeatureEnabled(feature: string): void {
  if (!isPortalModeOnly()) return;
  throw new Error(`Feature '${feature}' is disabled in portal-only mode.`);
}
