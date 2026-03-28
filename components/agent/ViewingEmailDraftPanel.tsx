"use client";

import { useEffect, useMemo, useState } from "react";
import { CalendarPreviewStrip } from "@/components/agent/CalendarPreviewStrip";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const panelChrome = {
  position: "sticky" as const,
  top: 12,
  display: "grid" as const,
  gap: 16,
  alignContent: "start" as const,
  border: "1px solid #e2e8f0",
  borderRadius: 10,
  padding: 14,
  background: "#fafafa",
  maxHeight: "calc(100vh - 48px)",
  overflow: "auto" as const
};

function formatSlotRange(startIso: string, endIso: string): string {
  try {
    const s = new Date(startIso);
    const e = new Date(endIso);
    if (Number.isNaN(s.getTime())) return startIso;
    const d = s.toLocaleDateString("cs-CZ", { weekday: "short", day: "numeric", month: "short" });
    const t1 = s.toLocaleTimeString("cs-CZ", { hour: "2-digit", minute: "2-digit" });
    const t2 = e.toLocaleTimeString("cs-CZ", { hour: "2-digit", minute: "2-digit" });
    return `${d} ${t1}–${t2}`;
  } catch {
    return `${startIso} – ${endIso}`;
  }
}

function isProbablyValidEmail(s: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s.trim());
}

type Props = {
  slots: { start: string; end: string }[];
  calendarPreview?: {
    busy: { start: string; end: string }[];
    rangeStart: string;
    rangeEnd: string;
  };
  senderDisplayName?: string;
  draft: { to: string; subject: string; body: string };
  /** Předvyplněné UUID leadů z agenta; uživatel může upravit před odesláním. */
  relatedLeadIds?: string[];
  getAccessToken?: () => Promise<string | null>;
  conversationId?: string | null;
  agentRunId?: string | null;
};

export function ViewingEmailDraftPanel({
  slots,
  calendarPreview,
  senderDisplayName,
  draft,
  relatedLeadIds,
  getAccessToken,
  conversationId,
  agentRunId
}: Props) {
  const [to, setTo] = useState(draft.to);
  const [subject, setSubject] = useState(draft.subject);
  const [body, setBody] = useState(draft.body);
  const [leadIds, setLeadIds] = useState<string[]>(() => relatedLeadIds?.filter((id) => UUID_RE.test(id)) ?? []);
  const [leadIdInput, setLeadIdInput] = useState("");
  const [loadingDraft, setLoadingDraft] = useState(false);
  const [loadingSend, setLoadingSend] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [draftSaved, setDraftSaved] = useState<{ draftId: string | null } | null>(null);
  const [lastSavedForm, setLastSavedForm] = useState<{
    to: string;
    subject: string;
    body: string;
  } | null>(null);
  const [confirmSend, setConfirmSend] = useState(false);
  const [sent, setSent] = useState<{ messageId: string | null } | null>(null);

  useEffect(() => {
    setLeadIds(relatedLeadIds?.filter((id) => UUID_RE.test(id)) ?? []);
  }, [relatedLeadIds]);

  const displayName = senderDisplayName?.trim() || "přihlášeného uživatele";
  const previewRange = useMemo(() => {
    if (calendarPreview?.rangeStart && calendarPreview?.rangeEnd) {
      return { busy: calendarPreview.busy ?? [], rangeStart: calendarPreview.rangeStart, rangeEnd: calendarPreview.rangeEnd };
    }
    if (slots.length === 0) return null;
    const starts = slots.map((s) => new Date(s.start).getTime()).filter((t) => !Number.isNaN(t));
    const ends = slots.map((s) => new Date(s.end).getTime()).filter((t) => !Number.isNaN(t));
    if (starts.length === 0 || ends.length === 0) return null;
    return {
      busy: [] as { start: string; end: string }[],
      rangeStart: new Date(Math.min(...starts)).toISOString(),
      rangeEnd: new Date(Math.max(...ends)).toISOString()
    };
  }, [calendarPreview, slots]);

  const emailOk = isProbablyValidEmail(to);

  function addLeadId() {
    const v = leadIdInput.trim();
    if (!UUID_RE.test(v) || leadIds.includes(v)) return;
    setLeadIds((prev) => [...prev, v]);
    setLeadIdInput("");
  }

  function removeLeadId(id: string) {
    setLeadIds((prev) => prev.filter((x) => x !== id));
  }

  const leadIdsPayload = leadIds.length > 0 ? leadIds : undefined;

  const formDirty = useMemo(() => {
    if (!lastSavedForm) return false;
    return (
      to.trim() !== lastSavedForm.to ||
      subject.trim() !== lastSavedForm.subject ||
      body !== lastSavedForm.body
    );
  }, [to, subject, body, lastSavedForm]);

  async function handleCreateDraft() {
    setError(null);
    setConfirmSend(false);
    const token = getAccessToken ? await getAccessToken() : null;
    if (!token) {
      setError("Pro uložení draftu se přihlaste.");
      return;
    }
    if (!emailOk) {
      setError("Zadejte platnou e-mailovou adresu příjemce.");
      return;
    }

    setLoadingDraft(true);
    try {
      const res = await fetch("/api/google/email-draft", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          to: to.trim(),
          subject: subject.trim(),
          body,
          conversationId: conversationId ?? null,
          agentRunId: agentRunId ?? null,
          leadIds: leadIdsPayload
        })
      });
      const data = (await res.json()) as { draftId?: string | null; error?: string };
      if (!res.ok) {
        setError(data.error ?? "Uložení draftu se nezdařilo.");
        return;
      }
      setDraftSaved({ draftId: data.draftId ?? null });
      setLastSavedForm({ to: to.trim(), subject: subject.trim(), body });
      setSent(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Neznámá chyba");
    } finally {
      setLoadingDraft(false);
    }
  }

  async function handleSend() {
    setError(null);
    if (!draftSaved?.draftId) {
      setError("Nejprve uložte draft v Gmailu.");
      return;
    }
    if (formDirty) {
      setError("Obsah se změnil po uložení draftu — nejprve znovu klikněte na „Uložit draft v Gmailu“.");
      return;
    }
    if (!confirmSend) {
      setError("Zaškrtněte potvrzení odeslání.");
      return;
    }
    const token = getAccessToken ? await getAccessToken() : null;
    if (!token) {
      setError("Pro odeslání se přihlaste.");
      return;
    }

    setLoadingSend(true);
    try {
      const res = await fetch("/api/google/email-send", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          strategy: "from_draft" as const,
          confirmSend: true as const,
          draftId: draftSaved.draftId,
          to: to.trim(),
          subject: subject.trim(),
          body,
          conversationId: conversationId ?? null,
          agentRunId: agentRunId ?? null,
          leadIds: leadIdsPayload
        })
      });
      const data = (await res.json()) as { messageId?: string | null; error?: string };
      if (!res.ok) {
        setError(data.error ?? "Odeslání se nezdařilo.");
        return;
      }
      setSent({ messageId: data.messageId ?? null });
      setConfirmSend(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Neznámá chyba");
    } finally {
      setLoadingSend(false);
    }
  }

  async function handleSendDirect() {
    setError(null);
    if (!confirmSend) {
      setError("Zaškrtněte potvrzení odeslání.");
      return;
    }
    const token = getAccessToken ? await getAccessToken() : null;
    if (!token) {
      setError("Pro odeslání se přihlaste.");
      return;
    }
    if (!emailOk) {
      setError("Zadejte platnou e-mailovou adresu příjemce.");
      return;
    }
    if (!subject.trim() || !body.trim()) {
      setError("Vyplňte předmět a tělo zprávy.");
      return;
    }

    setLoadingSend(true);
    try {
      const res = await fetch("/api/google/email-send", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          strategy: "direct" as const,
          confirmSend: true as const,
          to: to.trim(),
          subject: subject.trim(),
          body,
          conversationId: conversationId ?? null,
          agentRunId: agentRunId ?? null,
          leadIds: leadIdsPayload
        })
      });
      const data = (await res.json()) as { messageId?: string | null; error?: string };
      if (!res.ok) {
        setError(data.error ?? "Odeslání se nezdařilo.");
        return;
      }
      setSent({ messageId: data.messageId ?? null });
      setConfirmSend(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Neznámá chyba");
    } finally {
      setLoadingSend(false);
    }
  }

  return (
    <div style={panelChrome}>
      <div>
        <h2 style={{ margin: "0 0 6px", fontSize: 18 }}>Prohlídka a e-mail</h2>
        <p style={{ margin: 0, fontSize: 13, color: "#64748b" }}>
          Volné termíny z Google Calendar (free/busy). E-mail je připraven v podobě od{" "}
          <strong>{displayName}</strong>. Můžete <strong>uložit draft</strong> v Gmailu, nebo po potvrzení{" "}
          <strong>odeslat rovnou</strong> bez draftu; z uloženého draftu lze také odeslat (BOA-004). Volitelně
          propojte <strong>UUID leadů</strong> s auditním záznamem.
        </p>
      </div>

      <div>
        <div style={{ fontWeight: 600, marginBottom: 8, fontSize: 14 }}>Navržené termíny</div>
        {slots.length === 0 ? (
          <p style={{ margin: 0, fontSize: 13, color: "#64748b" }}>Žádné volné sloty v zadaném horizontu.</p>
        ) : (
          <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13, color: "#334155" }}>
            {slots.map((s, i) => (
              <li key={`${s.start}-${i}`} style={{ marginBottom: 4 }}>
                {formatSlotRange(s.start, s.end)}
              </li>
            ))}
          </ul>
        )}
      </div>

      {previewRange ? (
        <div
          style={{
            border: "1px solid #e2e8f0",
            borderRadius: 8,
            padding: 12,
            background: "#fff"
          }}
        >
          <div style={{ fontWeight: 600, marginBottom: 10, fontSize: 14 }}>Náhled kalendáře</div>
          <p style={{ margin: "0 0 10px", fontSize: 12, color: "#64748b" }}>
            {previewRange.busy.length > 0
              ? "Šedě jsou vaše obsazené úseky (free/busy), zeleně navrhované prohlídky v tomto e-mailu."
              : "Zeleně jsou navrhované prohlídky; obsazenost kalendáře nebyla k dispozici (starší odpověď nebo bez free/busy)."}
          </p>
          <CalendarPreviewStrip
            busy={previewRange.busy}
            proposedSlots={slots}
            rangeStart={previewRange.rangeStart}
            rangeEnd={previewRange.rangeEnd}
          />
        </div>
      ) : null}

      <div style={{ display: "grid", gap: 10 }}>
        <label style={{ display: "grid", gap: 4, fontSize: 13 }}>
          <span style={{ fontWeight: 600 }}>Komu (e-mail)</span>
          <input
            type="email"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            autoComplete="email"
            placeholder="zajemce@example.com"
            style={{
              padding: "8px 10px",
              borderRadius: 8,
              border: "1px solid #cbd5e1",
              fontSize: 14
            }}
          />
        </label>
        <label style={{ display: "grid", gap: 4, fontSize: 13 }}>
          <span style={{ fontWeight: 600 }}>Předmět</span>
          <input
            type="text"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            style={{
              padding: "8px 10px",
              borderRadius: 8,
              border: "1px solid #cbd5e1",
              fontSize: 14
            }}
          />
        </label>
        <label style={{ display: "grid", gap: 4, fontSize: 13 }}>
          <span style={{ fontWeight: 600 }}>Tělo zprávy</span>
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={12}
            style={{
              padding: "8px 10px",
              borderRadius: 8,
              border: "1px solid #cbd5e1",
              fontSize: 14,
              fontFamily: "inherit",
              resize: "vertical"
            }}
          />
        </label>
        <div style={{ display: "grid", gap: 8, fontSize: 13 }}>
          <span style={{ fontWeight: 600 }}>Propojené leady (UUID)</span>
          <p style={{ margin: 0, fontSize: 12, color: "#64748b" }}>
            Záznam draftu/odeslání v aplikaci se propojí s těmito leady (tabulka vazeb v databázi).
          </p>
          {leadIds.length > 0 ? (
            <ul style={{ margin: 0, paddingLeft: 18, color: "#334155" }}>
              {leadIds.map((id) => (
                <li key={id} style={{ marginBottom: 4, display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                  <code style={{ fontSize: 12 }}>{id}</code>
                  <button
                    type="button"
                    onClick={() => removeLeadId(id)}
                    disabled={Boolean(sent)}
                    style={{ fontSize: 12, color: "#b91c1c", background: "none", border: "none", cursor: sent ? "default" : "pointer" }}
                  >
                    odebrat
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p style={{ margin: 0, fontSize: 12, color: "#64748b" }}>Žádné leady — audit bude bez vazby na lead.</p>
          )}
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
            <input
              type="text"
              value={leadIdInput}
              onChange={(e) => setLeadIdInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  addLeadId();
                }
              }}
              placeholder="např. bbbbbbb1-bbbb-bbbb-bbbb-bbbbbbbbbbb1"
              disabled={Boolean(sent)}
              style={{
                flex: "1 1 220px",
                minWidth: 0,
                padding: "8px 10px",
                borderRadius: 8,
                border: "1px solid #cbd5e1",
                fontSize: 13,
                fontFamily: "monospace"
              }}
            />
            <button
              type="button"
              onClick={() => addLeadId()}
              disabled={Boolean(sent) || !leadIdInput.trim()}
              style={{
                padding: "8px 12px",
                borderRadius: 8,
                border: "1px solid #cbd5e1",
                fontWeight: 600,
                fontSize: 13,
                cursor: sent ? "not-allowed" : "pointer",
                background: "#fff"
              }}
            >
              Přidat lead
            </button>
          </div>
        </div>
      </div>

      {formDirty && draftSaved ? (
        <p style={{ margin: 0, fontSize: 12, color: "#b45309" }}>
          Text se liší od naposledy uloženého draftu v Gmailu — před odesláním znovu klikněte na „Uložit draft v
          Gmailu“.
        </p>
      ) : null}

      {error ? (
        <p style={{ margin: 0, fontSize: 13, color: "#b91c1c" }} role="alert">
          {error}
        </p>
      ) : null}

      {sent ? (
        <p style={{ margin: 0, fontSize: 13, color: "#047857" }} role="status">
          E-mail byl odeslán
          {sent.messageId ? ` (zpráva ${sent.messageId.slice(0, 12)}…)` : ""}. Odeslání je zaznamenáno v auditním
          logu aplikace.
        </p>
      ) : null}

      {!sent ? (
        <label
          style={{
            display: "flex",
            gap: 10,
            alignItems: "flex-start",
            fontSize: 13,
            cursor: loadingSend || loadingDraft ? "default" : "pointer"
          }}
        >
          <input
            type="checkbox"
            checked={confirmSend}
            disabled={loadingSend || loadingDraft}
            onChange={(e) => setConfirmSend(e.target.checked)}
          />
          <span>
            Potvrzuji nevratné odeslání e-mailu příjemci <strong>{to.trim() || "—"}</strong> z mého účtu Gmail
            (rovnou nebo z uloženého draftu).
          </span>
        </label>
      ) : null}

      <div style={{ display: "flex", flexWrap: "wrap", gap: 10, alignItems: "center" }}>
        <button
          type="button"
          onClick={() => void handleCreateDraft()}
          disabled={loadingDraft || loadingSend || !emailOk || !subject.trim() || !body.trim() || Boolean(sent)}
          style={{
            padding: "10px 16px",
            borderRadius: 8,
            border: "none",
            fontWeight: 600,
            fontSize: 14,
            cursor:
              loadingDraft || loadingSend || !emailOk || sent ? "not-allowed" : "pointer",
            background:
              loadingDraft || !emailOk || sent ? "#94a3b8" : "linear-gradient(180deg,#3b82f6,#1d4ed8)",
            color: "#fff"
          }}
        >
          {loadingDraft ? "Ukládám draft…" : "Uložit draft v Gmailu"}
        </button>
        <button
          type="button"
          onClick={() => void handleSendDirect()}
          disabled={
            loadingSend ||
            loadingDraft ||
            !emailOk ||
            !subject.trim() ||
            !body.trim() ||
            !confirmSend ||
            Boolean(sent)
          }
          style={{
            padding: "10px 16px",
            borderRadius: 8,
            border: "1px solid #b45309",
            fontWeight: 600,
            fontSize: 14,
            cursor:
              loadingSend || !confirmSend || !emailOk || sent ? "not-allowed" : "pointer",
            background: loadingSend || !confirmSend || sent ? "#f1f5f9" : "#fff7ed",
            color: "#9a3412"
          }}
        >
          {loadingSend ? "Odesílám…" : "Odeslat rovnou"}
        </button>
      </div>

      {draftSaved && !sent ? (
        <div
          style={{
            borderTop: "1px solid #e2e8f0",
            paddingTop: 14,
            display: "grid",
            gap: 12
          }}
        >
          <p style={{ margin: 0, fontSize: 13, color: "#334155" }}>
            Draft v Gmailu
            {draftSaved.draftId ? ` (id: ${draftSaved.draftId})` : ""}. Můžete ho upravit v Gmailu → Drafty a odeslat
            odtud z uložené verze.
          </p>
          <button
            type="button"
            onClick={() => void handleSend()}
            disabled={
              loadingSend ||
              loadingDraft ||
              !draftSaved.draftId ||
              !confirmSend ||
              formDirty ||
              !emailOk
            }
            style={{
              padding: "10px 16px",
              borderRadius: 8,
              border: "1px solid #b45309",
              fontWeight: 600,
              fontSize: 14,
              cursor:
                loadingSend || !confirmSend || formDirty ? "not-allowed" : "pointer",
              background: loadingSend || !confirmSend || formDirty ? "#f1f5f9" : "#fff7ed",
              color: "#9a3412"
            }}
          >
            {loadingSend ? "Odesílám…" : "Odeslat z uloženého draftu"}
          </button>
        </div>
      ) : null}
    </div>
  );
}
