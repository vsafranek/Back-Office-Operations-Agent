"use client";

import { useState } from "react";
import { AgentDataPanel } from "@/components/agent/AgentDataPanel";
import { AgentTraceTree } from "@/components/agent/AgentTraceTree";
import type { AgentUiOption } from "@/lib/agent/config/types";
import type { AgentAnswer } from "@/lib/agent/types";

export type AgentPanelRunOptions = {
  /** Voláno pro každou fázi při streamovaném běhu (/api/agent/stream). */
  onPhase?: (label: string) => void;
  /** Tokeny úvahy thinking orchestrátoru (jen profil thinking). */
  onOrchestratorDelta?: (chunk: string) => void;
};

export type ConfigurableAgentPanelProps = {
  agents: AgentUiOption[];
  defaultAgentId: string;
  onRun: (
    params: { question: string; agentId: string },
    options?: AgentPanelRunOptions
  ) => Promise<AgentAnswer>;
  getAccessToken: () => Promise<string | null>;
};

export function ConfigurableAgentPanel({ agents, defaultAgentId, onRun, getAccessToken }: ConfigurableAgentPanelProps) {
  const [agentId, setAgentId] = useState(defaultAgentId);
  const [question, setQuestion] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<AgentAnswer | null>(null);
  const [phaseLog, setPhaseLog] = useState<string[]>([]);
  const [orchestratorStreamText, setOrchestratorStreamText] = useState("");

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setResult(null);
    setPhaseLog([]);
    setOrchestratorStreamText("");

    if (!question.trim()) {
      setError("Zadejte text dotazu.");
      return;
    }

    setLoading(true);
    try {
      const payload = await onRun({ question: question.trim(), agentId }, {
        onPhase: (label) => {
          setPhaseLog((prev) => [...prev, label]);
        },
        onOrchestratorDelta: (chunk) => {
          setOrchestratorStreamText((prev) => prev + chunk);
        }
      });
      setResult(payload);
      setOrchestratorStreamText("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Neznámá chyba");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ display: "grid", gap: 16 }}>
      <form onSubmit={(e) => void handleSubmit(e)} style={{ display: "grid", gap: 12 }}>
        <fieldset style={{ border: "1px solid #cbd5e1", borderRadius: 8, padding: 12 }}>
          <legend style={{ fontWeight: 600 }}>Profil agenta</legend>
          <div style={{ display: "grid", gap: 10 }}>
            {agents.map((a) => (
              <label
                key={a.id}
                style={{
                  display: "grid",
                  gridTemplateColumns: "auto 1fr",
                  gap: 8,
                  alignItems: "start",
                  cursor: "pointer"
                }}
              >
                <input
                  type="radio"
                  name="agent"
                  checked={agentId === a.id}
                  onChange={() => setAgentId(a.id)}
                />
                <span>
                  <strong>{a.label}</strong>
                  <span style={{ color: "#64748b" }}> ({a.mode})</span>
                  <br />
                  <small style={{ color: "#475569" }}>{a.description}</small>
                </span>
              </label>
            ))}
          </div>
        </fieldset>

        <label style={{ display: "grid", gap: 6 }}>
          <span style={{ fontWeight: 600 }}>Dotaz</span>
          <textarea
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            rows={4}
            placeholder="Zadejte vlastní dotaz nebo zadání pro agenta."
          />
        </label>

        <button type="submit" disabled={loading || !question.trim()}>
          {loading ? "Zpracovávám..." : "Spustit agenta"}
        </button>
      </form>

      {error ? <p style={{ color: "crimson" }}>{error}</p> : null}

      {loading || phaseLog.length > 0 ? (
        <section
          style={{
            border: "1px dashed #94a3b8",
            borderRadius: 8,
            padding: 12,
            background: "#f8fafc"
          }}
          aria-live="polite"
        >
          <div style={{ fontWeight: 600, marginBottom: 8 }}>Průběh</div>
          {loading && phaseLog.length === 0 ? (
            <p style={{ margin: 0, color: "#64748b", fontSize: 14 }}>Zahajuji…</p>
          ) : null}
          <ol style={{ margin: 0, paddingLeft: 22, fontSize: 14, color: "#334155", lineHeight: 1.5 }}>
            {phaseLog.map((line, i) => (
              <li key={`${i}-${line.slice(0, 24)}`}>{line}</li>
            ))}
          </ol>
          {loading ? (
            <p style={{ margin: "10px 0 0", fontSize: 13, color: "#64748b" }}>Probíhá zpracování…</p>
          ) : null}
        </section>
      ) : null}

      {agentId === "thinking-orchestrator" && (loading || orchestratorStreamText.length > 0) ? (
        <section
          style={{
            border: "1px solid #bfdbfe",
            borderRadius: 8,
            padding: 12,
            background: "#eff6ff"
          }}
          aria-live="polite"
        >
          <div style={{ fontWeight: 600, marginBottom: 8, color: "#1e3a5f" }}>Úvaha orchestrátoru</div>
          <p style={{ margin: 0, whiteSpace: "pre-wrap", fontSize: 14, color: "#1e293b", lineHeight: 1.55 }}>
            {orchestratorStreamText}
            {loading && orchestratorStreamText.length === 0 ? (
              <span style={{ color: "#64748b" }}>Čekám na první tokeny…</span>
            ) : null}
          </p>
        </section>
      ) : null}

      {result ? (
        <section style={{ borderTop: "1px solid #e2e8f0", paddingTop: 16 }}>
          <h2 style={{ margin: "0 0 12px" }}>Výsledek</h2>
          <div
            style={{
              display: "grid",
              gridTemplateColumns:
                result.dataPanel?.kind === "market_listings"
                  ? "1fr minmax(320px, 520px)"
                  : result.dataPanel
                    ? "1fr minmax(300px, 420px)"
                    : "1fr",
              gap: 20,
              alignItems: "start"
            }}
          >
            <div style={{ display: "grid", gap: 12, minWidth: 0 }}>
              {result.orchestration ? (
                <div
                  style={{
                    background: "#f1f5f9",
                    borderRadius: 8,
                    padding: 12,
                    fontSize: 14
                  }}
                >
                  <div style={{ fontWeight: 600, marginBottom: 6 }}>
                    Orchestrace: {result.orchestration.agentId} ({result.orchestration.mode})
                  </div>
                  {result.orchestration.reasoning ? (
                    <div>
                      <div style={{ fontWeight: 600, marginBottom: 4 }}>Úvaha orchestrátoru</div>
                      <p style={{ margin: 0, whiteSpace: "pre-wrap" }}>{result.orchestration.reasoning}</p>
                    </div>
                  ) : (
                    <p style={{ margin: 0, color: "#64748b" }}>Bez rozšířené úvahy (základní režim).</p>
                  )}
                </div>
              ) : null}

              <div>
                <div style={{ fontWeight: 600, marginBottom: 6 }}>Odpověď</div>
                <p style={{ margin: 0, whiteSpace: "pre-wrap" }}>{result.answer_text}</p>
              </div>

              <div style={{ fontSize: 14, color: "#475569" }}>
                Spolehlivost: {result.confidence.toFixed(2)} · Zdroje: {result.sources.join(", ") || "—"}
              </div>

              {result.next_actions.length > 0 ? (
                <div>
                  <div style={{ fontWeight: 600, marginBottom: 4 }}>Další kroky</div>
                  <ul style={{ margin: 0, paddingLeft: 20 }}>
                    {result.next_actions.map((a, i) => (
                      <li key={i}>{a}</li>
                    ))}
                  </ul>
                </div>
              ) : null}

              {result.generated_artifacts.length > 0 ? (
                <div>
                  <div style={{ fontWeight: 600, marginBottom: 4 }}>Artefakty</div>
                  <ul style={{ margin: 0, paddingLeft: 20 }}>
                    {result.generated_artifacts.map((art, i) => (
                      <li key={i}>
                        {art.label}
                        {art.url ? (
                          <>
                            {" "}
                            <a href={art.url} target="_blank" rel="noreferrer">
                              odkaz
                            </a>
                          </>
                        ) : null}
                        {art.content && !art.url ? (
                          <pre style={{ fontSize: 12, whiteSpace: "pre-wrap", maxHeight: 160, overflow: "auto" }}>
                            {art.content.slice(0, 2000)}
                            {art.content.length > 2000 ? "…" : ""}
                          </pre>
                        ) : null}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}

              {result.runId ? <AgentTraceTree runId={result.runId} getAccessToken={getAccessToken} /> : null}

              {result.dataPanel ? null : (
                <p style={{ margin: 0, fontSize: 13, color: "#94a3b8" }}>
                  Graf a tabulka z databáze se zobrazí u analytických dotazů na nové klienty (Q1). Nabídky z portálů jako karty
                  u dotazů na trh (Sreality / Bezrealitky).
                </p>
              )}
            </div>

            {result.dataPanel ? (
              <AgentDataPanel panel={result.dataPanel} getAccessToken={getAccessToken} />
            ) : null}
          </div>
        </section>
      ) : null}
    </div>
  );
}
