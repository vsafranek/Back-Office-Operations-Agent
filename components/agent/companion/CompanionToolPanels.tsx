"use client";

import {
  ActionIcon,
  Anchor,
  Button,
  Checkbox,
  Code,
  Divider,
  Group,
  Modal,
  MultiSelect,
  NumberInput,
  Collapse,
  ScrollArea,
  Select,
  Stack,
  Text,
  Textarea,
  TextInput,
  Tooltip,
  UnstyledButton
} from "@mantine/core";
import Link from "next/link";
import { IconChevronLeft, IconChevronRight } from "@tabler/icons-react";
import { useDisclosure } from "@mantine/hooks";
import { useCallback, useEffect, useMemo, useState } from "react";
import { CalendarPreviewStrip } from "@/components/agent/CalendarPreviewStrip";
import { AgentDataPanel } from "@/components/agent/AgentDataPanel";
import { ViewingEmailDraftPanel } from "@/components/agent/ViewingEmailDraftPanel";
import { MarketListingsDataPanelSection } from "@/components/agent/MarketListingsDataPanelSection";
import { DATASET_IDS } from "@/lib/agent/tools/data-pull-plan";
import type { FetchMarketListingsInput } from "@/lib/agent/tools/market-listings-tool";
import type { AgentAnswer, AgentDataPanel as AgentDataPanelModel } from "@/lib/agent/types";
import { findViewingEmailDataPanel } from "@/lib/agent/viewing-email-answer-helpers";
import {
  companionRunNavCanGoNewer,
  companionRunNavCanGoOlder,
  companionRunNavCursor,
  companionRunNavDisplayedSlotNumber,
  companionRunNavGoNewer,
  companionRunNavGoOlder
} from "@/lib/ui/companion-run-nav";

export type VizAnswerRunOption = { runId: string; preview: string };

const VIZ_SIDEBAR_KINDS = new Set<AgentDataPanelModel["kind"]>([
  "clients_q1",
  "leads_sales_6m",
  "clients_filtered",
  "deal_sales_detail",
  "market_listings"
]);

type GmailRow = {
  id: string;
  threadId: string;
  snippet: string;
  from: string;
  subject: string;
  date: string;
};

type OutboundRow = {
  id: string;
  conversation_id: string | null;
  agent_run_id: string | null;
  action: string;
  to_email: string;
  subject: string;
  body_excerpt: string | null;
  created_at: string;
};

type CalendarEv = { id: string; summary: string; start: string; end: string; htmlLink?: string };

function isProbablyValidEmail(s: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s.trim());
}

function startOfWeekMonday(d: Date): Date {
  const x = new Date(d);
  const day = x.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  x.setDate(x.getDate() + diff);
  x.setHours(0, 0, 0, 0);
  return x;
}

function addDays(d: Date, n: number): Date {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}

export function MailToolPanel(props: {
  getAccessToken: () => Promise<string | null>;
  conversationId: string | null;
  focusRunId: string | null;
  onNavigateConversation: (conversationId: string, runId?: string | null) => void;
  /** Sloučeno s úpravou těla z chatu (výběr termínu). */
  lastAgentAnswer?: AgentAnswer | null;
  viewingEmailRuns?: VizAnswerRunOption[];
  assistantRunIdsInOrder?: string[];
  /** Stejné jako výběr běhu u Tabulka/graf — přepíná návrh v Maily. */
  onSelectViewingEmailRun?: (runId: string) => void;
  onViewingEmailBodyChange?: (body: string) => void;
}) {
  const {
    getAccessToken,
    conversationId,
    focusRunId,
    onNavigateConversation,
    lastAgentAnswer = null,
    viewingEmailRuns = [],
    assistantRunIdsInOrder = [],
    onSelectViewingEmailRun,
    onViewingEmailBodyChange
  } = props;
  const [composeExpanded, { toggle: toggleCompose }] = useDisclosure(false);
  const [messages, setMessages] = useState<GmailRow[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [detail, setDetail] = useState<{ subject: string; from: string; bodyText: string } | null>(null);
  const [composeTo, setComposeTo] = useState("");
  const [composeSubject, setComposeSubject] = useState("");
  const [composeBody, setComposeBody] = useState("");
  const [composeBusy, setComposeBusy] = useState(false);
  const [composeSendBusy, setComposeSendBusy] = useState(false);
  const [composeConfirmSend, setComposeConfirmSend] = useState(false);
  const [composeDraftSaved, setComposeDraftSaved] = useState<{ draftId: string | null } | null>(null);
  const [composeLastSaved, setComposeLastSaved] = useState<{ to: string; subject: string; body: string } | null>(null);
  const [composeSent, setComposeSent] = useState<{ messageId: string | null } | null>(null);
  const [outbound, setOutbound] = useState<OutboundRow[] | null>(null);

  const composeEmailOk = isProbablyValidEmail(composeTo);
  const composeFormDirty = useMemo(() => {
    if (!composeLastSaved) return false;
    return (
      composeTo.trim() !== composeLastSaved.to ||
      composeSubject.trim() !== composeLastSaved.subject ||
      composeBody !== composeLastSaved.body
    );
  }, [composeTo, composeSubject, composeBody, composeLastSaved]);

  const loadList = useCallback(async () => {
    setLoading(true);
    setErr(null);
    const token = await getAccessToken();
    if (!token) {
      setErr("Nejste přihlášeni.");
      setLoading(false);
      return;
    }
    const u = new URL("/api/google/gmail/messages", window.location.origin);
    u.searchParams.set("maxResults", "20");
    if (q.trim()) u.searchParams.set("q", q.trim());
    const res = await fetch(u.toString(), { headers: { Authorization: `Bearer ${token}` } });
    const data = (await res.json()) as { messages?: GmailRow[]; error?: string };
    setLoading(false);
    if (!res.ok) {
      setErr(data.error ?? "Chyba načtení pošty.");
      return;
    }
    setMessages(data.messages ?? []);
  }, [getAccessToken, q]);

  const loadOutbound = useCallback(async () => {
    const token = await getAccessToken();
    if (!token) return;
    const u = new URL("/api/mail/outbound-history", window.location.origin);
    if (conversationId) u.searchParams.set("conversationId", conversationId);
    const res = await fetch(u.toString(), { headers: { Authorization: `Bearer ${token}` } });
    const data = (await res.json()) as { items?: OutboundRow[] };
    if (res.ok) setOutbound(data.items ?? []);
  }, [getAccessToken, conversationId]);

  useEffect(() => {
    void loadList();
    void loadOutbound();
  }, [loadList, loadOutbound]);

  async function openMessage(id: string) {
    const token = await getAccessToken();
    if (!token) return;
    const res = await fetch(`/api/google/gmail/messages/${encodeURIComponent(id)}`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    const data = (await res.json()) as { subject?: string; from?: string; bodyText?: string; error?: string };
    if (!res.ok) {
      setErr(data.error ?? "Detail se nepodařil načíst.");
      return;
    }
    setDetail({
      subject: data.subject ?? "",
      from: data.from ?? "",
      bodyText: data.bodyText ?? ""
    });
  }

  async function composeSaveDraft() {
    setErr(null);
    setComposeConfirmSend(false);
    const token = await getAccessToken();
    if (!token) {
      setErr("Nejste přihlášeni.");
      return;
    }
    if (!composeEmailOk) {
      setErr("Zadejte platnou e-mailovou adresu příjemce.");
      return;
    }
    if (!composeSubject.trim() || !composeBody.trim()) {
      setErr("Vyplňte předmět a tělo zprávy.");
      return;
    }
    setComposeBusy(true);
    try {
      const res = await fetch("/api/mail/email-draft", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          to: composeTo.trim(),
          subject: composeSubject.trim(),
          body: composeBody.trim(),
          conversationId: conversationId ?? null,
          agentRunId: focusRunId ?? null
        })
      });
      const j = (await res.json()) as { draftId?: string | null; error?: string };
      if (!res.ok) {
        setErr(j.error ?? "Draft se nepodařilo vytvořit.");
        return;
      }
      setComposeDraftSaved({ draftId: j.draftId ?? null });
      setComposeLastSaved({
        to: composeTo.trim(),
        subject: composeSubject.trim(),
        body: composeBody.trim()
      });
      setComposeSent(null);
      void loadOutbound();
    } finally {
      setComposeBusy(false);
    }
  }

  async function composeSendDirect() {
    setErr(null);
    if (!composeConfirmSend) {
      setErr("Zaškrtněte potvrzení odeslání.");
      return;
    }
    const token = await getAccessToken();
    if (!token) {
      setErr("Nejste přihlášeni.");
      return;
    }
    if (!composeEmailOk || !composeSubject.trim() || !composeBody.trim()) {
      setErr("Vyplňte příjemce, předmět a tělo.");
      return;
    }
    setComposeSendBusy(true);
    try {
      const res = await fetch("/api/mail/email-send", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          strategy: "direct" as const,
          confirmSend: true as const,
          to: composeTo.trim(),
          subject: composeSubject.trim(),
          body: composeBody.trim(),
          conversationId: conversationId ?? null,
          agentRunId: focusRunId ?? null
        })
      });
      const j = (await res.json()) as { messageId?: string | null; error?: string };
      if (!res.ok) {
        setErr(j.error ?? "Odeslání se nezdařilo.");
        return;
      }
      setComposeSent({ messageId: j.messageId ?? null });
      setComposeConfirmSend(false);
      void loadOutbound();
    } finally {
      setComposeSendBusy(false);
    }
  }

  async function composeSendFromDraft() {
    setErr(null);
    if (!composeDraftSaved?.draftId) {
      setErr("Nejprve uložte draft.");
      return;
    }
    if (composeFormDirty) {
      setErr("Obsah se změnil po uložení draftu — nejprve znovu uložte draft.");
      return;
    }
    if (!composeConfirmSend) {
      setErr("Zaškrtněte potvrzení odeslání.");
      return;
    }
    const token = await getAccessToken();
    if (!token) {
      setErr("Nejste přihlášeni.");
      return;
    }
    setComposeSendBusy(true);
    try {
      const res = await fetch("/api/mail/email-send", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          strategy: "from_draft" as const,
          confirmSend: true as const,
          draftId: composeDraftSaved.draftId,
          to: composeTo.trim(),
          subject: composeSubject.trim(),
          body: composeBody.trim(),
          conversationId: conversationId ?? null,
          agentRunId: focusRunId ?? null
        })
      });
      const j = (await res.json()) as { messageId?: string | null; error?: string };
      if (!res.ok) {
        setErr(j.error ?? "Odeslání se nezdařilo.");
        return;
      }
      setComposeSent({ messageId: j.messageId ?? null });
      setComposeConfirmSend(false);
      void loadOutbound();
    } finally {
      setComposeSendBusy(false);
    }
  }

  const viewingDraft = findViewingEmailDataPanel(lastAgentAnswer);
  const mailNavRunId = lastAgentAnswer?.runId ?? focusRunId ?? null;
  const mailNavCursor = companionRunNavCursor(viewingEmailRuns, mailNavRunId, assistantRunIdsInOrder);
  const mailAnswerCount = viewingEmailRuns.length;
  const showMailAnswerNav = mailAnswerCount > 1 && onSelectViewingEmailRun != null;
  const mailDisplaySlot = companionRunNavDisplayedSlotNumber(mailNavCursor, mailAnswerCount);
  const mailPreviewText =
    mailNavCursor >= 0
      ? viewingEmailRuns[mailNavCursor]?.preview
      : mailAnswerCount > 0
        ? viewingEmailRuns[0]?.preview
        : undefined;

  return (
    <Stack gap="sm">
      <Text size="sm" c="dimmed">
        Gmail / Outlook podle nastavení integrace.{" "}
        <Anchor component={Link} href="/settings" size="sm">
          Nastavení
        </Anchor>
      </Text>

      {showMailAnswerNav ? (
        <Group justify="space-between" wrap="nowrap" gap="xs" align="center">
          <Tooltip label="Starší návrh e-mailu (dříve v konverzaci)">
            <ActionIcon
              variant="default"
              size="sm"
              aria-label="Starší návrh e-mailu"
              disabled={!companionRunNavCanGoOlder(mailNavCursor)}
              onClick={() => companionRunNavGoOlder(viewingEmailRuns, mailNavCursor, onSelectViewingEmailRun!)}
            >
              <IconChevronLeft size={18} stroke={1.5} />
            </ActionIcon>
          </Tooltip>
          <Stack gap={0} style={{ flex: 1, minWidth: 0 }}>
            <Text size="xs" ta="center" fw={600} lineClamp={1}>
              Návrh {mailDisplaySlot ?? "—"} / {mailAnswerCount}
            </Text>
            {mailPreviewText ? (
              <Text size="xs" c="dimmed" ta="center" lineClamp={2} style={{ wordBreak: "break-word" }}>
                {mailPreviewText}
              </Text>
            ) : null}
          </Stack>
          <Tooltip label="Novější návrh e-mailu">
            <ActionIcon
              variant="default"
              size="sm"
              aria-label="Novější návrh e-mailu"
              disabled={!companionRunNavCanGoNewer(mailNavCursor, mailAnswerCount)}
              onClick={() => companionRunNavGoNewer(viewingEmailRuns, mailNavCursor, onSelectViewingEmailRun!)}
            >
              <IconChevronRight size={18} stroke={1.5} />
            </ActionIcon>
          </Tooltip>
        </Group>
      ) : null}

      {viewingDraft ? (
        <>
          <Divider label="Návrh z agenta (prohlídka)" labelPosition="center" />
          <ViewingEmailDraftPanel
            key={`${conversationId ?? "no-conv"}:${lastAgentAnswer?.runId ?? focusRunId ?? "run"}`}
            senderDisplayName={viewingDraft.senderDisplayName}
            propertySummary={viewingDraft.propertySummary}
            draft={viewingDraft.draft}
            relatedLeadIds={viewingDraft.relatedLeadIds}
            recipientCandidates={viewingDraft.recipientCandidates}
            getAccessToken={getAccessToken}
            conversationId={conversationId}
            agentRunId={lastAgentAnswer?.runId ?? focusRunId}
            onBodyChange={onViewingEmailBodyChange}
          />
        </>
      ) : showMailAnswerNav ? (
        <Text size="xs" c="dimmed">
          Aktivní běh nemá návrh e-mailu v tomto panelu — šipkami přejděte na jiný návrh z konverzace.
        </Text>
      ) : null}

      <Button size="xs" variant="default" onClick={toggleCompose}>
        {composeExpanded ? "Skrýt nový e-mail" : "Nový e-mail"}
      </Button>
      <Collapse in={composeExpanded}>
        <Stack gap="xs" pt="xs">
          <Divider label="Nová zpráva" labelPosition="center" />
          <TextInput label="Komu" size="xs" value={composeTo} onChange={(e) => setComposeTo(e.currentTarget.value)} />
          <TextInput label="Předmět" size="xs" value={composeSubject} onChange={(e) => setComposeSubject(e.currentTarget.value)} />
          <Textarea label="Tělo zprávy" size="xs" minRows={6} value={composeBody} onChange={(e) => setComposeBody(e.currentTarget.value)} />
          {composeFormDirty && composeDraftSaved ? (
            <Text size="xs" c="orange">
              Text se liší od uloženého draftu — před odesláním z uloženého konceptu znovu uložte.
            </Text>
          ) : null}
          {composeSent ? (
            <Text size="xs" c="green">
              Odesláno
              {composeSent.messageId ? ` (reference ${composeSent.messageId.slice(0, 10)}…)` : ""}.
            </Text>
          ) : null}
          <Checkbox
            label={`Potvrzuji odeslání příjemci ${composeTo.trim() || "—"}`}
            checked={composeConfirmSend}
            disabled={composeBusy || composeSendBusy}
            onChange={(e) => setComposeConfirmSend(e.currentTarget.checked)}
          />
          <Group gap="xs">
            <Button size="xs" loading={composeBusy} onClick={() => void composeSaveDraft()} disabled={composeSendBusy || Boolean(composeSent)}>
              Uložit draft
            </Button>
            <Button
              size="xs"
              variant="light"
              color="orange"
              loading={composeSendBusy}
              onClick={() => void composeSendDirect()}
              disabled={
                composeBusy || !composeConfirmSend || !composeEmailOk || !composeSubject.trim() || !composeBody.trim() || Boolean(composeSent)
              }
            >
              Odeslat rovnou
            </Button>
          </Group>
          {composeDraftSaved && !composeSent ? (
            <Button
              size="xs"
              variant="outline"
              color="orange"
              loading={composeSendBusy}
              disabled={
                composeBusy ||
                !composeDraftSaved.draftId ||
                !composeConfirmSend ||
                composeFormDirty ||
                !composeEmailOk
              }
              onClick={() => void composeSendFromDraft()}
            >
              Odeslat z uloženého draftu
            </Button>
          ) : null}
        </Stack>
      </Collapse>

      <Group wrap="nowrap" gap="xs">
        <TextInput placeholder="Gmail hledání (q)…" value={q} onChange={(e) => setQ(e.currentTarget.value)} style={{ flex: 1 }} size="xs" />
        <Button size="xs" variant="light" onClick={() => void loadList()} loading={loading}>
          Načíst
        </Button>
      </Group>
      {err ? (
        <Text size="sm" c="red">
          {err}
        </Text>
      ) : null}
      {loading && messages == null ? <Text size="sm">Načítám…</Text> : null}
      <ScrollArea.Autosize mah={220} type="auto">
        <Stack gap={6}>
          {(messages ?? []).map((m) => (
            <UnstyledButton
              key={m.id}
              type="button"
              onClick={() => void openMessage(m.id)}
              style={{
                textAlign: "left",
                padding: 8,
                borderRadius: 8,
                border: "1px solid var(--mantine-color-default-border)"
              }}
            >
              <Text size="xs" fw={600} lineClamp={1}>
                {m.subject || "(Bez předmětu)"}
              </Text>
              <Text size="xs" c="dimmed" lineClamp={1}>
                {m.from}
              </Text>
              <Text size="xs" c="dimmed" lineClamp={2}>
                {m.snippet}
              </Text>
            </UnstyledButton>
          ))}
        </Stack>
      </ScrollArea.Autosize>

      <Divider label={conversationId ? "Odchozí v této konverzaci" : "Odchozí z aplikace"} labelPosition="center" />
      <Text size="xs" c="dimmed">
        Drafty i odeslané zprávy se ukládají do databáze (komu, předmět, konverzace, běh agenta) pro audit a přehled
        kontaktů.
      </Text>
      <ScrollArea.Autosize mah={180} type="auto">
        <Stack gap={6}>
          {(outbound ?? []).map((o) => (
            <div key={o.id} style={{ padding: 8, borderRadius: 8, background: "var(--mantine-color-gray-0)" }}>
              <Text size="xs" fw={600} lineClamp={1}>
                {o.subject}
              </Text>
              <Text size="xs" c="dimmed">
                → {o.to_email} · {o.action} · {new Date(o.created_at).toLocaleString("cs-CZ")}
              </Text>
              {o.conversation_id ? (
                <Button
                  size="compact-xs"
                  variant="light"
                  mt={4}
                  onClick={() => onNavigateConversation(o.conversation_id!, o.agent_run_id)}
                >
                  Otevřít konverzaci
                </Button>
              ) : null}
            </div>
          ))}
        </Stack>
      </ScrollArea.Autosize>

      <Modal opened={detail != null} onClose={() => setDetail(null)} title={detail?.subject ?? "Zpráva"} size="lg">
        {detail ? (
          <Stack gap="sm">
            <Text size="sm" c="dimmed">
              {detail.from}
            </Text>
            <Code block style={{ whiteSpace: "pre-wrap", maxHeight: 360, overflow: "auto" }}>
              {detail.bodyText}
            </Code>
          </Stack>
        ) : null}
      </Modal>
    </Stack>
  );
}

export function CalendarToolPanel({ getAccessToken }: { getAccessToken: () => Promise<string | null> }) {
  const [weekOffset, setWeekOffset] = useState(0);
  const [events, setEvents] = useState<CalendarEv[]>([]);
  const [provider, setProvider] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const range = useMemo(() => {
    const base = addDays(startOfWeekMonday(new Date()), weekOffset * 7);
    const timeMin = base.toISOString();
    const timeMax = addDays(base, 7).toISOString();
    return { timeMin, timeMax, label: `${base.toLocaleDateString("cs-CZ")} – ${addDays(base, 6).toLocaleDateString("cs-CZ")}` };
  }, [weekOffset]);

  const load = useCallback(async () => {
    setLoading(true);
    setErr(null);
    const token = await getAccessToken();
    if (!token) {
      setErr("Nejste přihlášeni.");
      setLoading(false);
      return;
    }
    const u = new URL("/api/google/calendar/events", window.location.origin);
    u.searchParams.set("timeMin", range.timeMin);
    u.searchParams.set("timeMax", range.timeMax);
    const res = await fetch(u.toString(), { headers: { Authorization: `Bearer ${token}` } });
    const data = (await res.json()) as { events?: CalendarEv[]; provider?: string; error?: string };
    setLoading(false);
    if (!res.ok) {
      setErr(data.error ?? "Kalendář se nepodařilo načíst.");
      return;
    }
    setEvents(data.events ?? []);
    setProvider(data.provider ?? "");
  }, [getAccessToken, range.timeMin, range.timeMax]);

  useEffect(() => {
    void load();
  }, [load]);

  const eventBusy = useMemo(
    () => events.map((e) => ({ start: e.start, end: e.end })).filter((b) => b.start && b.end),
    [events]
  );

  return (
    <Stack gap="sm">
      <Text size="sm" c="dimmed">
        Kalendář (Google / Microsoft dle nastavení).{" "}
        <Anchor component={Link} href="/settings" size="sm">
          Nastavení
        </Anchor>
      </Text>
      <Group justify="space-between">
        <Button size="xs" variant="default" onClick={() => setWeekOffset((w) => w - 1)}>
          ← Týden
        </Button>
        <Text size="sm" fw={600}>
          {range.label}
        </Text>
        <Button size="xs" variant="default" onClick={() => setWeekOffset((w) => w + 1)}>
          Týden →
        </Button>
      </Group>
      {provider ? (
        <Text size="xs" c="dimmed">
          Zdroj: {provider}
        </Text>
      ) : null}
      {err ? (
        <Text size="sm" c="red">
          {err}
        </Text>
      ) : null}
      {loading ? <Text size="sm">Načítám…</Text> : null}
      {!loading && !err ? (
        <div
          style={{
            border: "1px solid var(--mantine-color-default-border)",
            borderRadius: 8,
            padding: 10,
            background: "var(--mantine-color-body)"
          }}
        >
          <Text size="xs" fw={600} mb={8}>
            Přehled (mřížka 8:00–18:00, krok 30 min — stejně jako u návrhu prohlídky v chatu)
          </Text>
          <Text size="xs" c="dimmed" mb={8}>
            Šedě jsou naplánované úseky z kalendáře; u e-mailu k prohlídce agent zeleně vyznačí navrhované sloty.
          </Text>
          <CalendarPreviewStrip
            busy={eventBusy}
            proposedSlots={[]}
            rangeStart={range.timeMin}
            rangeEnd={range.timeMax}
          />
        </div>
      ) : null}
      <ScrollArea.Autosize mah={400} type="auto">
        <Stack gap={6}>
          {events.map((e) => (
            <div key={e.id} style={{ padding: 8, borderRadius: 8, border: "1px solid var(--mantine-color-default-border)" }}>
              <Text size="sm" fw={600}>
                {e.summary}
              </Text>
              <Text size="xs" c="dimmed">
                {new Date(e.start).toLocaleString("cs-CZ")} – {new Date(e.end).toLocaleString("cs-CZ")}
              </Text>
              {e.htmlLink ? (
                <Anchor href={e.htmlLink} target="_blank" rel="noreferrer" size="xs">
                  Otevřít v kalendáři
                </Anchor>
              ) : null}
            </div>
          ))}
          {!loading && events.length === 0 ? <Text size="sm" c="dimmed">Žádné události v tomto týdnu.</Text> : null}
        </Stack>
      </ScrollArea.Autosize>
    </Stack>
  );
}

const DATA_OPTIONS = DATASET_IDS.map((id) => ({ value: id, label: id }));

export function DataPresetPanel({ getAccessToken }: { getAccessToken: () => Promise<string | null> }) {
  const [dataset, setDataset] = useState<string>(DATASET_IDS[0]!);
  const [narrow, setNarrow] = useState("");
  const [limit, setLimit] = useState(80);
  const [rows, setRows] = useState<Record<string, unknown>[]>([]);
  const [source, setSource] = useState("");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function run() {
    setLoading(true);
    setErr(null);
    const token = await getAccessToken();
    if (!token) {
      setErr("Nejste přihlášeni.");
      setLoading(false);
      return;
    }
    const res = await fetch("/api/data/preset-query", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        dataset,
        row_text_narrowing: narrow.trim() || null,
        limit
      })
    });
    const data = (await res.json()) as {
      rows?: Record<string, unknown>[];
      source?: string;
      error?: string;
    };
    setLoading(false);
    if (!res.ok) {
      setErr(data.error ?? "Dotaz selhal.");
      return;
    }
    setRows(data.rows ?? []);
    setSource(data.source ?? "");
  }

  const keys = rows[0] ? Object.keys(rows[0]) : [];

  return (
    <Stack gap="sm">
      <Text size="sm" c="dimmed">
        Předdefinované datasety (bez vlastního SQL).
      </Text>
      <Select label="Dataset" data={DATA_OPTIONS} value={dataset} onChange={(v) => setDataset(v ?? DATASET_IDS[0]!)} size="xs" />
      <TextInput label="Textové zúžení (volitelně)" value={narrow} onChange={(e) => setNarrow(e.currentTarget.value)} size="xs" />
      <NumberInput label="Limit řádků" value={limit} onChange={(v) => setLimit(typeof v === "number" ? v : 80)} min={1} max={200} size="xs" />
      <Button size="xs" onClick={() => void run()} loading={loading}>
        Spustit dotaz
      </Button>
      {err ? (
        <Text size="sm" c="red">
          {err}
        </Text>
      ) : null}
      {source ? (
        <Text size="xs" c="dimmed">
          {source}
        </Text>
      ) : null}
      <ScrollArea.Autosize mah={320} type="auto">
        <div style={{ overflow: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
            <thead>
              <tr>
                {keys.map((k) => (
                  <th key={k} style={{ textAlign: "left", padding: 6, borderBottom: "1px solid #e2e8f0" }}>
                    {k}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, ri) => (
                <tr key={ri}>
                  {keys.map((k) => (
                    <td key={k} style={{ padding: 6, borderBottom: "1px solid #f1f5f9", maxWidth: 140, overflow: "hidden", textOverflow: "ellipsis" }}>
                      {row[k] == null ? "—" : String(row[k])}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </ScrollArea.Autosize>
    </Stack>
  );
}

export function MarketSidebarPanel({ getAccessToken }: { getAccessToken: () => Promise<string | null> }) {
  const [location, setLocation] = useState("Praha");
  const [sources, setSources] = useState<string[]>(["sreality", "bezrealitky"]);
  const [perPage, setPerPage] = useState(24);
  const [params, setParams] = useState<FetchMarketListingsInput | null>(null);

  function search() {
    const src = (sources.length ? sources : ["sreality"]) as ("sreality" | "bezrealitky")[];
    setParams({
      location: location.trim() || "Česko",
      sources: src,
      page: 1,
      perPage,
      srealityOfferKind: "prodej"
    });
  }

  return (
    <Stack gap="sm">
      <Text size="sm" c="dimmed">
        Rychlé stažení nabídek (stejné API jako agent).
      </Text>
      <TextInput label="Lokalita" value={location} onChange={(e) => setLocation(e.currentTarget.value)} size="xs" />
      <MultiSelect
        label="Portály"
        data={[
          { value: "sreality", label: "Sreality" },
          { value: "bezrealitky", label: "Bezrealitky" }
        ]}
        value={sources}
        onChange={setSources}
        size="xs"
      />
      <NumberInput label="Počet" value={perPage} onChange={(v) => setPerPage(typeof v === "number" ? v : 24)} min={6} max={60} size="xs" />
      <Button size="xs" onClick={search}>
        Načíst nabídky
      </Button>
      {params ? (
        <MarketListingsDataPanelSection
          title={`Nabídky · ${params.location}`}
          fetchParams={params as Record<string, unknown>}
          initialListings={[]}
          getAccessToken={getAccessToken}
        />
      ) : null}
    </Stack>
  );
}

export function VizPanel(props: {
  lastAgentAnswer: AgentAnswer | null;
  getAccessToken: () => Promise<string | null>;
  vizAnswerRuns?: VizAnswerRunOption[];
  assistantRunIdsInOrder?: string[];
  onSelectVizAnswerRun?: (runId: string) => void;
}) {
  const {
    lastAgentAnswer,
    getAccessToken,
    vizAnswerRuns = [],
    assistantRunIdsInOrder = [],
    onSelectVizAnswerRun
  } = props;

  const rawBundles =
    lastAgentAnswer?.dataPanelBundles && lastAgentAnswer.dataPanelBundles.length > 0
      ? lastAgentAnswer.dataPanelBundles
      : lastAgentAnswer?.dataPanel
        ? [
            {
              dataPanel: lastAgentAnswer.dataPanel,
              dataPanelDownloads: lastAgentAnswer.dataPanelDownloads
            }
          ]
        : [];

  const bundles = rawBundles.filter((b) => VIZ_SIDEBAR_KINDS.has(b.dataPanel.kind));

  const [bundleIndex, setBundleIndex] = useState(0);

  useEffect(() => {
    setBundleIndex(0);
  }, [lastAgentAnswer?.runId]);

  useEffect(() => {
    setBundleIndex((i) => Math.min(i, Math.max(0, bundles.length - 1)));
  }, [bundles.length]);

  const activeRunId = lastAgentAnswer?.runId ?? null;
  const answerCount = vizAnswerRuns.length;
  const navCursor = companionRunNavCursor(vizAnswerRuns, activeRunId, assistantRunIdsInOrder);
  const showAnswerNav = answerCount > 1 && onSelectVizAnswerRun != null;
  const showBundleNav = bundles.length > 1;
  const displaySlot = companionRunNavDisplayedSlotNumber(navCursor, answerCount);
  const answerPreviewText =
    navCursor >= 0
      ? vizAnswerRuns[navCursor]?.preview
      : answerCount > 0
        ? vizAnswerRuns[0]?.preview
        : undefined;

  const goOlderAnswer = () => {
    if (!onSelectVizAnswerRun) return;
    companionRunNavGoOlder(vizAnswerRuns, navCursor, onSelectVizAnswerRun);
  };
  const goNewerAnswer = () => {
    if (!onSelectVizAnswerRun) return;
    companionRunNavGoNewer(vizAnswerRuns, navCursor, onSelectVizAnswerRun);
  };

  const answerNavRow =
    showAnswerNav ? (
      <Group justify="space-between" wrap="nowrap" gap="xs" align="center">
        <Tooltip label="Starší odpověď (dříve v konverzaci)">
          <ActionIcon
            variant="default"
            size="sm"
            aria-label="Starší odpověď"
            disabled={!companionRunNavCanGoOlder(navCursor)}
            onClick={goOlderAnswer}
          >
            <IconChevronLeft size={18} stroke={1.5} />
          </ActionIcon>
        </Tooltip>
        <Stack gap={0} style={{ flex: 1, minWidth: 0 }}>
          <Text size="xs" ta="center" fw={600} lineClamp={1}>
            Odpověď {displaySlot ?? "—"} / {answerCount}
          </Text>
          {answerPreviewText ? (
            <Text size="xs" c="dimmed" ta="center" lineClamp={2} style={{ wordBreak: "break-word" }}>
              {answerPreviewText}
            </Text>
          ) : null}
        </Stack>
        <Tooltip label="Novější odpověď">
          <ActionIcon
            variant="default"
            size="sm"
            aria-label="Novější odpověď"
            disabled={!companionRunNavCanGoNewer(navCursor, answerCount)}
            onClick={goNewerAnswer}
          >
            <IconChevronRight size={18} stroke={1.5} />
          </ActionIcon>
        </Tooltip>
      </Group>
    ) : null;

  const showEmpty = !lastAgentAnswer || bundles.length === 0;

  const emptyStateText = (() => {
    if (!lastAgentAnswer) {
      return answerCount > 0
        ? "Šipkami zvolte odpověď s tabulkou nebo grafem. Aktuálně zobrazený běh k tabulce v tomto panelu neodpovídá."
        : "Tabulka nebo graf se zde objeví po běhu agenta s tabulkovým nebo grafickým panelem. Použijte středový chat nebo sekci Data.";
    }
    const hadOnlyEmail =
      rawBundles.length > 0 &&
      rawBundles.every((b) => b.dataPanel.kind === "viewing_email_draft");
    if (hadOnlyEmail) {
      return "U tohoto běhu jde o návrh e-mailu — detail je v záložce Maily. Tabulku nebo graf v konverzaci vyberte šipkami výše.";
    }
    return "Tabulka nebo graf se zde objeví po běhu agenta s tabulkovým nebo grafickým panelem. Použijte středový chat nebo sekci Data.";
  })();

  if (showEmpty) {
    return (
      <Stack gap="sm">
        {showAnswerNav ? <Stack gap={6}>{answerNavRow}</Stack> : null}
        <Text size="sm" c="dimmed">
          {emptyStateText}
        </Text>
      </Stack>
    );
  }

  const safeBundleIndex = Math.min(bundleIndex, Math.max(0, bundles.length - 1));
  const bundle = bundles[safeBundleIndex]!;

  return (
    <Stack gap="sm">
      {(showAnswerNav || showBundleNav) && (
        <Stack gap={6}>
          {answerNavRow}
          {showBundleNav ? (
            <Group justify="space-between" wrap="nowrap" gap="xs" align="center">
              <Tooltip label="Předchozí zobrazení (část výsledku)">
                <ActionIcon
                  variant="light"
                  size="sm"
                  color="gray"
                  aria-label="Předchozí část výsledku"
                  disabled={safeBundleIndex <= 0}
                  onClick={() => setBundleIndex((i) => Math.max(0, i - 1))}
                >
                  <IconChevronLeft size={18} stroke={1.5} />
                </ActionIcon>
              </Tooltip>
              <Text size="xs" ta="center" fw={500} style={{ flex: 1 }}>
                Zobrazení {safeBundleIndex + 1} / {bundles.length}
              </Text>
              <Tooltip label="Další zobrazení (část výsledku)">
                <ActionIcon
                  variant="light"
                  size="sm"
                  color="gray"
                  aria-label="Další část výsledku"
                  disabled={safeBundleIndex >= bundles.length - 1}
                  onClick={() => setBundleIndex((i) => Math.min(bundles.length - 1, i + 1))}
                >
                  <IconChevronRight size={18} stroke={1.5} />
                </ActionIcon>
              </Tooltip>
            </Group>
          ) : null}
        </Stack>
      )}

      <AgentDataPanel
        key={`${lastAgentAnswer.runId ?? "run"}-viz-${safeBundleIndex}`}
        panel={bundle.dataPanel}
        getAccessToken={getAccessToken}
        dataPanelDownloads={bundle.dataPanelDownloads}
      />
    </Stack>
  );
}
