const trueValues = new Set(["1", "true", "yes", "on"]);

function readFlag(value: string | undefined, fallback = false): boolean {
  if (value == null) return fallback;
  return trueValues.has(String(value).trim().toLowerCase());
}

export function isPortalModeOnly(): boolean {
  return readFlag(process.env.PORTAL_MODE_ONLY ?? process.env.NEXT_PUBLIC_PORTAL_MODE_ONLY, false);
}

export function isSplitMapListEnabled(): boolean {
  return readFlag(process.env.PORTAL_SPLIT_MAP_LIST_ENABLED ?? process.env.NEXT_PUBLIC_PORTAL_SPLIT_MAP_LIST_ENABLED, true);
}

export function isSavedListingsEnabled(): boolean {
  return readFlag(process.env.PORTAL_SAVED_LISTINGS_ENABLED ?? process.env.NEXT_PUBLIC_PORTAL_SAVED_LISTINGS_ENABLED, true);
}

export function isMobileMapToggleEnabled(): boolean {
  return readFlag(process.env.PORTAL_MOBILE_MAP_TOGGLE_ENABLED ?? process.env.NEXT_PUBLIC_PORTAL_MOBILE_MAP_TOGGLE_ENABLED, true);
}

export function isTransitFiltersEnabled(): boolean {
  return readFlag(process.env.PORTAL_TRANSIT_FILTERS_ENABLED ?? process.env.NEXT_PUBLIC_PORTAL_TRANSIT_FILTERS_ENABLED, true);
}

export function isTransitMapOverlayEnabled(): boolean {
  return readFlag(process.env.PORTAL_TRANSIT_MAP_OVERLAY_ENABLED ?? process.env.NEXT_PUBLIC_PORTAL_TRANSIT_MAP_OVERLAY_ENABLED, true);
}

export function assertLegacyFeatureEnabled(feature: string): void {
  if (!isPortalModeOnly()) return;
  throw new Error(`Feature '${feature}' is disabled in portal-only mode.`);
}
