const LS_KEY = "bo-dashboard-companion-run-v1";

function readMap(): Record<string, string> {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(LS_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
    return parsed as Record<string, string>;
  } catch {
    return {};
  }
}

function writeMap(m: Record<string, string>) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(LS_KEY, JSON.stringify(m));
  } catch {
    /* quota / private mode */
  }
}

export function persistCompanionRunForConversation(conversationId: string, runId: string) {
  const id = conversationId.trim();
  const run = runId.trim();
  if (!id || !run) return;
  const m = readMap();
  m[id] = run;
  writeMap(m);
}

export function readPersistedCompanionRunForConversation(conversationId: string | null): string | null {
  if (!conversationId?.trim()) return null;
  const m = readMap();
  const run = m[conversationId];
  return typeof run === "string" && run.trim() ? run.trim() : null;
}
