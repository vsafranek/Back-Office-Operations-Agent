"use client";

import { useEffect, useMemo, useState } from "react";
import type { ViewingEmailRecipientCandidate } from "@/lib/agent/types";
import { ensureViewingEmailSignOff, stripViewingEmailSignOff } from "@/lib/agent/viewing-email-sign-off";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const panelChrome = {
  display: "grid" as const,
  gap: 16,
  alignContent: "start" as const,
  border: "1px solid #e2e8f0",
  borderRadius: 10,
  padding: 14,
  background: "#fafafa"
};

function isProbablyValidEmail(s: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s.trim());
}

type Props = {
  senderDisplayName?: string;
  /** Nemovitost z CRM (lead → property), kvůli kontextu v e-mailu. */
  propertySummary?: string | null;
  draft: { to: string; subject: string; body: string };
  /** Předvyplněné UUID leadů z agenta; uživatel může upravit před odesláním. */
  relatedLeadIds?: string[];
  recipientCandidates?: ViewingEmailRecipientCandidate[];
  getAccessToken?: () => Promise<string | null>;
  conversationId?: string | null;
  agentRunId?: string | null;
  /** Synchronizace těla s výběrem termínu ve chatu (nadřazený stav na dashboardu). */
  onBodyChange?: (body: string) => void;
};

export function ViewingEmailDraftPanel({
  senderDisplayName,
  propertySummary,
  draft,
  relatedLeadIds,
  recipientCandidates = [],
  getAccessToken,
  conversationId,
  agentRunId,
  onBodyChange
}: Props) {
  const [to, setTo] = useState(draft.to);
  const [subject, setSubject] = useState(draft.subject);
  const [body, setBody] = useState(draft.body);
  const [leadIds, setLeadIds] = useState<string[]>(() => relatedLeadIds?.filter((id) => UUID_RE.test(id)) ?? []);
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

  const runKey = `${conversationId ?? ""}:${agentRunId ?? ""}`;
  useEffect(() => {
    let initialTo = (draft.to ?? "").trim();
    if (!initialTo && recipientCandidates.length === 1) {
      const c = recipientCandidates[0]!;
      if (isProbablyValidEmail(c.email)) initialTo = c.email.trim();
    }
    setTo(initialTo);
    setSubject(draft.subject);
    setDraftSaved(null);
    setLastSavedForm(null);
    setSent(null);
    setConfirmSend(false);
    setError(null);

    const lids = relatedLeadIds?.filter((id) => UUID_RE.test(id)) ?? [];
    if (
      recipientCandidates.length === 1 &&
      initialTo === recipientCandidates[0]!.email.trim() &&
      recipientCandidates[0]!.kind === "lead"
    ) {
      const id = recipientCandidates[0]!.id;
      if (UUID_RE.test(id) && !lids.includes(id)) lids.push(id);
    }
    setLeadIds(lids);
    // Panel má `key` podle běhu — synchronizace stavu jen při novém návrhu z agenta.
  }, [runKey]);

  const signName = senderDisplayName?.trim() ?? "";

  useEffect(() => {
    const raw = draft.body;
    const next =
      signName.length > 0
        ? ensureViewingEmailSignOff(stripViewingEmailSignOff(raw, signName), signName)
        : raw;
    setBody(next);
  }, [draft.body, signName]);

  const displayName = senderDisplayName?.trim() || "přihlášeného uživatele";

  const emailOk = isProbablyValidEmail(to);

  function pickRecipientCandidate(c: ViewingEmailRecipientCandidate) {
    setTo(c.email);
    if (c.kind === "lead" && UUID_RE.test(c.id)) {
      setLeadIds((prev) => (prev.includes(c.id) ? prev : [...prev, c.id]));
    }
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
      const res = await fetch("/api/mail/email-draft", {
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
      setError("Nejprve uložte draft (Gmail / Outlook).");
      return;
    }
    if (formDirty) {
      setError("Obsah se změnil po uložení draftu — nejprve znovu uložte draft.");
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
      const res = await fetch("/api/mail/email-send", {
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
      const res = await fetch("/api/mail/email-send", {
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
        <h2 style={{ margin: "0 0 6px", fontSize: 18 }}>Návrh e-mailu (prohlídka)</h2>
        <p style={{ margin: 0, fontSize: 13, color: "#64748b" }}>
          Text je od <strong>{displayName}</strong> (podpis v těle zprávy se sjednocuje automaticky). Kalendář a výběr
          termínu jsou ve vláknu chatu pod odpovědí agenta. Zde doplňte příjemce, upravte znění a{" "}
          <strong>uložte draft</strong> nebo po potvrzení <strong>odešlete</strong>. Vazby na leady z odpovědi agenta se
          do auditu přidají automaticky při uložení a odeslání.
        </p>
      </div>

      {propertySummary?.trim() ? (
        <div
          style={{
            padding: "10px 12px",
            borderRadius: 8,
            border: "1px solid #bae6fd",
            background: "#f0f9ff",
            fontSize: 13,
            color: "#0c4a6e"
          }}
        >
          <div style={{ fontWeight: 600, marginBottom: 4 }}>Nemovitost (z CRM)</div>
          <p style={{ margin: 0, lineHeight: 1.45 }}>{propertySummary.trim()}</p>
        </div>
      ) : null}

      <div style={{ display: "grid", gap: 10 }}>
        {recipientCandidates.length > 0 ? (
          <div style={{ display: "grid", gap: 8, fontSize: 13 }}>
            <span style={{ fontWeight: 600 }}>Kandidáti z CRM</span>
            <p style={{ margin: 0, fontSize: 12, color: "#64748b" }}>
              Kliknutím vyplníte adresu (u leadu současně přidáte UUID do propojených leadů).
            </p>
            <ul style={{ margin: 0, paddingLeft: 18, color: "#334155" }}>
              {recipientCandidates.map((c, idx) => (
                <li key={`${c.kind}-${c.id}`} style={{ marginBottom: 6 }}>
                  <span style={{ marginRight: 8 }}>
                    {idx + 1}. {c.fullName?.trim() || "(bez jména)"} · {c.email}{" "}
                    <span style={{ color: "#64748b" }}>({c.kind})</span>
                  </span>
                  <button
                    type="button"
                    onClick={() => pickRecipientCandidate(c)}
                    disabled={Boolean(sent)}
                    style={{
                      fontSize: 12,
                      padding: "4px 10px",
                      borderRadius: 6,
                      border: "1px solid #cbd5e1",
                      background: "#fff",
                      cursor: sent ? "default" : "pointer"
                    }}
                  >
                    Použít
                  </button>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
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
            onChange={(e) => {
              const v = e.target.value;
              setBody(v);
              onBodyChange?.(v);
            }}
            rows={14}
            style={{
              padding: "8px 10px",
              borderRadius: 8,
              border: "1px solid #cbd5e1",
              fontSize: 14,
              fontFamily: "inherit",
              resize: "vertical",
              minHeight: 220,
              maxHeight: "min(52vh, 520px)",
              overflowY: "auto",
              lineHeight: 1.5
            }}
          />
        </label>
      </div>

      {formDirty && draftSaved ? (
        <p style={{ margin: 0, fontSize: 12, color: "#b45309" }}>
          Text se liší od naposledy uloženého draftu — před odesláním znovu uložte draft.
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
            Potvrzuji nevratné odeslání e-mailu příjemci <strong>{to.trim() || "—"}</strong> z mého připojeného účtu
            (Gmail / Outlook — rovnou nebo z uloženého draftu).
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
          {loadingDraft ? "Ukládám draft…" : "Uložit draft"}
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
            Draft uložen
            {draftSaved.draftId ? ` (id: ${draftSaved.draftId})` : ""}. V poště (Gmail / Outlook) ho můžete upravit mezi
            koncepty a odeslat odtud z uložené verze.
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
