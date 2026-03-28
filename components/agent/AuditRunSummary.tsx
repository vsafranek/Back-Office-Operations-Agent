"use client";

import { useCallback, useEffect, useState } from "react";
import type { AuditRunAggregate } from "@/lib/types/audit-run-aggregate";

type Props = {
  runId: string;
  getAccessToken: () => Promise<string | null>;
};

export function AuditRunSummary({ runId, getAccessToken }: Props) {
  const [data, setData] = useState<AuditRunAggregate | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const token = await getAccessToken();
    if (!token) {
      setError("Pro přehled auditu se přihlaste.");
      setLoading(false);
      return;
    }
    try {
      const res = await fetch(`/api/audit/run?runId=${encodeURIComponent(runId)}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const json = (await res.json()) as AuditRunAggregate | { error?: string };
      if (!res.ok) {
        setError("error" in json && json.error ? json.error : "Načtení auditu se nezdařilo.");
        setData(null);
        return;
      }
      setData(json as AuditRunAggregate);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Neznámá chyba");
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [runId, getAccessToken]);

  useEffect(() => {
    void load();
  }, [load]);

  async function downloadCsv() {
    const token = await getAccessToken();
    if (!token) return;
    const res = await fetch(`/api/audit/run?runId=${encodeURIComponent(runId)}&format=csv`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    if (!res.ok) return;
    const blob = await res.blob();
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `audit-run-${runId.slice(0, 8)}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  if (loading) {
    return <p style={{ margin: 0, fontSize: 12, color: "#64748b" }}>Načítám audit běhu…</p>;
  }
  if (error) {
    return (
      <p style={{ margin: 0, fontSize: 12, color: "#b91c1c" }} role="alert">
        {error}
      </p>
    );
  }
  if (!data) return null;

  return (
    <div
      style={{
        border: "1px solid #e2e8f0",
        borderRadius: 8,
        padding: 12,
        background: "#f8fafc",
        fontSize: 13
      }}
    >
      <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 10, marginBottom: 8 }}>
        <span style={{ fontWeight: 600 }}>Audit běhu (BOA-007)</span>
        <button
          type="button"
          onClick={() => void downloadCsv()}
          style={{
            fontSize: 12,
            padding: "4px 10px",
            borderRadius: 6,
            border: "1px solid #cbd5e1",
            background: "#fff",
            cursor: "pointer"
          }}
        >
          Stáhnout CSV
        </button>
        <button
          type="button"
          onClick={() => void load()}
          style={{
            fontSize: 12,
            padding: "4px 10px",
            borderRadius: 6,
            border: "1px solid #cbd5e1",
            background: "#fff",
            cursor: "pointer"
          }}
        >
          Obnovit
        </button>
      </div>
      <ul style={{ margin: 0, paddingLeft: 18, color: "#334155" }}>
        <li>
          Záznam agent run: {data.agentRun ? `intent ${data.agentRun.intent}` : "ještě neuložen nebo cizí run"}
        </li>
        <li>Události trace: {data.traceEventCount} (detail níže ve stromu kroků)</li>
        <li>Odchozí e-maily vázané na run: {data.outboundEmails.length}</li>
      </ul>
      {data.outboundEmails.length > 0 ? (
        <ul style={{ margin: "8px 0 0", paddingLeft: 18, fontSize: 12 }}>
          {data.outboundEmails.map((o) => (
            <li key={o.id}>
              <strong>{o.action}</strong> → {o.to_email}
              {o.leadIds.length > 0 ? ` · leady: ${o.leadIds.length}` : ""}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
