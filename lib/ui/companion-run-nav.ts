/** Navigace mezi běhy agenta v postranním panelu (Tabulka/graf, Maily) podle pořadí zpráv v konverzaci. */

export type CompanionRunOption = { runId: string; preview: string };

/**
 * Pozice runId v časové ose assistant zpráv (0 = nejstarší v konverzaci).
 * Vrací -1, pokud run v ose není.
 */
export function runIdIndexInAssistantOrder(runId: string, assistantRunIdsInOrder: string[]): number {
  return assistantRunIdsInOrder.indexOf(runId);
}

/**
 * Index kurzoru v poli `runs` pro šipky vlevo/vpravo.
 * - Je-li `companionRunId` v `runs`, vrací jeho index.
 * - Jinak: poslední položka v `runs`, jejíž pozice v ose je &lt; pozice companion běhu.
 * - Pokud žádná taková (-1 před prvním návrhem v ose): vrací -1 (vpravo přejde na runs[0]).
 * - Pokud companion v ose není (-1): vrací runs.length - 1 (nejnovější v seznamu filtru).
 */
export function companionRunNavCursor(
  runs: CompanionRunOption[],
  companionRunId: string | null,
  assistantRunIdsInOrder: string[]
): number {
  if (runs.length === 0) return -1;
  if (!companionRunId?.trim()) return runs.length - 1;

  const direct = runs.findIndex((r) => r.runId === companionRunId);
  if (direct >= 0) return direct;

  const curPos = assistantRunIdsInOrder.indexOf(companionRunId);
  if (curPos === -1) {
    return runs.length - 1;
  }

  let best = -1;
  let bestTimelinePos = -Infinity;
  for (let i = 0; i < runs.length; i++) {
    const t = assistantRunIdsInOrder.indexOf(runs[i]!.runId);
    if (t === -1) continue;
    if (t < curPos && t > bestTimelinePos) {
      bestTimelinePos = t;
      best = i;
    }
  }
  return best;
}

export function companionRunNavCanGoOlder(cursor: number): boolean {
  return cursor > 0;
}

export function companionRunNavCanGoNewer(cursor: number, runCount: number): boolean {
  if (runCount <= 0) return false;
  return cursor < 0 || cursor < runCount - 1;
}

export function companionRunNavGoOlder(
  runs: CompanionRunOption[],
  cursor: number,
  onSelect: (runId: string) => void
): void {
  if (!companionRunNavCanGoOlder(cursor) || runs.length === 0) return;
  onSelect(runs[cursor - 1]!.runId);
}

export function companionRunNavGoNewer(
  runs: CompanionRunOption[],
  cursor: number,
  onSelect: (runId: string) => void
): void {
  if (runs.length === 0) return;
  if (cursor < 0) {
    onSelect(runs[0]!.runId);
    return;
  }
  if (cursor >= runs.length - 1) return;
  onSelect(runs[cursor + 1]!.runId);
}

/** Popisek čísla „slotu“ pro UI (1-based). Pro cursor -1 zobrazíme pomlčku. */
export function companionRunNavDisplayedSlotNumber(cursor: number, runCount: number): number | null {
  if (runCount <= 0) return null;
  if (cursor < 0) return null;
  return cursor + 1;
}
