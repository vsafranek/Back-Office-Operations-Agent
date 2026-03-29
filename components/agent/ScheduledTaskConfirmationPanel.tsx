"use client";

import { useEffect, useState } from "react";
import type { AgentDataPanel } from "@/lib/agent/types";

const panelChrome = {
  position: "sticky" as const,
  top: 12,
  display: "grid" as const,
  gap: 14,
  alignContent: "start" as const,
  border: "1px solid #c4b5fd",
  borderRadius: 10,
  padding: 14,
  background: "linear-gradient(180deg, #faf5ff 0%, #f5f3ff 100%)",
  maxHeight: "calc(100vh - 48px)",
  overflow: "auto" as const
};

type Draft = Extract<AgentDataPanel, { kind: "scheduled_task_confirmation" }>["draft"];

const SYNC_SAVED = "1";
const SYNC_CANCELLED = "0";

const SCHEDULED_TASK_UI_SYNC = "scheduled-task-ui-sync";

function dispatchScheduledTaskUiSync(storageKey: string) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(SCHEDULED_TASK_UI_SYNC, { detail: { key: storageKey } }));
}

export function ScheduledTaskConfirmationPanel({
  draft,
  getAccessToken,
  syncKey
}: {
  draft: Draft;
  getAccessToken?: () => Promise<string | null>;
  /** Sdílí stav Potvrzeno / Zrušeno mezi chatovou sekcí a panelem Úlohy (cron), např. runId odpovědi. */
  syncKey?: string | null;
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [cancelled, setCancelled] = useState(false);

  const storageKey =
    syncKey && typeof syncKey === "string" && syncKey.trim().length > 0
      ? `scheduled_task_ui:${syncKey.trim()}`
      : null;

  useEffect(() => {
    if (!storageKey || typeof window === "undefined") return;
    const read = () => {
      const v = sessionStorage.getItem(storageKey);
      if (v === SYNC_SAVED) {
        setSaved(true);
        setCancelled(false);
      } else if (v === SYNC_CANCELLED) {
        setCancelled(true);
        setSaved(false);
      }
    };
    read();
    const onSync = (e: Event) => {
      const key = (e as CustomEvent<{ key?: string }>).detail?.key;
      if (key === storageKey) read();
    };
    window.addEventListener(SCHEDULED_TASK_UI_SYNC, onSync as EventListener);
    return () => window.removeEventListener(SCHEDULED_TASK_UI_SYNC, onSync as EventListener);
  }, [storageKey]);

  async function confirm() {
    setError(null);
    setLoading(true);
    try {
      const token = getAccessToken ? await getAccessToken() : null;
      if (!token) {
        setError("Nejste přihlášeni — obnovte stránku nebo se znovu přihlaste.");
        setLoading(false);
        return;
      }
      const res = await fetch("/api/settings/scheduled-tasks", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          title: draft.title,
          cron_expression: draft.cron_expression,
          timezone: draft.timezone,
          system_prompt: draft.system_prompt,
          user_question: draft.user_question,
          agent_id: draft.agent_id,
          enabled: true,
          ...(draft.market_listings_params != null ? { market_listings_params: draft.market_listings_params } : {})
        })
      });
      const payload = (await res.json()) as { error?: string };
      if (!res.ok) {
        setError(payload.error ?? `Chyba ${res.status}`);
        setLoading(false);
        return;
      }
      if (storageKey && typeof window !== "undefined") {
        sessionStorage.setItem(storageKey, SYNC_SAVED);
        dispatchScheduledTaskUiSync(storageKey);
      }
      setSaved(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Neznámá chyba");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={panelChrome}>
      <div>
        <h2 style={{ margin: "0 0 6px", fontSize: 17, color: "#5b21b6" }}>Potvrdit naplánovanou úlohu</h2>
        <p style={{ margin: 0, fontSize: 13, color: "#6b21a8" }}>
          Po potvrzení se úloha uloží k vašemu účtu. Spouštění probíhá z cron endpointu (např. pg_cron na Supabase), který
          volá aplikaci s tajným klíčem. U systémového zadání stačí popsat jeden běh — neopakování ani další cron (to řeší
          řádek Cron výše).
        </p>
      </div>

      <dl style={{ margin: 0, display: "grid", gap: 10, fontSize: 13 }}>
        <div>
          <dt style={{ fontWeight: 600, color: "#4c1d95" }}>Název</dt>
          <dd style={{ margin: "4px 0 0", whiteSpace: "pre-wrap" }}>{draft.title}</dd>
        </div>
        <div>
          <dt style={{ fontWeight: 600, color: "#4c1d95" }}>Cron (pg_cron, 5 polí)</dt>
          <dd style={{ margin: "4px 0 0" }}>
            <code style={{ background: "#ede9fe", padding: "2px 6px", borderRadius: 4 }}>{draft.cron_expression}</code>
          </dd>
        </div>
        <div>
          <dt style={{ fontWeight: 600, color: "#4c1d95" }}>Časová zóna</dt>
          <dd style={{ margin: "4px 0 0" }}>{draft.timezone}</dd>
        </div>
        <div>
          <dt style={{ fontWeight: 600, color: "#4c1d95" }}>Profil agenta</dt>
          <dd style={{ margin: "4px 0 0" }}>{draft.agent_id}</dd>
        </div>
        <div>
          <dt style={{ fontWeight: 600, color: "#4c1d95" }}>Systémové zadání (prompt)</dt>
          <dd style={{ margin: "4px 0 0", whiteSpace: "pre-wrap", maxHeight: 160, overflow: "auto", color: "#334155" }}>
            {draft.system_prompt}
          </dd>
        </div>
        <div>
          <dt style={{ fontWeight: 600, color: "#4c1d95" }}>Dotaz při každém běhu</dt>
          <dd style={{ margin: "4px 0 0", whiteSpace: "pre-wrap", color: "#334155" }}>{draft.user_question}</dd>
        </div>
        {draft.market_listings_params != null && Object.keys(draft.market_listings_params).length > 0 ? (
          <div>
            <dt style={{ fontWeight: 600, color: "#4c1d95" }}>Filtry nabídek (Sreality / Bezrealitky)</dt>
            <dd style={{ margin: "4px 0 0" }}>
              <pre
                style={{
                  margin: 0,
                  fontSize: 11,
                  background: "#ede9fe",
                  padding: 8,
                  borderRadius: 6,
                  overflow: "auto",
                  maxHeight: 160
                }}
              >
                {JSON.stringify(draft.market_listings_params, null, 2)}
              </pre>
            </dd>
          </div>
        ) : null}
      </dl>

      {error ? <p style={{ margin: 0, color: "#b91c1c", fontSize: 13 }}>{error}</p> : null}
      {cancelled ? (
        <p style={{ margin: 0, color: "#64748b", fontSize: 14 }}>Uložení bylo zrušeno. Můžete požádat agenta o úpravu návrhu.</p>
      ) : saved ? (
        <p style={{ margin: 0, color: "#047857", fontSize: 14, fontWeight: 600 }}>
          Úloha byla uložena. Zkontrolujte ji v Nastavení → Naplánované úlohy agenta.
        </p>
      ) : (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
          <button type="button" disabled={loading} onClick={() => void confirm()}>
            {loading ? "Ukládám…" : "Potvrdit a uložit"}
          </button>
          <button
            type="button"
            disabled={loading}
            onClick={() => {
              if (storageKey && typeof window !== "undefined") {
                sessionStorage.setItem(storageKey, SYNC_CANCELLED);
                dispatchScheduledTaskUiSync(storageKey);
              }
              setCancelled(true);
            }}
          >
            Zrušit
          </button>
        </div>
      )}
    </div>
  );
}
