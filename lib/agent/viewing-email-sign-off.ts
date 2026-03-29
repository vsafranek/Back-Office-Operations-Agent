function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Odstraní koncový blok „S pozdravem,“ + jméno (pro přidání správného podpisu). */
export function stripViewingEmailSignOff(body: string, displayName: string): string {
  const name = displayName.trim();
  if (!name) return body.trimEnd();
  const re = new RegExp(`\\n\\nS pozdravem,\\s*\\n\\s*${escapeRegExp(name)}\\s*$`, "i");
  return body.replace(re, "").trimEnd();
}

/** Zajistí přesně jeden podpis přihlášené osoby na konci těla. */
export function ensureViewingEmailSignOff(body: string, displayName: string): string {
  const name = displayName.trim();
  if (!name) return body;
  const core = stripViewingEmailSignOff(body, name);
  return `${core}\n\nS pozdravem,\n${name}`;
}
