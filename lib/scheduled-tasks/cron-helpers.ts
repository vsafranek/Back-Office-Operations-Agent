import { CronExpressionParser } from "cron-parser";

/**
 * pg_cron / Unix cron: minuta hodina den_měsíce měsíc den_týdne (5 polí).
 * cron-parser očekává 6 polí: vteřina minuta hodina … — u 5 polí doplníme vteřinu 0.
 */
export function normalizeCronExpressionForParser(expression: string): string {
  const atoms = expression.trim().split(/\s+/).filter(Boolean);
  if (atoms.length === 5) {
    return `0 ${atoms.join(" ")}`;
  }
  if (atoms.length === 6) {
    return atoms.join(" ");
  }
  throw new Error(`Očekáváno 5 nebo 6 polí cron výrazu, dostáno ${atoms.length}.`);
}

export function validateCronExpression(expression: string, timezone: string): { ok: true } | { ok: false; error: string } {
  const trimmed = expression.trim();
  if (!trimmed) {
    return { ok: false, error: "Cron výraz je prázdný." };
  }
  const tz = timezone.trim() || "UTC";
  try {
    const normalized = normalizeCronExpressionForParser(trimmed);
    CronExpressionParser.parse(normalized, { tz });
    return { ok: true };
  } catch (e) {
    const message = e instanceof Error ? e.message : "Neplatný cron výraz.";
    return { ok: false, error: message };
  }
}

/**
 * Určí, zda má úloha v aktuálním tiknutí cron endpointu doběhnout.
 * Endpoint volejte z pg_cron např. každých 10–15 minut; okno je nastaveno štědře kvůli zpoždění.
 */
export function shouldRunScheduledTaskNow(params: {
  now: Date;
  cronExpression: string;
  timezone: string;
  lastRunAt: Date | null;
  windowMinutes?: number;
}): boolean {
  const windowMinutes = params.windowMinutes ?? 35;
  const tz = params.timezone.trim() || "UTC";
  let expr;
  try {
    const normalized = normalizeCronExpressionForParser(params.cronExpression.trim());
    expr = CronExpressionParser.parse(normalized, { currentDate: params.now, tz });
  } catch {
    return false;
  }

  const prevCron = expr.prev();
  const prevMs = prevCron.getTime();
  const elapsedMs = params.now.getTime() - prevMs;
  if (elapsedMs < 0 || elapsedMs > windowMinutes * 60 * 1000) {
    return false;
  }

  if (!params.lastRunAt) {
    return true;
  }

  return params.lastRunAt.getTime() < prevMs;
}
