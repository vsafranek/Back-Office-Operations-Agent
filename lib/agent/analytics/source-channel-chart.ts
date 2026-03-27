/**
 * Agregace řádků klientů (view vw_new_clients_q1) podle source_channel pro graf v UI.
 */
export function buildSourceChannelChart(rows: Record<string, unknown>[]): {
  title: string;
  labels: string[];
  values: number[];
} {
  const counts = new Map<string, number>();
  for (const row of rows) {
    const raw = row.source_channel;
    const key = typeof raw === "string" && raw.trim() !== "" ? raw.trim() : "(neuvedeno)";
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  const entries = [...counts.entries()].sort((a, b) => b[1] - a[1]);
  return {
    title: "Noví klienti v Q1 — počet podle zdroje",
    labels: entries.map(([label]) => label),
    values: entries.map(([, value]) => value)
  };
}
