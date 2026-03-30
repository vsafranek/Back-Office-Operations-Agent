"use client";

import {
  Accordion,
  ActionIcon,
  Anchor,
  Autocomplete,
  Badge,
  Box,
  Button,
  Checkbox,
  Code,
  Divider,
  Group,
  Loader,
  Modal,
  MultiSelect,
  Paper,
  NumberInput,
  Pagination,
  Collapse,
  ScrollArea,
  SegmentedControl,
  Select,
  Skeleton,
  Stack,
  Tabs,
  Text,
  Textarea,
  TextInput,
  TagsInput,
  Tooltip,
  UnstyledButton
} from "@mantine/core";
import Link from "next/link";
import { IconChevronLeft, IconChevronRight } from "@tabler/icons-react";
import { useDebouncedValue } from "@mantine/hooks";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { CalendarPreviewStrip } from "@/components/agent/CalendarPreviewStrip";
import { FormattedAssistantContent } from "@/components/agent/FormattedAssistantContent";
import {
  ScheduledTaskRunModalContent,
  ScheduledTaskRunResultCard,
  type ScheduledTaskNotificationRow
} from "@/components/agent/ScheduledTaskRunResultCard";
import { AgentDataPanel } from "@/components/agent/AgentDataPanel";
import { ScheduledTaskConfirmationPanel } from "@/components/agent/ScheduledTaskConfirmationPanel";
import { ViewingEmailDraftPanel } from "@/components/agent/ViewingEmailDraftPanel";
import { MarketListingsDataPanelSection } from "@/components/agent/MarketListingsDataPanelSection";
import { MarketListingCardView } from "@/components/agent/MarketListingCardView";
import type { FetchMarketListingsInput } from "@/lib/agent/tools/market-listings-tool";
import {
  srealityCategorySubSelectData,
  srealityDistrictSelectData,
  srealityRegionSelectData
} from "@/lib/integrations/sreality-param-catalog";
import type { AgentAnswer, AgentDataPanel as AgentDataPanelModel } from "@/lib/agent/types";
import type { ScheduledTaskConfirmationDraft } from "@/lib/agent/scheduled-task-answer-helpers";
import {
  buildViewingEmailPreviewRange,
  clampViewingMeetDurationMinutes,
  VIEWING_MEET_DURATION_MAX_MIN,
  VIEWING_MEET_DURATION_MIN_MIN,
  viewingSlotDurationMs
} from "@/lib/agent/viewing-email-calendar-ui";
import { marketListingsPanelsFromAnswer } from "@/lib/agent/market-listings-answer-helpers";
import { findViewingEmailDataPanel } from "@/lib/agent/viewing-email-answer-helpers";
import {
  applyViewingConfirmedSlotToBody,
  formatViewingSlotRange,
  parseViewingConfirmedSlotFromBody
} from "@/lib/agent/viewing-email-slot-body";
import {
  companionRunNavCanGoNewer,
  companionRunNavCanGoOlder,
  companionRunNavCursor,
  companionRunNavDisplayedSlotNumber,
  companionRunNavGoNewer,
  companionRunNavGoOlder
} from "@/lib/ui/companion-run-nav";

export type VizAnswerRunOption = {
  runId: string;
  preview: string;
  /** Poslední uživatelská zpráva před touto odpovědí asistenta (Kontext). */
  userPrompt?: string;
};

const VIZ_SIDEBAR_KINDS = new Set<AgentDataPanelModel["kind"]>([
  "clients_q1",
  "leads_sales_6m",
  "clients_filtered",
  "deal_sales_detail",
  "missing_reconstruction"
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
  const [mailTab, setMailTab] = useState<string | null>("manual");
  const mailAgentTabAutoOpenRunRef = useRef<string | null>(null);
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

  useEffect(() => {
    const runId = lastAgentAnswer?.runId ?? null;
    if (viewingDraft && runId && mailAgentTabAutoOpenRunRef.current !== runId) {
      mailAgentTabAutoOpenRunRef.current = runId;
      setMailTab("chatbot");
    }
    if (!viewingDraft) {
      mailAgentTabAutoOpenRunRef.current = null;
    }
  }, [lastAgentAnswer?.runId, viewingDraft]);

  return (
    <Stack gap="sm">
      <Text size="sm" c="dimmed">
        Gmail / Outlook podle nastavení integrace.{" "}
        <Anchor component={Link} href="/settings" size="sm">
          Nastavení
        </Anchor>
      </Text>

      <Tabs value={mailTab} onChange={setMailTab} variant="outline" radius="sm">
        <Tabs.List grow>
          <Tabs.Tab value="manual">Napsat</Tabs.Tab>
          <Tabs.Tab value="chatbot">Z běhu agenta</Tabs.Tab>
        </Tabs.List>
        <Tabs.Panel value="chatbot" pt="sm">
          <Stack gap="sm">
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
            ) : (
              <Text size="sm" c="dimmed">
                Zatím tu není návrh e-mailu z běhu agenta. Po dotazu na prohlídku nebo e-mail se zobrazí zde.
              </Text>
            )}
          </Stack>
        </Tabs.Panel>
        <Tabs.Panel value="manual" pt="sm">
          <Stack gap="sm">
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

            <Group wrap="nowrap" gap="xs">
              <TextInput
                placeholder="Gmail hledání (q)…"
                value={q}
                onChange={(e) => setQ(e.currentTarget.value)}
                style={{ flex: 1 }}
                size="xs"
              />
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
          </Stack>
        </Tabs.Panel>
      </Tabs>

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

type CompanionViewingSlotSel = { mode: "none" } | { mode: "slot"; start: string; end: string };

export function CalendarToolPanel({
  getAccessToken,
  lastAgentAnswer = null,
  focusRunId = null,
  viewingEmailRuns = [],
  assistantRunIdsInOrder = [],
  onSelectViewingEmailRun,
  onViewingEmailBodyChange
}: {
  getAccessToken: () => Promise<string | null>;
  lastAgentAnswer?: AgentAnswer | null;
  focusRunId?: string | null;
  viewingEmailRuns?: VizAnswerRunOption[];
  assistantRunIdsInOrder?: string[];
  onSelectViewingEmailRun?: (runId: string) => void;
  onViewingEmailBodyChange?: (body: string) => void;
}) {
  const [weekOffset, setWeekOffset] = useState(0);
  const [events, setEvents] = useState<CalendarEv[]>([]);
  const [provider, setProvider] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [calendarTab, setCalendarTab] = useState<string | null>("manual");
  const calendarAgentTabAutoOpenRunRef = useRef<string | null>(null);
  const [personalMeetDurationMin, setPersonalMeetDurationMin] = useState(60);
  const [viewingSlotSel, setViewingSlotSel] = useState<CompanionViewingSlotSel>({ mode: "none" });
  const [viewingMeetDurationMin, setViewingMeetDurationMin] = useState(60);
  const [newEventTitle, setNewEventTitle] = useState("");
  const [newEventLocation, setNewEventLocation] = useState("");
  const [newEventDescription, setNewEventDescription] = useState("");
  const [newEventStart, setNewEventStart] = useState("");
  const [newEventEnd, setNewEventEnd] = useState("");
  const [newEventBusy, setNewEventBusy] = useState(false);
  const [newEventOk, setNewEventOk] = useState<string | null>(null);

  const viewingEmailPanel = useMemo(() => findViewingEmailDataPanel(lastAgentAnswer), [lastAgentAnswer]);
  const viewingPreviewRange = useMemo(
    () => buildViewingEmailPreviewRange(viewingEmailPanel),
    [viewingEmailPanel]
  );

  const calendarNavRunId = lastAgentAnswer?.runId ?? focusRunId ?? null;
  const calendarNavCursor = companionRunNavCursor(viewingEmailRuns, calendarNavRunId, assistantRunIdsInOrder);
  const calendarAnswerCount = viewingEmailRuns.length;
  const showCalendarAnswerNav = calendarAnswerCount > 1 && onSelectViewingEmailRun != null;
  const calendarDisplaySlot = companionRunNavDisplayedSlotNumber(calendarNavCursor, calendarAnswerCount);
  const calendarPreviewText =
    calendarNavCursor >= 0
      ? viewingEmailRuns[calendarNavCursor]?.preview
      : calendarAnswerCount > 0
        ? viewingEmailRuns[0]?.preview
        : undefined;
  const viewingCalendarInteractive = Boolean(viewingEmailPanel && onViewingEmailBodyChange);

  const viewingSlotInitKeyRef = useRef<string>("");
  useEffect(() => {
    const slotInitKey = `${lastAgentAnswer?.runId ?? "__no_run__"}|${viewingPreviewRange?.rangeStart ?? "__nr__"}|${viewingPreviewRange?.rangeEnd ?? "__nr__"}`;
    if (slotInitKey === viewingSlotInitKeyRef.current) return;
    viewingSlotInitKeyRef.current = slotInitKey;
    const panel = findViewingEmailDataPanel(lastAgentAnswer);
    if (!panel || !viewingPreviewRange) {
      setViewingSlotSel({ mode: "none" });
      return;
    }
    const parsed = parseViewingConfirmedSlotFromBody(panel.draft.body, viewingPreviewRange);
    if (parsed) {
      setViewingSlotSel({ mode: "slot", start: parsed.start, end: parsed.end });
      return;
    }
    if (panel.slots.length > 0) {
      const first = panel.slots[0]!;
      setViewingSlotSel({ mode: "slot", start: first.start, end: first.end });
    } else {
      setViewingSlotSel({ mode: "none" });
    }
  }, [lastAgentAnswer?.runId, lastAgentAnswer, viewingPreviewRange]);

  useEffect(() => {
    if (!viewingEmailPanel || !viewingPreviewRange) return;
    const parsed = parseViewingConfirmedSlotFromBody(viewingEmailPanel.draft.body, viewingPreviewRange);
    if (parsed) {
      setViewingSlotSel((prev) =>
        prev.mode === "slot" && prev.start === parsed.start && prev.end === parsed.end
          ? prev
          : { mode: "slot", start: parsed.start, end: parsed.end }
      );
    }
  }, [viewingEmailPanel?.draft.body, viewingPreviewRange]);

  const viewingCalendarRunIdRef = useRef<string | undefined>(undefined);
  useEffect(() => {
    const rid = lastAgentAnswer?.runId ?? "__no_run__";
    if (!viewingEmailPanel) return;
    if (rid !== viewingCalendarRunIdRef.current) {
      viewingCalendarRunIdRef.current = rid;
      const fromPanel = viewingEmailPanel.meetingDurationMinutes;
      const fromSlots = viewingSlotDurationMs(viewingEmailPanel.slots) / 60000;
      setViewingMeetDurationMin(clampViewingMeetDurationMinutes(fromPanel != null ? fromPanel : fromSlots));
    }
  }, [lastAgentAnswer?.runId, viewingEmailPanel]);

  const selectedSlotForViewing = useMemo(() => {
    if (!viewingEmailPanel || viewingSlotSel.mode !== "slot") return null;
    return { start: viewingSlotSel.start, end: viewingSlotSel.end };
  }, [viewingEmailPanel, viewingSlotSel]);

  const calendarSelectedSource = useMemo((): "agent" | "manual" | null => {
    if (viewingSlotSel.mode !== "slot" || !viewingEmailPanel) return null;
    const { start, end } = viewingSlotSel;
    return viewingEmailPanel.slots.some((s) => s.start === start && s.end === end) ? "agent" : "manual";
  }, [viewingEmailPanel, viewingSlotSel]);

  function applyCompanionBodySlot(slot: { start: string; end: string } | null) {
    if (!viewingEmailPanel || !onViewingEmailBodyChange) return;
    const next = applyViewingConfirmedSlotToBody(viewingEmailPanel.draft.body, slot, formatViewingSlotRange);
    onViewingEmailBodyChange(next);
  }

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

  useEffect(() => {
    const runId = lastAgentAnswer?.runId ?? null;
    if (viewingEmailPanel && runId && calendarAgentTabAutoOpenRunRef.current !== runId) {
      calendarAgentTabAutoOpenRunRef.current = runId;
      setCalendarTab("agent_runs");
    }
    if (!viewingEmailPanel) {
      calendarAgentTabAutoOpenRunRef.current = null;
    }
  }, [lastAgentAnswer?.runId, viewingEmailPanel]);

  async function createOwnEvent() {
    setErr(null);
    setNewEventOk(null);
    if (!newEventTitle.trim()) {
      setErr("Vyplňte název události.");
      return;
    }
    const startDate = new Date(newEventStart);
    const endDate = new Date(newEventEnd);
    if (!newEventStart || !newEventEnd || Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) {
      setErr("Vyplňte platný začátek a konec události.");
      return;
    }
    const startIso = startDate.toISOString();
    const endIso = endDate.toISOString();
    if (new Date(endIso).getTime() <= new Date(startIso).getTime()) {
      setErr("Konec události musí být po začátku.");
      return;
    }
    const token = await getAccessToken();
    if (!token) {
      setErr("Nejste přihlášeni.");
      return;
    }
    setNewEventBusy(true);
    try {
      const res = await fetch("/api/google/calendar/events", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          title: newEventTitle.trim(),
          start: startIso,
          end: endIso,
          location: newEventLocation.trim() || undefined,
          description: newEventDescription.trim() || undefined
        })
      });
      const data = (await res.json()) as { error?: string; provider?: string };
      if (!res.ok) {
        setErr(data.error ?? "Událost se nepodařilo vytvořit.");
        return;
      }
      setNewEventOk(`Událost byla vytvořena (${data.provider ?? provider ?? "calendar"}).`);
      setNewEventTitle("");
      setNewEventLocation("");
      setNewEventDescription("");
      setNewEventStart("");
      setNewEventEnd("");
      await load();
    } finally {
      setNewEventBusy(false);
    }
  }

  const eventBusy = useMemo(
    () => events.map((e) => ({ start: e.start, end: e.end })).filter((b) => b.start && b.end),
    [events]
  );

  const stripBusy = useMemo(() => {
    if (!viewingPreviewRange) return eventBusy;
    const rs = new Date(viewingPreviewRange.rangeStart).getTime();
    const re = new Date(viewingPreviewRange.rangeEnd).getTime();
    if (Number.isNaN(rs) || Number.isNaN(re)) return [...viewingPreviewRange.busy, ...eventBusy];
    const extra = eventBusy.filter((b) => {
      const bs = new Date(b.start).getTime();
      const be = new Date(b.end).getTime();
      return Number.isFinite(bs) && Number.isFinite(be) && be > rs && bs < re;
    });
    return [...viewingPreviewRange.busy, ...extra];
  }, [viewingPreviewRange, eventBusy]);

  const stripRange =
    viewingPreviewRange != null
      ? { rangeStart: viewingPreviewRange.rangeStart, rangeEnd: viewingPreviewRange.rangeEnd }
      : { rangeStart: range.timeMin, rangeEnd: range.timeMax };

  const stripDurationMin = viewingPreviewRange != null ? viewingMeetDurationMin : personalMeetDurationMin;
  const setStripDurationMin = viewingPreviewRange != null ? setViewingMeetDurationMin : setPersonalMeetDurationMin;

  return (
    <Stack gap="sm">
      <Text size="sm" c="dimmed">
        Kalendář (Google / Microsoft dle nastavení).{" "}
        <Anchor component={Link} href="/settings" size="sm">
          Nastavení
        </Anchor>
      </Text>
      <Tabs value={calendarTab} onChange={setCalendarTab} variant="outline" radius="sm">
        <Tabs.List grow>
          <Tabs.Tab value="manual">Vlastní</Tabs.Tab>
          <Tabs.Tab value="agent_runs">Z běhu agenta</Tabs.Tab>
        </Tabs.List>
        <Tabs.Panel value="manual" pt="sm">
          <Stack gap="sm">
            <Text size="sm" fw={600}>
              {range.label}
            </Text>
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

            <Paper withBorder p="xs" radius="sm">
              <Stack gap="xs">
                <Text size="xs" fw={600}>
                  Přidat vlastní událost
                </Text>
                {newEventOk ? (
                  <Text size="xs" c="green">
                    {newEventOk}
                  </Text>
                ) : null}
                <TextInput
                  label="Název"
                  size="xs"
                  value={newEventTitle}
                  onChange={(e) => setNewEventTitle(e.currentTarget.value)}
                />
                <TextInput
                  label="Místo (volitelně)"
                  size="xs"
                  value={newEventLocation}
                  onChange={(e) => setNewEventLocation(e.currentTarget.value)}
                />
                <Group grow>
                  <TextInput
                    label="Začátek"
                    type="datetime-local"
                    size="xs"
                    value={newEventStart}
                    onChange={(e) => setNewEventStart(e.currentTarget.value)}
                  />
                  <TextInput
                    label="Konec"
                    type="datetime-local"
                    size="xs"
                    value={newEventEnd}
                    onChange={(e) => setNewEventEnd(e.currentTarget.value)}
                  />
                </Group>
                <Textarea
                  label="Poznámka (volitelně)"
                  size="xs"
                  minRows={2}
                  value={newEventDescription}
                  onChange={(e) => setNewEventDescription(e.currentTarget.value)}
                />
                <Group justify="space-between">
                  <Button size="xs" variant="light" onClick={() => void load()} loading={loading}>
                    Obnovit události
                  </Button>
                  <Button size="xs" onClick={() => void createOwnEvent()} loading={newEventBusy}>
                    Vytvořit event
                  </Button>
                </Group>
              </Stack>
            </Paper>

            <div
              style={{
                border: "1px solid var(--mantine-color-default-border)",
                borderRadius: 8,
                padding: 10,
                background: "var(--mantine-color-body)"
              }}
            >
              <Text size="xs" fw={600} mb={8}>
                Váš kalendář — přehled 8:00–18:00 (krok 30 min)
              </Text>
              <Text size="xs" c="dimmed" mb={8}>
                Šedě jsou naplánované úseky. Pruhovaná volná pole: při zvolené délce schůzky by začátek kolidoval s
                obsazením (jen náhled, bez výběru slotu).
              </Text>
              <CalendarPreviewStrip
                busy={eventBusy}
                proposedSlots={[]}
                rangeStart={range.timeMin}
                rangeEnd={range.timeMax}
                durationMs={60 * 60 * 1000}
                selectedSlot={null}
                selectedSource={null}
                previewDurationCollisions
                onNavigateEarlier={() => setWeekOffset((w) => w - 1)}
                onNavigateLater={() => setWeekOffset((w) => w + 1)}
                canNavigateEarlier
                canNavigateLater
                pageLabelOverride={`${range.label} · týdenní pohled`}
              />
            </div>

            <ScrollArea.Autosize mah={400} type="auto">
              <Stack gap={6}>
                {loading && !err ? (
                  <>
                    {Array.from({ length: 5 }, (_, i) => (
                      <Skeleton key={i} height={76} radius={8} />
                    ))}
                  </>
                ) : (
                  events.map((e) => (
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
                  ))
                )}
                {!loading && events.length === 0 ? <Text size="sm" c="dimmed">Žádné události v tomto týdnu.</Text> : null}
              </Stack>
            </ScrollArea.Autosize>
          </Stack>
        </Tabs.Panel>
        <Tabs.Panel value="agent_runs" pt="sm">
          <Stack gap="sm">
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

            {showCalendarAnswerNav ? (
              <Group justify="space-between" wrap="nowrap" gap="xs" align="center">
                <Tooltip label="Starší návrh e-mailu (dříve v konverzaci)">
                  <ActionIcon
                    variant="default"
                    size="sm"
                    aria-label="Starší návrh e-mailu"
                    disabled={!companionRunNavCanGoOlder(calendarNavCursor)}
                    onClick={() => companionRunNavGoOlder(viewingEmailRuns, calendarNavCursor, onSelectViewingEmailRun!)}
                  >
                    <IconChevronLeft size={18} stroke={1.5} />
                  </ActionIcon>
                </Tooltip>
                <Stack gap={0} style={{ flex: 1, minWidth: 0 }}>
                  <Text size="xs" ta="center" fw={600} lineClamp={1}>
                    Kalendář · návrh {calendarDisplaySlot ?? "—"} / {calendarAnswerCount}
                  </Text>
                  {calendarPreviewText ? (
                    <Text size="xs" c="dimmed" ta="center" lineClamp={2} style={{ wordBreak: "break-word" }}>
                      {calendarPreviewText}
                    </Text>
                  ) : null}
                </Stack>
                <Tooltip label="Novější návrh e-mailu">
                  <ActionIcon
                    variant="default"
                    size="sm"
                    aria-label="Novější návrh e-mailu"
                    disabled={!companionRunNavCanGoNewer(calendarNavCursor, calendarAnswerCount)}
                    onClick={() => companionRunNavGoNewer(viewingEmailRuns, calendarNavCursor, onSelectViewingEmailRun!)}
                  >
                    <IconChevronRight size={18} stroke={1.5} />
                  </ActionIcon>
                </Tooltip>
              </Group>
            ) : null}

            {showCalendarAnswerNav && !viewingEmailPanel ? (
              <Text size="xs" c="dimmed">
                Aktivní běh nemá návrh e-mailu v tomto panelu — šipkami přejděte na jiný dotaz s prohlídkou.
              </Text>
            ) : null}

            {loading && !err ? (
              <div
                style={{
                  border: "1px solid var(--mantine-color-default-border)",
                  borderRadius: 8,
                  padding: 10,
                  background: "var(--mantine-color-body)"
                }}
                aria-busy="true"
                aria-label="Načítání kalendáře"
              >
                <Skeleton height={13} width="55%" mb={10} />
                <Skeleton height={12} width="88%" mb={14} />
                <Group justify="space-between" mb="xs" wrap="nowrap" gap="sm">
                  <Skeleton height={14} width={120} />
                  <Skeleton height={32} width={140} radius="sm" />
                </Group>
                <Skeleton height={220} radius="sm" />
              </div>
            ) : !err ? (
              <div
                style={{
                  border: "1px solid var(--mantine-color-default-border)",
                  borderRadius: 8,
                  padding: 10,
                  background: "var(--mantine-color-body)"
                }}
              >
                {viewingPreviewRange && viewingEmailPanel ? (
                  <>
                    <Text size="xs" fw={600} mb={4}>
                      Termín prohlídky v tomto dotazu
                    </Text>
                    <Text size="xs" c="dimmed" mb={8}>
                      Zvýraznění odpovídá řádku „Termín prohlídky“ v těle mailu (záložka Maily). Zeleně = návrh agenta (A),
                      klik respektuje délku schůzky.
                    </Text>
                  </>
                ) : (
                  <>
                    <Text size="xs" fw={600} mb={8}>
                      Váš kalendář — přehled 8:00–18:00 (krok 30 min)
                    </Text>
                    <Text size="xs" c="dimmed" mb={8}>
                      Šedě jsou naplánované úseky. Pruhovaná volná pole: při zvolené délce schůzky by začátek kolidoval s
                      obsazením (jen náhled, bez výběru slotu).
                    </Text>
                  </>
                )}
                <Group justify="space-between" align="center" wrap="wrap" gap="sm" mb="xs">
                  <Text size="xs" fw={600}>
                    {viewingPreviewRange && viewingEmailPanel ? "Délka schůzky (pro klik na volno)" : "Délka schůzky (náhled kolizí)"}
                  </Text>
                  <Group gap={6} wrap="nowrap">
                    <ActionIcon
                      type="button"
                      variant="default"
                      size="sm"
                      aria-label="Zkrátit o 15 minut"
                      disabled={stripDurationMin <= VIEWING_MEET_DURATION_MIN_MIN}
                      onClick={() => setStripDurationMin((m) => clampViewingMeetDurationMinutes(m - 15))}
                    >
                      <span style={{ fontSize: 16, fontWeight: 600, lineHeight: 1 }}>−</span>
                    </ActionIcon>
                    <Text size="sm" w={76} ta="center" fw={600}>
                      {stripDurationMin} min
                    </Text>
                    <ActionIcon
                      type="button"
                      variant="default"
                      size="sm"
                      aria-label="Prodloužit o 15 minut"
                      disabled={stripDurationMin >= VIEWING_MEET_DURATION_MAX_MIN}
                      onClick={() => setStripDurationMin((m) => clampViewingMeetDurationMinutes(m + 15))}
                    >
                      <span style={{ fontSize: 16, fontWeight: 600, lineHeight: 1 }}>+</span>
                    </ActionIcon>
                  </Group>
                </Group>
                <CalendarPreviewStrip
                  busy={viewingPreviewRange ? stripBusy : eventBusy}
                  proposedSlots={viewingEmailPanel?.slots ?? []}
                  rangeStart={stripRange.rangeStart}
                  rangeEnd={stripRange.rangeEnd}
                  durationMs={stripDurationMin * 60 * 1000}
                  selectedSlot={viewingEmailPanel ? selectedSlotForViewing : null}
                  selectedSource={viewingEmailPanel ? calendarSelectedSource : null}
                  previewDurationCollisions={!viewingEmailPanel}
                  onSlotPick={
                    viewingCalendarInteractive
                      ? (start, end) => {
                          setViewingSlotSel({ mode: "slot", start, end });
                          applyCompanionBodySlot({ start, end });
                        }
                      : undefined
                  }
                />
                {viewingCalendarInteractive ? (
                  <Button
                    type="button"
                    variant="default"
                    size="xs"
                    mt="sm"
                    onClick={() => {
                      setViewingSlotSel({ mode: "none" });
                      applyCompanionBodySlot(null);
                    }}
                  >
                    Odebrat řádek „Termín prohlídky“ z těla
                  </Button>
                ) : null}
              </div>
            ) : null}
          </Stack>
        </Tabs.Panel>
      </Tabs>
    </Stack>
  );
}

/** Maximální šířka jedné karty inzerátu v mřížce (px). */
const SAVED_MARKET_CARD_MAX_WIDTH_PX = 252;

function SavedMarketFindsPanel({ getAccessToken }: { getAccessToken: () => Promise<string | null> }) {
  type FindRow = {
    id: string;
    external_id: string;
    title: string;
    location: string;
    source: string;
    url: string;
    image_url: string | null;
    price_czk: number | null;
    agent_run_id: string | null;
    first_seen_at: string;
    last_seen_at: string;
  };

  const [items, setItems] = useState<FindRow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const pageSize = 12;
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const [draftLocation, setDraftLocation] = useState("");
  const [draftSource, setDraftSource] = useState<string>("");
  const [draftPriceMin, setDraftPriceMin] = useState("");
  const [draftPriceMax, setDraftPriceMax] = useState("");
  const [appliedLocation, setAppliedLocation] = useState("");
  const [appliedSource, setAppliedSource] = useState<string>("");
  const [appliedPriceMin, setAppliedPriceMin] = useState("");
  const [appliedPriceMax, setAppliedPriceMax] = useState("");

  function resetFilters() {
    setDraftLocation("");
    setDraftSource("");
    setDraftPriceMin("");
    setDraftPriceMax("");
    setAppliedLocation("");
    setAppliedSource("");
    setAppliedPriceMin("");
    setAppliedPriceMax("");
    setPage(1);
  }

  function applyFilters() {
    setAppliedLocation(draftLocation.trim());
    setAppliedSource(draftSource);
    setAppliedPriceMin(draftPriceMin.trim());
    setAppliedPriceMax(draftPriceMax.trim());
    setPage(1);
  }

  async function load(targetPage: number) {
    setErr(null);
    setLoading(true);
    const token = await getAccessToken();
    if (!token) {
      setErr("Nejste přihlášeni.");
      setLoading(false);
      return;
    }
    const p = new URLSearchParams({ page: String(targetPage), limit: String(pageSize) });
    if (appliedLocation) p.set("location", appliedLocation);
    if (appliedSource === "sreality" || appliedSource === "bezrealitky") p.set("source", appliedSource);
    if (appliedPriceMin) p.set("price_min", appliedPriceMin);
    if (appliedPriceMax) p.set("price_max", appliedPriceMax);
    const res = await fetch(`/api/settings/market-listing-finds?${p.toString()}`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    const payload = (await res.json()) as {
      finds?: FindRow[];
      total?: number;
      page?: number;
      totalPages?: number;
      error?: string;
    };
    if (!res.ok) {
      setErr(payload.error ?? `HTTP ${res.status}`);
      setItems([]);
      setTotal(0);
      setTotalPages(0);
      setLoading(false);
      return;
    }
    setItems(payload.finds ?? []);
    setTotal(typeof payload.total === "number" ? payload.total : 0);
    setTotalPages(typeof payload.totalPages === "number" ? payload.totalPages : 0);
    setPage(typeof payload.page === "number" ? payload.page : targetPage);
    setLoading(false);
  }

  useEffect(() => {
    void load(page);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- filtry přes applied*; getAccessToken z dashboardu
  }, [page, appliedLocation, appliedSource, appliedPriceMin, appliedPriceMax]);

  const rangeStart = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const rangeEnd = total === 0 ? 0 : Math.min(page * pageSize, total);
  const remainingAfterPage = total === 0 ? 0 : Math.max(0, total - rangeEnd);
  const canPrev = page > 1 && !loading;
  const canNext = totalPages > 1 && page < totalPages && !loading;

  if (loading && items.length === 0 && !err) {
    return (
      <Stack gap="sm">
        <Skeleton h={18} />
        <Group gap="xs" wrap="wrap">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} h={280} style={{ flex: "1 1 200px", maxWidth: SAVED_MARKET_CARD_MAX_WIDTH_PX }} radius="md" />
          ))}
        </Group>
      </Stack>
    );
  }

  if (err) {
    return (
      <Stack gap="sm">
        <Text size="sm" c="red">
          {err}
        </Text>
        <Button size="xs" variant="light" onClick={() => void load(page)}>
          Zkusit znovu
        </Button>
      </Stack>
    );
  }

  if (total === 0) {
    return (
      <Text size="sm" c="dimmed">
        Zatím žádné uložené nálezy (0). Objeví se po hledání v záložce Prohledat, po odpovědi agenta na dotaz na nabídky nebo po
        běhu naplánované úlohy s nabídkami.
      </Text>
    );
  }

  const filtersActive =
    Boolean(appliedLocation) ||
    (appliedSource === "sreality" || appliedSource === "bezrealitky") ||
    Boolean(appliedPriceMin || appliedPriceMax);

  return (
    <Stack gap="sm">
      <Group justify="space-between" wrap="wrap" gap="xs" align="flex-start">
        <Stack gap={4} style={{ flex: 1, minWidth: 200 }}>
          <Text size="sm" fw={600}>
            Uloženo celkem: {total}
            {filtersActive ? (
              <Text span size="xs" c="dimmed" fw={400} ml={6}>
                (podle filtru)
              </Text>
            ) : null}
          </Text>
          <Text size="xs" c="dimmed">
            Zobrazeno {rangeStart}–{rangeEnd} z {total}. Řazeno podle posledního výskytu; pod kartou je čas prvního a posledního
            uložení.
          </Text>
        </Stack>
        <Button size="compact-xs" variant="light" onClick={() => void load(page)} loading={loading}>
          Obnovit
        </Button>
      </Group>

      <Paper withBorder p="xs" radius="sm">
        <Stack gap="xs">
          <Text size="xs" fw={600}>
            Filtry
          </Text>
          <Text size="xs" c="dimmed">
            Cena: zobrazí jen záznamy s uloženou cenou (nově uložené po aktualizaci DB). Lokalita hledá část textu v poli lokace.
          </Text>
          <Group grow align="flex-end" wrap="wrap" gap="xs">
            <TextInput
              label="Lokalita"
              placeholder="např. Holešovice"
              size="xs"
              value={draftLocation}
              onChange={(e) => setDraftLocation(e.currentTarget.value)}
            />
            <Select
              label="Realitka"
              placeholder="Všechny"
              size="xs"
              clearable
              data={[
                { value: "sreality", label: "Sreality" },
                { value: "bezrealitky", label: "Bezrealitky" }
              ]}
              value={draftSource || null}
              onChange={(v) => setDraftSource(v ?? "")}
            />
            <TextInput
              label="Cena od (Kč)"
              placeholder="např. 3000000"
              size="xs"
              inputMode="numeric"
              value={draftPriceMin}
              onChange={(e) => setDraftPriceMin(e.currentTarget.value.replace(/\D/g, ""))}
            />
            <TextInput
              label="Cena do (Kč)"
              placeholder="např. 8000000"
              size="xs"
              inputMode="numeric"
              value={draftPriceMax}
              onChange={(e) => setDraftPriceMax(e.currentTarget.value.replace(/\D/g, ""))}
            />
          </Group>
          <Group gap="xs">
            <Button size="compact-xs" onClick={applyFilters}>
              Použít filtry
            </Button>
            <Button size="compact-xs" variant="default" onClick={resetFilters}>
              Zrušit filtry
            </Button>
          </Group>
        </Stack>
      </Paper>

      <ScrollArea.Autosize mah={560} type="auto" offsetScrollbars>
        <Box
          style={{
            display: "grid",
            gridTemplateColumns: `repeat(auto-fill, minmax(min(100%, 160px), ${SAVED_MARKET_CARD_MAX_WIDTH_PX}px))`,
            gap: "var(--mantine-spacing-md)",
            justifyContent: "start",
            alignItems: "start",
            minWidth: 0
          }}
        >
          {items.map((row) => (
            <Box key={row.id} maw={SAVED_MARKET_CARD_MAX_WIDTH_PX} w="100%" style={{ minWidth: 0 }}>
              <MarketListingCardView
                maxWidthPx={SAVED_MARKET_CARD_MAX_WIDTH_PX}
                card={{
                  external_id: row.external_id,
                  title: row.title,
                  location: row.location,
                  source: row.source,
                  url: row.url,
                  ...(row.image_url ? { image_url: row.image_url } : {})
                }}
              />
              <Text size="xs" fw={600} mt={4} c="dark.7">
                {row.price_czk != null
                  ? `${row.price_czk.toLocaleString("cs-CZ")} Kč`
                  : "Cena v uloženém nálezu není"}
              </Text>
              <Text size="xs" c="dimmed" mt={6} lineClamp={3}>
                Poprvé: {new Date(row.first_seen_at).toLocaleString("cs-CZ")} · Naposledy:{" "}
                {new Date(row.last_seen_at).toLocaleString("cs-CZ")}
                {row.agent_run_id ? ` · běh ${row.agent_run_id.slice(0, 8)}…` : ""}
              </Text>
            </Box>
          ))}
        </Box>
      </ScrollArea.Autosize>

      {totalPages > 1 ? (
        <Stack
          gap="sm"
          pt="sm"
          mt={4}
          style={{ borderTop: "1px solid var(--mantine-color-default-border)" }}
        >
          <Group justify="space-between" wrap="wrap" gap="xs" align="center">
            <Button
              size="compact-xs"
              variant="default"
              disabled={!canPrev}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              ← Předchozí
            </Button>
            <Text size="xs" c="dimmed" ta="center" maw={200} style={{ flex: "1 1 auto" }}>
              Stránka {page} z {totalPages} · zobrazeno {rangeStart}–{rangeEnd}
            </Text>
            <Button
              size="compact-xs"
              variant="default"
              disabled={!canNext}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            >
              Další →
            </Button>
          </Group>

          {canNext ? (
            <Button
              fullWidth
              size="xs"
              variant="light"
              loading={loading}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            >
              Načíst další
              {remainingAfterPage > 0 ? ` (zbývá cca ${remainingAfterPage})` : ""}
            </Button>
          ) : null}

          <Group justify="center">
            <Pagination
              value={page}
              onChange={setPage}
              total={totalPages}
              size="sm"
              siblings={1}
              boundaries={1}
              disabled={loading}
              aria-label="Stránkování uložených nabídek"
            />
          </Group>
        </Stack>
      ) : (
        <Text size="xs" c="dimmed" pt="xs" ta="center">
          Všechny uložené položky jsou na této stránce ({total}).
        </Text>
      )}
    </Stack>
  );
}

export type MarketSidebarPanelProps = {
  getAccessToken: () => Promise<string | null>;
  lastAgentAnswer?: AgentAnswer | null;
  /** Běhy s panelem nabídek — navigace stejná jako u tabulek (stejné `runId` v konverzaci). */
  marketListingsAnswerRuns?: VizAnswerRunOption[];
  assistantRunIdsInOrder?: string[];
  onSelectMarketListingsRun?: (runId: string) => void;
};

export function MarketSidebarPanel({
  getAccessToken,
  lastAgentAnswer = null,
  marketListingsAnswerRuns = [],
  assistantRunIdsInOrder = [],
  onSelectMarketListingsRun
}: MarketSidebarPanelProps) {
  const [marketTab, setMarketTab] = useState<string | null>("search");
  const marketAgentTabAutoOpenRunRef = useRef<string | null>(null);
  const [location, setLocation] = useState("Praha");
  const [sources, setSources] = useState<string[]>(["sreality", "bezrealitky"]);
  const [perPage, setPerPage] = useState(24);
  const [offerKind, setOfferKind] = useState<"prodej" | "pronajem">("prodej");
  const [srealityCategoryMain, setSrealityCategoryMain] = useState<"byty" | "domy">("byty");
  const [regionGeocodeHint, setRegionGeocodeHint] = useState("");
  const [srealityRegionId, setSrealityRegionId] = useState<string | null>(null);
  const [srealityDistrictId, setSrealityDistrictId] = useState<string | null>(null);
  const [srealityCategorySubId, setSrealityCategorySubId] = useState<string | null>(null);
  const [bezOsmTags, setBezOsmTags] = useState<string[]>([]);
  const [params, setParams] = useState<FetchMarketListingsInput | null>(null);
  const [locationSuggestions, setLocationSuggestions] = useState<{ value: string; label: string }[]>([]);
  const [locationSuggestLoading, setLocationSuggestLoading] = useState(false);
  const [debouncedLocation] = useDebouncedValue(location.trim(), 450);

  const regionSelectData = useMemo(() => srealityRegionSelectData(), []);
  const districtSelectData = useMemo(() => srealityDistrictSelectData(), []);
  const categorySubSelectData = useMemo(
    () => srealityCategorySubSelectData(srealityCategoryMain === "domy" ? 2 : 1),
    [srealityCategoryMain]
  );

  const marketPanels = marketListingsPanelsFromAnswer(lastAgentAnswer);
  const activeRunIdForMarket = lastAgentAnswer?.runId ?? null;
  const marketAnswerCount = marketListingsAnswerRuns.length;
  const marketNavCursor = companionRunNavCursor(
    marketListingsAnswerRuns,
    activeRunIdForMarket,
    assistantRunIdsInOrder
  );
  const showMarketAnswerNav = marketAnswerCount > 1 && onSelectMarketListingsRun != null;
  const marketDisplaySlot = companionRunNavDisplayedSlotNumber(marketNavCursor, marketAnswerCount);
  const marketAnswerPreviewText =
    marketNavCursor >= 0
      ? marketListingsAnswerRuns[marketNavCursor]?.preview
      : marketAnswerCount > 0
        ? marketListingsAnswerRuns[0]?.preview
        : undefined;

  const goOlderMarketAnswer = () => {
    if (!onSelectMarketListingsRun) return;
    companionRunNavGoOlder(marketListingsAnswerRuns, marketNavCursor, onSelectMarketListingsRun);
  };
  const goNewerMarketAnswer = () => {
    if (!onSelectMarketListingsRun) return;
    companionRunNavGoNewer(marketListingsAnswerRuns, marketNavCursor, onSelectMarketListingsRun);
  };

  const marketAnswerNavRow =
    showMarketAnswerNav ? (
      <Group justify="space-between" wrap="nowrap" gap="xs" align="center">
        <Tooltip label="Starší odpověď s nabídkami (dříve v konverzaci)">
          <ActionIcon
            variant="default"
            size="sm"
            aria-label="Starší odpověď s nabídkami"
            disabled={!companionRunNavCanGoOlder(marketNavCursor)}
            onClick={goOlderMarketAnswer}
          >
            <IconChevronLeft size={18} stroke={1.5} />
          </ActionIcon>
        </Tooltip>
        <Stack gap={0} style={{ flex: 1, minWidth: 0 }}>
          <Text size="xs" ta="center" fw={600} lineClamp={1}>
            Běh {marketDisplaySlot ?? "—"} / {marketAnswerCount}
          </Text>
          {marketAnswerPreviewText ? (
            <Text size="xs" c="dimmed" ta="center" lineClamp={2} style={{ wordBreak: "break-word" }}>
              {marketAnswerPreviewText}
            </Text>
          ) : null}
        </Stack>
        <Tooltip label="Novější odpověď s nabídkami">
          <ActionIcon
            variant="default"
            size="sm"
            aria-label="Novější odpověď s nabídkami"
            disabled={!companionRunNavCanGoNewer(marketNavCursor, marketAnswerCount)}
            onClick={goNewerMarketAnswer}
          >
            <IconChevronRight size={18} stroke={1.5} />
          </ActionIcon>
        </Tooltip>
      </Group>
    ) : null;

  useEffect(() => {
    const panels = marketListingsPanelsFromAnswer(lastAgentAnswer);
    const runId = lastAgentAnswer?.runId ?? null;
    if (panels.length > 0 && runId && marketAgentTabAutoOpenRunRef.current !== runId) {
      marketAgentTabAutoOpenRunRef.current = runId;
      setMarketTab("agent_runs");
    }
    if (panels.length === 0) {
      marketAgentTabAutoOpenRunRef.current = null;
    }
  }, [lastAgentAnswer]);

  useEffect(() => {
    setSrealityCategorySubId(null);
  }, [srealityCategoryMain]);

  useEffect(() => {
    let cancelled = false;
    async function suggest() {
      if (debouncedLocation.length < 2) {
        setLocationSuggestions([]);
        setLocationSuggestLoading(false);
        return;
      }
      setLocationSuggestLoading(true);
      try {
        const token = await getAccessToken();
        if (!token || cancelled) return;
        const res = await fetch(
          `/api/geocode/nominatim-suggest?q=${encodeURIComponent(debouncedLocation)}`,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        if (!res.ok || cancelled) return;
        const payload = (await res.json()) as { suggestions?: { value: string; label: string }[] };
        if (!cancelled) setLocationSuggestions(payload.suggestions ?? []);
      } finally {
        if (!cancelled) setLocationSuggestLoading(false);
      }
    }
    void suggest();
    return () => {
      cancelled = true;
    };
  }, [debouncedLocation, getAccessToken]);

  function search() {
    const src = (sources.length ? sources : ["sreality"]) as ("sreality" | "bezrealitky")[];
    const regionId = srealityRegionId ? parseInt(srealityRegionId, 10) : NaN;
    const districtId = srealityDistrictId ? parseInt(srealityDistrictId, 10) : NaN;
    const subId = srealityCategorySubId ? parseInt(srealityCategorySubId, 10) : NaN;
    const osm = bezOsmTags.map((t) => t.trim()).filter(Boolean);
    const next: FetchMarketListingsInput = {
      location: location.trim() || "Česko",
      sources: src,
      page: 1,
      perPage,
      srealityOfferKind: offerKind,
      bezrealitkyOfferType: offerKind === "pronajem" ? "PRONAJEM" : "PRODEJ",
      srealityCategoryMain: srealityCategoryMain === "domy" ? 2 : 1
    };
    if (regionGeocodeHint.trim()) next.regionGeocodeHint = regionGeocodeHint.trim();
    if (Number.isFinite(regionId)) next.srealityLocalityRegionId = regionId;
    if (Number.isFinite(districtId)) next.srealityLocalityDistrictId = districtId;
    if (Number.isFinite(subId)) next.srealityCategorySubCb = subId;
    if (osm.length) next.bezrealitkyRegionOsmIds = osm;
    setParams(next);
  }

  return (
    <Stack gap="sm">
      <Tabs value={marketTab} onChange={setMarketTab} variant="outline" radius="sm">
        <Tabs.List grow>
          <Tabs.Tab value="search">Prohledat</Tabs.Tab>
          <Tabs.Tab value="saved">Uložené nálezy</Tabs.Tab>
          <Tabs.Tab value="agent_runs">Z běhu agenta</Tabs.Tab>
        </Tabs.List>
        <Tabs.Panel value="agent_runs" pt="sm">
          <Stack gap="sm">
            {showMarketAnswerNav ? <Stack gap={6}>{marketAnswerNavRow}</Stack> : null}
            {!lastAgentAnswer ? (
              <Text size="sm" c="dimmed">
                {marketAnswerCount > 0
                  ? "Šipkami zvolte odpověď s nabídkami z předešlého běhu agenta v této konverzaci."
                  : "Po dokončení dotazu na nabídky zde uvidíte karty nemovitostí podle jednotlivých běhů agenta."}
              </Text>
            ) : marketPanels.length === 0 ? (
              <Text size="sm" c="dimmed">
                {marketAnswerCount > 0
                  ? "U aktuálně zvoleného běhu nejsou v odpovědi uložené nabídky — vyberte jiný běh šipkami výše."
                  : "V tomto běhu agent nevrátil panel nabídek."}
              </Text>
            ) : (
              marketPanels.map((panel, i) => (
                <MarketListingsDataPanelSection
                  key={`${lastAgentAnswer.runId ?? "run"}-ml-${i}`}
                  title={panel.title}
                  fetchParams={panel.fetchParams}
                  initialListings={panel.listings}
                  getAccessToken={getAccessToken}
                  enableClientFiltersAndPagination
                  embedded
                />
              ))
            )}
          </Stack>
        </Tabs.Panel>
        <Tabs.Panel value="saved" pt="sm">
          <SavedMarketFindsPanel getAccessToken={getAccessToken} />
        </Tabs.Panel>
        <Tabs.Panel value="search" pt="sm">
          <Stack gap="sm">
      <Text size="sm" c="dimmed">
        Rychlé stažení nabídek (stejné API jako agent). Prázdné pokročilé pole = automatika (Nominatim podle lokality).
      </Text>
      <Autocomplete
        label="Lokalita"
        description="Pište název města nebo obce (ČR) — našeptání přes OpenStreetMap Nominatim."
        placeholder="např. Plzeň, Brno-Židenice"
        size="xs"
        value={location}
        onChange={setLocation}
        data={locationSuggestions}
        filter={({ options }) => options}
        limit={12}
        maxDropdownHeight={240}
        rightSection={locationSuggestLoading ? <Loader size="xs" /> : null}
        comboboxProps={{ withinPortal: true, zIndex: 400 }}
      />
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
      <div>
        <Text size="xs" fw={500} mb={6}>
          Typ nabídky
        </Text>
        <SegmentedControl
          size="xs"
          value={offerKind}
          onChange={(v) => setOfferKind(v as "prodej" | "pronajem")}
          data={[
            { value: "prodej", label: "Prodej" },
            { value: "pronajem", label: "Pronájem" }
          ]}
        />
      </div>
      <div>
        <Text size="xs" fw={500} mb={6}>
          Sreality: kategorie
        </Text>
        <SegmentedControl
          size="xs"
          value={srealityCategoryMain}
          onChange={(v) => setSrealityCategoryMain(v as "byty" | "domy")}
          data={[
            { value: "byty", label: "Byty" },
            { value: "domy", label: "Domy" }
          ]}
        />
      </div>
      <Select
        label="Sreality: dispozice / typ (category_sub_cb)"
        description="Volitelné — podle typu Byty/Domy. ID z dokumentace Sreality / starší config.php RSS."
        placeholder="Všechny v kategorii"
        searchable
        clearable
        size="xs"
        data={categorySubSelectData}
        value={srealityCategorySubId}
        onChange={setSrealityCategorySubId}
      />
      <NumberInput label="Počet / stránka" value={perPage} onChange={(v) => setPerPage(typeof v === "number" ? v : 24)} min={6} max={60} size="xs" />
      <Accordion variant="contained" radius="sm" chevronPosition="right">
        <Accordion.Item value="adv">
          <Accordion.Control>
            <Text size="xs" fw={600}>
              Pokročilé (ID regionu, OSM, hint)
            </Text>
          </Accordion.Control>
          <Accordion.Panel>
            <Stack gap="xs">
              <TextInput
                label="Hint pro geokód (volitelně)"
                description="Krátký řetězec pro Nominatim, pokud „Lokalita“ nevyjde."
                value={regionGeocodeHint}
                onChange={(e) => setRegionGeocodeHint(e.currentTarget.value)}
                size="xs"
              />
              <Select
                label="Kraj (locality_region_id)"
                description="Výběr nebo prázdné → při hledání Nominatim podle lokality."
                placeholder="— automatika / ruční hint níže"
                searchable
                clearable
                size="xs"
                data={regionSelectData}
                value={srealityRegionId}
                onChange={setSrealityRegionId}
              />
              <Select
                label="Okres / část Prahy (locality_district_id)"
                description="Např. Plzeň-město · 12 — užší filtr v rámci kraje."
                placeholder="—"
                searchable
                clearable
                size="xs"
                data={districtSelectData}
                value={srealityDistrictId}
                onChange={setSrealityDistrictId}
              />
              <TagsInput
                label="Bezrealitky regionOsmIds (prefix R…)"
                placeholder="Vložte a Enter"
                value={bezOsmTags}
                onChange={setBezOsmTags}
                size="xs"
              />
            </Stack>
          </Accordion.Panel>
        </Accordion.Item>
      </Accordion>
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
        </Tabs.Panel>
      </Tabs>
    </Stack>
  );
}

export type { ScheduledTaskNotificationRow };

/** Přehled běhů naplánovaných úloh (cron) a označení přečtení. */
export function ScheduledTasksNotificationsPanel({
  getAccessToken,
  onLoaded,
  pendingTaskDraft,
  pendingTaskSyncKey
}: {
  getAccessToken: () => Promise<string | null>;
  onLoaded?: (unreadCount: number) => void;
  /** Návrh z aktuální odpovědi agenta — zobrazí se nahoře, dokud uživatel nepotvrdí / nezruší. */
  pendingTaskDraft?: ScheduledTaskConfirmationDraft | null;
  /** Stejný klíč jako u chatu (`runId`), aby se stav potvrzení synchronizoval mezi oběma místy. */
  pendingTaskSyncKey?: string | null;
}) {
  const [items, setItems] = useState<ScheduledTaskNotificationRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  /** Počet řádků v `user_scheduled_agent_tasks` — ověření, že úloha z Nastavení je v DB. */
  const [savedTaskCount, setSavedTaskCount] = useState<number | null>(null);
  /** Celý text odpovědi / chyby z cron běhu (modal — bez ořezu výšky panelu). */
  const [cronMessageModal, setCronMessageModal] = useState<{
    taskTitle: string;
    createdAt: string;
    status: "ok" | "error";
    summary: string;
    detail: string | null;
    panel_payload?: unknown | null;
  } | null>(null);

  async function load() {
    setErr(null);
    const token = await getAccessToken();
    if (!token) {
      setErr("Nejste přihlášeni.");
      setLoading(false);
      return;
    }
    const [notifRes, tasksRes] = await Promise.all([
      fetch("/api/settings/scheduled-task-notifications?limit=80", {
        headers: { Authorization: `Bearer ${token}` }
      }),
      fetch("/api/settings/scheduled-tasks", { headers: { Authorization: `Bearer ${token}` } })
    ]);

    if (tasksRes.ok) {
      const tasksPayload = (await tasksRes.json()) as { tasks?: unknown[] };
      setSavedTaskCount(Array.isArray(tasksPayload.tasks) ? tasksPayload.tasks.length : 0);
    } else {
      setSavedTaskCount(null);
    }

    const payload = (await notifRes.json()) as {
      error?: string;
      notifications?: ScheduledTaskNotificationRow[];
      unread_count?: number;
    };
    if (!notifRes.ok) {
      setErr(payload.error ?? `HTTP ${notifRes.status}`);
      setLoading(false);
      return;
    }
    setItems(payload.notifications ?? []);
    onLoaded?.(payload.unread_count ?? 0);
    setLoading(false);
  }

  useEffect(() => {
    void load();
  }, []);

  async function markAllRead() {
    const token = await getAccessToken();
    if (!token) return;
    await fetch("/api/settings/scheduled-task-notifications", {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ mark_all_read: true })
    });
    await load();
  }

  async function markReadId(id: string) {
    const token = await getAccessToken();
    if (!token) return;
    await fetch("/api/settings/scheduled-task-notifications", {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ mark_read_ids: [id] })
    });
    await load();
  }

  const grouped = useMemo(() => {
    const m = new Map<string, ScheduledTaskNotificationRow[]>();
    for (const n of items) {
      const key = n.task_title || n.task_id;
      if (!m.has(key)) m.set(key, []);
      m.get(key)!.push(n);
    }
    return [...m.entries()];
  }, [items]);

  const pendingBlock =
    pendingTaskDraft != null ? (
      <Stack gap="xs">
        <Text size="sm" fw={600}>
          Návrh úlohy (čeká na uložení)
        </Text>
        <Text size="xs" c="dimmed">
          Níže je cron, časová zóna, systémové zadání a dotaz při každém běhu. Po potvrzení se úloha uloží k účtu; stejný
          formulář je i v sekci „Data a grafy“ u odpovědi v chatu.
        </Text>
        <ScheduledTaskConfirmationPanel
          draft={pendingTaskDraft}
          getAccessToken={getAccessToken}
          syncKey={pendingTaskSyncKey}
        />
        <Divider label="Historie běhů" labelPosition="center" />
      </Stack>
    ) : null;

  if (loading) {
    return (
      <Stack gap="sm">
        {pendingBlock}
        <Skeleton h={20} />
        <Skeleton h={60} />
        <Skeleton h={60} />
      </Stack>
    );
  }

  return (
    <Stack gap="sm">
      {pendingBlock}
      <Text size="sm" c="dimmed">
        Po každém běhu naplánované úlohy (volání cron endpointu) se zde objeví záznam —{" "}
        <strong>shrnutí (notifikace)</strong> je zvlášť od <strong>plné odpovědi agenta</strong>, pokud je text delší než
        stručný náhled. Úlohy spravujete v Nastavení.
      </Text>
      <Group justify="space-between" wrap="nowrap">
        <Button size="compact-xs" variant="light" onClick={() => void load()}>
          Obnovit
        </Button>
        <Button size="compact-xs" variant="default" onClick={() => void markAllRead()}>
          Označit vše přečtené
        </Button>
      </Group>
      {err ? (
        <Text size="sm" c="red">
          {err}
        </Text>
      ) : null}
      {items.length === 0 ? (
        <Stack gap="xs">
          {savedTaskCount != null && savedTaskCount > 0 ? (
            <>
              <Text size="sm" c="dimmed">
                Úlohy máte uložené v databázi ({savedTaskCount} v účtu). Ověříte je v{" "}
                <Anchor component={Link} href="/settings" size="sm" fw={500} target="_blank">
                  Nastavení → Naplánované úlohy
                </Anchor>{" "}
                (pole „Poslední běh“ se doplní po úspěšném běhu).
              </Text>
              <Text size="sm" c="dimmed">
                Tento panel zobrazuje jen <strong>dokončené běhy</strong> (zápis do historie po volání cron endpointu na
                serveru). Dokud se úloha reálně nespustí, zde nic nebude.
              </Text>
            </>
          ) : savedTaskCount === 0 ? (
            <Text size="sm" c="dimmed">
              Žádná uložená naplánovaná úloha. Vytvořte ji v{" "}
              <Anchor component={Link} href="/settings" size="sm" fw={500} target="_blank">
                Nastavení → Naplánované úlohy
              </Anchor>
              .
            </Text>
          ) : (
            <Text size="sm" c="dimmed">
              Zatím žádné záznamy z běhu — po prvním spuštění cron endpointu se zde objeví výsledek.
            </Text>
          )}
        </Stack>
      ) : (
        <Accordion variant="separated" multiple>
          {grouped.map(([title, rows]) => (
            <Accordion.Item key={title} value={title}>
              <Accordion.Control>
                <Group justify="space-between" wrap="nowrap" gap="xs">
                  <Text size="sm" fw={600} lineClamp={1} style={{ flex: 1 }}>
                    {title}
                  </Text>
                  <Badge size="sm" variant="light">
                    {rows.length}
                  </Badge>
                </Group>
              </Accordion.Control>
              <Accordion.Panel>
                <Stack gap="sm">
                  {rows.map((n) => (
                    <ScheduledTaskRunResultCard
                      key={n.id}
                      notification={n}
                      onOpenFullMessage={() =>
                        setCronMessageModal({
                          taskTitle: n.task_title || "Naplánovaná úloha",
                          createdAt: n.created_at,
                          status: n.status,
                          summary: n.summary,
                          detail: n.detail,
                          panel_payload: n.panel_payload
                        })
                      }
                      onMarkRead={!n.read_at ? () => void markReadId(n.id) : undefined}
                      getAccessToken={getAccessToken}
                    />
                  ))}
                </Stack>
              </Accordion.Panel>
            </Accordion.Item>
          ))}
        </Accordion>
      )}
      <Modal
        opened={cronMessageModal != null}
        onClose={() => setCronMessageModal(null)}
        title={
          cronMessageModal ? (
            <Stack gap={2}>
              <Text fw={600} size="sm">
                {cronMessageModal.status === "ok" ? "Výsledek naplánované úlohy" : "Chyba běhu úlohy"}
              </Text>
              <Text size="xs" c="dimmed" lineClamp={2}>
                {cronMessageModal.taskTitle} · {new Date(cronMessageModal.createdAt).toLocaleString("cs-CZ")}
              </Text>
            </Stack>
          ) : null
        }
        size="xl"
        radius="md"
      >
        {cronMessageModal ? (
          <ScheduledTaskRunModalContent
            status={cronMessageModal.status}
            summary={cronMessageModal.summary}
            detail={cronMessageModal.detail}
            panelPayload={cronMessageModal.panel_payload}
            getAccessToken={getAccessToken}
          />
        ) : null}
      </Modal>
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

export { DataPresetPanel } from "./DataBrowserPanel";
