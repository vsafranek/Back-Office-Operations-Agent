"use client";

import type { CSSProperties } from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  ActionIcon,
  Alert,
  Anchor,
  Box,
  Button,
  Divider,
  Group,
  List,
  Menu,
  Paper,
  ScrollArea,
  Stack,
  Text,
  Textarea,
  Title
} from "@mantine/core";
import Link from "next/link";
import { AgentDataPanel } from "@/components/agent/AgentDataPanel";
import { CalendarPreviewStrip } from "@/components/agent/CalendarPreviewStrip";
import { ChatMessageBubble, type ChatThreadMessage } from "@/components/agent/ChatMessageBubble";
import type { AgentUiOption } from "@/lib/agent/config/types";
import type { AgentAnswer, AgentDataPanel as AgentDataPanelModel } from "@/lib/agent/types";
import { marketListingsPanelsFromAnswer } from "@/lib/agent/market-listings-answer-helpers";
import { findViewingEmailDataPanel } from "@/lib/agent/viewing-email-answer-helpers";
import {
  buildViewingEmailPreviewRange,
  clampViewingMeetDurationMinutes,
  VIEWING_MEET_DURATION_MAX_MIN,
  VIEWING_MEET_DURATION_MIN_MIN,
  viewingSlotDurationMs
} from "@/lib/agent/viewing-email-calendar-ui";
import {
  applyViewingConfirmedSlotToBody,
  formatViewingSlotRange
} from "@/lib/agent/viewing-email-slot-body";
import { storageFolderPrefixFromFilePublicUrl } from "@/lib/ui/storage-public-url";

export type { ChatThreadMessage };

export type AgentPanelRunOptions = {
  onPhase?: (label: string) => void;
  onOrchestratorDelta?: (chunk: string) => void;
  onAnswerDelta?: (chunk: string) => void;
};

export type ConfigurableAgentPanelProps = {
  agents: AgentUiOption[];
  defaultAgentId: string;
  /** Zprávy aktivní konverzace (GET /api/conversations/.../messages). */
  threadMessages: ChatThreadMessage[];
  onRun: (
    params: { question: string; agentId: string },
    options?: AgentPanelRunOptions
  ) => Promise<AgentAnswer>;
  getAccessToken: () => Promise<string | null>;
  conversationContext?: { id: string | null; title?: string };
  onRunComplete?: (answer: AgentAnswer) => void;
  onAgentChange?: (agentId: string) => void;
  /**
   * Stejná data jako v postranním panelu (obnova z DB / `lastAgentAnswer` na dashboardu).
   * Doplňuje `result` po F5 nebo při výběru běhu v postranním panelu.
   */
  syncedAgentAnswer?: AgentAnswer | null;
  /** Úprava těla návrhu prohlídky (výběr termínu v chatu → záložka Maily). */
  onViewingEmailBodyChange?: (body: string) => void;
};

const visuallyHidden: CSSProperties = {
  position: "absolute",
  width: 1,
  height: 1,
  padding: 0,
  margin: -1,
  overflow: "hidden",
  clip: "rect(0,0,0,0)",
  whiteSpace: "nowrap",
  border: 0
};

function convSlug(id: string | null | undefined): string {
  return id ?? "no-conv";
}

function getPanelBundles(result: AgentAnswer): {
  dataPanel: AgentDataPanelModel;
  dataPanelDownloads?: AgentAnswer["dataPanelDownloads"];
}[] {
  if (result.dataPanelBundles && result.dataPanelBundles.length > 0) return result.dataPanelBundles;
  if (result.dataPanel) {
    return [{ dataPanel: result.dataPanel, dataPanelDownloads: result.dataPanelDownloads }];
  }
  return [];
}

const TABLE_OR_CHART_KINDS = new Set<AgentDataPanelModel["kind"]>([
  "clients_q1",
  "leads_sales_6m",
  "clients_filtered",
  "deal_sales_detail",
  "missing_reconstruction"
]);

function vizBundlesForDataSection(result: AgentAnswer) {
  return getPanelBundles(result).filter((b) => TABLE_OR_CHART_KINDS.has(b.dataPanel.kind));
}

function shouldShowMarketListingsChatHint(result: AgentAnswer): boolean {
  return marketListingsPanelsFromAnswer(result).length > 0;
}

/** Sekce „Data a grafy“ — bez čistého e-mailového panelu (ten je v záložce Maily). */
function shouldShowDataAndChartsSection(result: AgentAnswer): boolean {
  if (result.intent === "casual_chat") return false;
  if (
    result.intent === "market_listings" &&
    vizBundlesForDataSection(result).length === 0 &&
    !getPanelBundles(result).some((b) => b.dataPanel.kind === "scheduled_task_confirmation") &&
    !result.dataPanelDownloads?.chartPngs?.length &&
    !result.dataPanelDownloads?.excel &&
    !result.dataPanelDownloads?.csv
  ) {
    return false;
  }
  if (vizBundlesForDataSection(result).length > 0) return true;
  if (result.dataPanelDownloads?.chartPngs?.length) return true;
  if (result.dataPanelDownloads?.excel || result.dataPanelDownloads?.csv) return true;
  if (getPanelBundles(result).some((b) => b.dataPanel.kind === "scheduled_task_confirmation")) return true;
  return Boolean(result.generated_artifacts?.some((a) => a.type !== "email"));
}

type ViewingSlotChatSelection = { mode: "none" } | { mode: "slot"; start: string; end: string };

function IconChevronDown({ size = 14 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M6 9l6 6 6-6" />
    </svg>
  );
}

function IconArrowUp({ size = 18 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.25"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M12 19V5M12 5l-6 6M12 5l6 6" />
    </svg>
  );
}

const pillButtonProps = {
  size: "compact-sm" as const,
  radius: "xl" as const,
  variant: "light" as const,
  color: "gray" as const,
  styles: {
    root: {
      fontWeight: 500,
      border: "1px solid var(--mantine-color-default-border)"
    }
  }
};

function AgentProgressUnderQuestion({
  phaseLog,
  loading,
  orchestratorStreamText,
  agentId
}: {
  phaseLog: string[];
  loading: boolean;
  orchestratorStreamText: string;
  agentId: string;
}) {
  const showThinking = agentId === "thinking-orchestrator" && (loading || orchestratorStreamText.length > 0);
  return (
    <Box
      pl="md"
      ml="xs"
      style={{
        borderLeft: "3px solid var(--mantine-color-indigo-4)",
        display: "flex",
        justifyContent: "flex-start"
      }}
    >
      <Paper
        radius="md"
        px="md"
        py="sm"
        maw="min(96%, 640px)"
        withBorder
        bg="indigo.0"
        style={{ borderStyle: "dashed" }}
        aria-live="polite"
      >
        <Text size="sm" fw={600} mb="xs" c="indigo.8">
          Průběh akcí agenta
        </Text>
        {loading && phaseLog.length === 0 ? (
          <Text size="xs" c="dimmed">
            Zahajuji…
          </Text>
        ) : null}
        {phaseLog.length > 0 ? (
          <List type="ordered" size="xs" spacing="xs" c="dimmed" style={{ lineHeight: 1.45 }}>
            {phaseLog.map((line, i) => (
              <List.Item key={`${i}-${line.slice(0, 24)}`}>{line}</List.Item>
            ))}
          </List>
        ) : null}
        {loading ? (
          <Text size="xs" c="dimmed" mt="sm">
            Probíhá zpracování…
          </Text>
        ) : null}
        {showThinking ? (
          <Box mt="md" pt="md" style={{ borderTop: "1px solid var(--mantine-color-default-border)" }}>
            <Text fw={500} size="xs" mb="xs" c="gray.6">
              Úvaha Thinking Agent
            </Text>
            <Text size="xs" style={{ whiteSpace: "pre-wrap", lineHeight: 1.45 }} c="gray.6">
              {orchestratorStreamText}
              {loading && orchestratorStreamText.length === 0 ? (
                <Text span inherit c="dimmed" size="xs">
                  Čekám na první tokeny…
                </Text>
              ) : null}
            </Text>
          </Box>
        ) : null}
      </Paper>
    </Box>
  );
}

export function ConfigurableAgentPanel({
  agents,
  defaultAgentId,
  threadMessages,
  onRun,
  getAccessToken,
  conversationContext,
  onRunComplete,
  onAgentChange,
  syncedAgentAnswer = null,
  onViewingEmailBodyChange
}: ConfigurableAgentPanelProps) {
  const [agentId, setAgentId] = useState(defaultAgentId);
  const [question, setQuestion] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<AgentAnswer | null>(null);
  const [phaseLog, setPhaseLog] = useState<string[]>([]);
  const [orchestratorStreamText, setOrchestratorStreamText] = useState("");
  const [assistantStreamText, setAssistantStreamText] = useState("");
  /** Poslední známý text ze streamu (pro zachycení po flush při chybě). */
  const assistantStreamRef = useRef("");
  const [failedStreamAssistantText, setFailedStreamAssistantText] = useState<string | null>(null);
  const [optimisticUserContent, setOptimisticUserContent] = useState<string | null>(null);
  const [viewingSlotChatSel, setViewingSlotChatSel] = useState<ViewingSlotChatSelection>({ mode: "none" });
  /** Délka ručního výběru z volna (kalendář v chatu), krok 15 min. */
  const [viewingMeetDurationMin, setViewingMeetDurationMin] = useState(60);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setAgentId(defaultAgentId);
  }, [defaultAgentId]);

  const agentLabelById = useMemo(() => Object.fromEntries(agents.map((a) => [a.id, a.label])), [agents]);
  const selectedAgent = useMemo(() => agents.find((a) => a.id === agentId), [agents, agentId]);

  /** Během načítání nového běhu neukazovat starý synchronizovaný panel (předejde „míchání“ výsledků). */
  const displayResult = useMemo<AgentAnswer | null>(() => {
    if (loading) return result;
    return result ?? syncedAgentAnswer ?? null;
  }, [loading, result, syncedAgentAnswer]);

  const viewingEmailPanel = useMemo(() => findViewingEmailDataPanel(displayResult), [displayResult]);

  const viewingSlotInitRunRef = useRef<string | undefined>(undefined);

  useEffect(() => {
    const rid = displayResult?.runId ?? "__no_run__";
    if (rid !== viewingSlotInitRunRef.current) {
      viewingSlotInitRunRef.current = rid;
      const panel = findViewingEmailDataPanel(displayResult);
      if (panel && panel.slots.length > 0) {
        const first = panel.slots[0]!;
        setViewingSlotChatSel({ mode: "slot", start: first.start, end: first.end });
      } else {
        setViewingSlotChatSel({ mode: "none" });
      }
    }
  }, [displayResult?.runId, displayResult]);

  const viewingCalendarRunIdRef = useRef<string | undefined>(undefined);

  useEffect(() => {
    const rid = displayResult?.runId ?? "__no_run__";
    if (!viewingEmailPanel) return;
    if (rid !== viewingCalendarRunIdRef.current) {
      viewingCalendarRunIdRef.current = rid;
      const fromPanel = viewingEmailPanel.meetingDurationMinutes;
      const fromSlots = viewingSlotDurationMs(viewingEmailPanel.slots) / 60000;
      setViewingMeetDurationMin(
        clampViewingMeetDurationMinutes(fromPanel != null ? fromPanel : fromSlots)
      );
    }
  }, [displayResult?.runId, viewingEmailPanel]);

  const selectedSlotForCalendar = useMemo(() => {
    if (!viewingEmailPanel || viewingSlotChatSel.mode !== "slot") return null;
    return { start: viewingSlotChatSel.start, end: viewingSlotChatSel.end };
  }, [viewingEmailPanel, viewingSlotChatSel]);

  const calendarSelectedSource = useMemo((): "agent" | "manual" | null => {
    if (viewingSlotChatSel.mode !== "slot" || !viewingEmailPanel) return null;
    const { start, end } = viewingSlotChatSel;
    return viewingEmailPanel.slots.some((s) => s.start === start && s.end === end) ? "agent" : "manual";
  }, [viewingEmailPanel, viewingSlotChatSel]);

  const viewingPreviewRange = useMemo(
    () => buildViewingEmailPreviewRange(viewingEmailPanel),
    [viewingEmailPanel]
  );

  function applyChatBodyWithSlot(slot: { start: string; end: string } | null) {
    if (!viewingEmailPanel || !onViewingEmailBodyChange) return;
    const next = applyViewingConfirmedSlotToBody(viewingEmailPanel.draft.body, slot, formatViewingSlotRange);
    onViewingEmailBodyChange(next);
  }

  function clearChatCalendarSlot() {
    setViewingSlotChatSel({ mode: "none" });
    applyChatBodyWithSlot(null);
  }

  /** Scroll dolů jen při nových zprávách / průběhu; ne při změně synchronizovaného runId z nástrojů (řídí to dashboard přes scroll k bublině). */
  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [threadMessages, loading, phaseLog.length, orchestratorStreamText, assistantStreamText]);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setResult(null);
    setPhaseLog([]);
    setOrchestratorStreamText("");
    setAssistantStreamText("");
    assistantStreamRef.current = "";
    setFailedStreamAssistantText(null);
    setOptimisticUserContent(null);

    if (!question.trim()) {
      setError("Zadejte text dotazu.");
      return;
    }

    const q = question.trim();
    setOptimisticUserContent(q);
    setLoading(true);
    try {
      const payload = await onRun({ question: q, agentId }, {
        onPhase: (label) => {
          setPhaseLog((prev) => [...prev, label]);
        },
        onOrchestratorDelta: (chunk) => {
          setOrchestratorStreamText((prev) => prev + chunk);
        },
        onAnswerDelta: (chunk) => {
          setAssistantStreamText((prev) => {
            const next = prev + chunk;
            assistantStreamRef.current = next;
            return next;
          });
        }
      });
      setPhaseLog([]);
      setOrchestratorStreamText("");
      setAssistantStreamText("");
      assistantStreamRef.current = "";
      setResult(payload);
      onRunComplete?.(payload);
      setQuestion("");
    } catch (e) {
      setPhaseLog([]);
      setOrchestratorStreamText("");
      const partial = assistantStreamRef.current.trim();
      setFailedStreamAssistantText(partial.length > 0 ? assistantStreamRef.current : null);
      setAssistantStreamText("");
      assistantStreamRef.current = "";
      setError(e instanceof Error ? e.message : "Neznámá chyba");
    } finally {
      setLoading(false);
      setOptimisticUserContent(null);
    }
  }

  const cId = convSlug(conversationContext?.id);
  const convLabel =
    conversationContext?.title?.trim() ||
    (conversationContext?.id ? `Konverzace ${conversationContext.id.slice(0, 8)}…` : "Bez vybrané konverzace");

  const lastUser = [...threadMessages].reverse().find((m) => m.role === "user");
  const showOptimisticUser =
    Boolean(loading && optimisticUserContent) &&
    !(lastUser?.role === "user" && lastUser.content === optimisticUserContent);

  return (
    <Stack
      id={`agent-workspace--conv--${cId}`}
      gap="md"
      data-conversation-id={conversationContext?.id ?? undefined}
      data-conversation-label={convLabel}
      style={{
        height: "100%",
        minHeight: 0,
        display: "flex",
        flexDirection: "column"
      }}
    >
      <span id={`agent-workspace-context--conv--${cId}`} style={visuallyHidden}>
        Chat — {convLabel}
      </span>

      <Paper
        component="section"
        withBorder
        p="md"
        radius="md"
        aria-labelledby={`chat-thread-heading--${cId}`}
        style={{
          flex: 1,
          minHeight: 0,
          display: "flex",
          flexDirection: "column",
          overflow: "hidden"
        }}
      >
        <Title order={3} id={`chat-thread-heading--${cId}`} mb="md" size="h4" fw={600}>
          Konverzace
        </Title>

        <Box style={{ flex: 1, minHeight: 0, position: "relative" }}>
          <ScrollArea type="auto" offsetScrollbars h="100%" scrollbars="y">
            <Stack gap="md" pr="xs" pb="lg">
              {threadMessages.length === 0 && !loading && !showOptimisticUser ? (
                <Text size="sm" c="dimmed">
                  Napište zprávu do pole úplně dole. Po odeslání uvidíte průběh pod otázkou, poté odpověď a případné
                  panely (tabulka, graf, audit) pod ní.
                </Text>
              ) : null}

              {threadMessages.map((msg) => (
                <ChatMessageBubble
                  key={msg.id}
                  message={msg}
                  getAccessToken={getAccessToken}
                  agentLabelById={agentLabelById}
                />
              ))}

              {showOptimisticUser && optimisticUserContent ? (
                <ChatMessageBubble
                  message={{
                    id: "__optimistic-user__",
                    role: "user",
                    content: optimisticUserContent,
                    created_at: new Date().toISOString(),
                    metadata: { agentId }
                  }}
                  getAccessToken={getAccessToken}
                  agentLabelById={agentLabelById}
                />
              ) : null}

              {loading ? (
                <AgentProgressUnderQuestion
                  phaseLog={phaseLog}
                  loading={loading}
                  orchestratorStreamText={orchestratorStreamText}
                  agentId={agentId}
                />
              ) : null}

              {loading && assistantStreamText.length > 0 ? (
                <ChatMessageBubble
                  message={{
                    id: "__streaming-assistant__",
                    role: "assistant",
                    content: assistantStreamText,
                    created_at: new Date().toISOString(),
                    metadata: { agentId, streaming: true }
                  }}
                  getAccessToken={getAccessToken}
                  agentLabelById={agentLabelById}
                />
              ) : null}

              {!loading && error && failedStreamAssistantText ? (
                <ChatMessageBubble
                  message={{
                    id: "__failed-stream-assistant__",
                    role: "assistant",
                    content: failedStreamAssistantText,
                    created_at: new Date().toISOString(),
                    metadata: { agentId, streamIncomplete: true }
                  }}
                  getAccessToken={getAccessToken}
                  agentLabelById={agentLabelById}
                />
              ) : null}

              {displayResult &&
              ((viewingEmailPanel && onViewingEmailBodyChange) ||
                shouldShowDataAndChartsSection(displayResult) ||
                shouldShowMarketListingsChatHint(displayResult)) ? (
                <section
                  id={
                    displayResult.runId
                      ? `agent-extras--conv--${cId}--run--${displayResult.runId}`
                      : `agent-extras--conv--${cId}--pending`
                  }
                  data-conversation-id={conversationContext?.id ?? undefined}
                  data-run-id={displayResult.runId ?? undefined}
                  aria-label="Doplňky posledního běhu (kalendář, tabulka, graf, nabídky)"
                >
                  <Stack gap="md" pt="md" style={{ borderTop: "1px solid var(--mantine-color-default-border)" }}>
                    {viewingEmailPanel && onViewingEmailBodyChange ? (
                      <Stack gap="md">
                        <Title order={4} size="h5" fw={600}>
                          Kalendář a výběr termínu
                        </Title>
                        <Text size="xs" c="dimmed">
                          Celý návrh e-mailu (komu, předmět, text) upravte v postranním panelu v záložce{" "}
                          <strong>Maily</strong>. Délku schůzky nastavte nad náhledem (15min kroky), pak klikněte na
                          volné pole v kalendáři — do těla se doplní řádek „Termín prohlídky: …“.
                        </Text>
                        {viewingPreviewRange ? (
                          <Paper withBorder p="sm" radius="md">
                            <Text size="sm" fw={600} mb="xs">
                              Náhled kalendáře
                            </Text>
                            <Text size="xs" c="dimmed" mb="sm">
                              {viewingPreviewRange.busy.length > 0
                                ? "Mřížka po 30 minutách (8–18 h). Šedě obsazeno, zeleně návrh agenta (A), pruhovaně začátek při zvolené délce by zasáhl do busy. Volné buňky: klik s délkou z přepínače; zelená políčka: celý návrh agenta jedním klikem."
                                : "30min buňky 8–18 h; u návrhů agenta je v tooltipu přesný čas. Pruhovaná pole nejdou zvolit — kolize s obsazením nebo rozmezím."}
                            </Text>
                            <Group justify="space-between" align="center" wrap="wrap" gap="sm" mb="xs">
                              <Text size="xs" fw={600}>
                                Délka schůzky (pro klik na volno)
                              </Text>
                              <Group gap={6} wrap="nowrap">
                                <ActionIcon
                                  type="button"
                                  variant="default"
                                  size="sm"
                                  aria-label="Zkrátit o 15 minut"
                                  disabled={viewingMeetDurationMin <= VIEWING_MEET_DURATION_MIN_MIN}
                                  onClick={() =>
                                    setViewingMeetDurationMin((m) => clampViewingMeetDurationMinutes(m - 15))
                                  }
                                >
                                  <span style={{ fontSize: 16, fontWeight: 600, lineHeight: 1 }}>−</span>
                                </ActionIcon>
                                <Text size="sm" w={76} ta="center" fw={600}>
                                  {viewingMeetDurationMin} min
                                </Text>
                                <ActionIcon
                                  type="button"
                                  variant="default"
                                  size="sm"
                                  aria-label="Prodloužit o 15 minut"
                                  disabled={viewingMeetDurationMin >= VIEWING_MEET_DURATION_MAX_MIN}
                                  onClick={() =>
                                    setViewingMeetDurationMin((m) => clampViewingMeetDurationMinutes(m + 15))
                                  }
                                >
                                  <span style={{ fontSize: 16, fontWeight: 600, lineHeight: 1 }}>+</span>
                                </ActionIcon>
                              </Group>
                            </Group>
                            <CalendarPreviewStrip
                              busy={viewingPreviewRange.busy}
                              proposedSlots={viewingEmailPanel.slots}
                              rangeStart={viewingPreviewRange.rangeStart}
                              rangeEnd={viewingPreviewRange.rangeEnd}
                              durationMs={viewingMeetDurationMin * 60 * 1000}
                              selectedSlot={selectedSlotForCalendar}
                              selectedSource={calendarSelectedSource}
                              onSlotPick={(start, end) => {
                                setViewingSlotChatSel({ mode: "slot", start, end });
                                applyChatBodyWithSlot({ start, end });
                              }}
                            />
                            {viewingEmailPanel.slots.length === 0 ? (
                              <Text size="xs" c="dimmed" mt="sm">
                                V tomto horizontu agent nenavrhl žádné sloty — můžete vybrat jen z volných buněk
                                (pokud jsou k dispozici).
                              </Text>
                            ) : null}
                            <Button
                              type="button"
                              variant="default"
                              size="xs"
                              mt="sm"
                              onClick={clearChatCalendarSlot}
                            >
                              Odebrat řádek „Termín prohlídky“ z těla zprávy
                            </Button>
                          </Paper>
                        ) : null}
                      </Stack>
                    ) : null}

                    {shouldShowMarketListingsChatHint(displayResult) ? (
                      <Stack gap="xs">
                        <Title order={4} size="h5" fw={600}>
                          Nabídky
                        </Title>
                        <Text size="xs" c="dimmed">
                          Výpis je filtrovaný na nové položky proti uloženým nálezům v databázi uživatele.
                        </Text>
                        <Stack gap="md" w="100%" maw="100%" style={{ minWidth: 0 }}>
                          {marketListingsPanelsFromAnswer(displayResult).map((panel, i) => (
                            <div
                              key={`${displayResult.runId ?? "run"}-market-chat-${i}`}
                              id={
                                displayResult.runId
                                  ? `agent-market-panel--conv--${cId}--run--${displayResult.runId}--${i}`
                                  : `agent-market-panel--conv--${cId}--${i}`
                              }
                            >
                              <AgentDataPanel panel={panel} getAccessToken={getAccessToken} />
                            </div>
                          ))}
                        </Stack>
                      </Stack>
                    ) : null}

                    {shouldShowDataAndChartsSection(displayResult) ? (
                      <Stack gap="md">
                        <Title order={4} size="h5" fw={600}>
                          Data a grafy
                        </Title>
                        {(() => {
                          const bundles = vizBundlesForDataSection(displayResult);
                          const scheduledOnly = getPanelBundles(displayResult).filter(
                            (b) => b.dataPanel.kind === "scheduled_task_confirmation"
                          );
                          const renderBundles = [...scheduledOnly, ...bundles];
                          if (renderBundles.length === 0) {
                            const downloadableArts = (displayResult.generated_artifacts ?? []).filter(
                              (a) =>
                                a.type !== "email" &&
                                typeof a.url === "string" &&
                                a.url.trim().length > 0
                            );
                            if (downloadableArts.length > 0) {
                              const folderPrefix =
                                downloadableArts
                                  .map((a) => storageFolderPrefixFromFilePublicUrl(a.url!))
                                  .find(Boolean) ?? null;
                              return (
                                <Stack gap="sm">
                                  <Text size="xs" c="dimmed">
                                    K tomuto běhu nejsou v chatu tabulka ani graf — níže jsou odkazy na vygenerované
                                    soubory (shodně jako v postranním panelu záložka Storage).
                                  </Text>
                                  <List size="sm" spacing="xs">
                                    {downloadableArts.map((a) => (
                                      <List.Item key={`${a.type}-${a.label}-${a.url}`}>
                                        <Anchor href={a.url!} target="_blank" rel="noopener noreferrer" size="sm">
                                          {a.label}
                                        </Anchor>
                                      </List.Item>
                                    ))}
                                  </List>
                                  {folderPrefix ? (
                                    <Anchor
                                      component={Link}
                                      href={`/storage?prefix=${encodeURIComponent(folderPrefix)}`}
                                      size="sm"
                                      fw={600}
                                    >
                                      Otevřít složku v aplikaci Storage →
                                    </Anchor>
                                  ) : null}
                                </Stack>
                              );
                            }
                            return (
                              <Text size="xs" c="dimmed">
                                U tohoto dotazu nejsou tabulka ani grafy — text a odkazy jsou v bublině asistenta výše.
                                Audit běhu je v postranním panelu záložka „Audit“.
                              </Text>
                            );
                          }
                          return (
                            <Stack gap="xl" w="100%" maw="100%" style={{ minWidth: 0 }}>
                              {scheduledOnly.length > 0 ? (
                                <Text size="sm" c="violet.8">
                                  Návrh cron úlohy potvrďte nebo zrušte v kartě níže (stejný formulář je i v postranním
                                  panelu → Úlohy (cron)). Spouštění zajišťuje cron na straně Supabase podle Nastavení.
                                </Text>
                              ) : null}
                              {renderBundles.map((bundle, bi) => (
                                <div
                                  key={`${displayResult.runId ?? "run"}-panel-${bi}-${bundle.dataPanel.kind}`}
                                  id={
                                    displayResult.runId
                                      ? `agent-data-panel--conv--${cId}--run--${displayResult.runId}--${bi}`
                                      : `agent-data-panel--conv--${cId}--${bi}`
                                  }
                                  data-conversation-id={conversationContext?.id ?? undefined}
                                  data-panel-kind={bundle.dataPanel.kind}
                                  data-panel-index={bi}
                                >
                                  {renderBundles.length > 1 ? (
                                    <Title order={5} size="sm" mb="sm" c="dimmed">
                                      Část {bi + 1}
                                    </Title>
                                  ) : null}
                                  <AgentDataPanel
                                    panel={bundle.dataPanel}
                                    getAccessToken={getAccessToken}
                                    dataPanelDownloads={bundle.dataPanelDownloads}
                                    scheduledTaskConfirmationSyncKey={displayResult.runId ?? null}
                                  />
                                </div>
                              ))}
                            </Stack>
                          );
                        })()}
                      </Stack>
                    ) : null}
                  </Stack>
                </section>
              ) : null}

              <div ref={endRef} />
            </Stack>
          </ScrollArea>
        </Box>
      </Paper>

      {error ? (
        <Alert color="red" title="Chyba" style={{ flexShrink: 0 }}>
          {failedStreamAssistantText ? (
            <Stack gap="xs">
              <Text size="sm">
                Odpověď se nepodařilo dokončit — výše v konverzaci je text, který se stihl načíst během streamu. Zkuste
                dotaz zopakovat nebo ho mírně upřesnit.
              </Text>
              <Text size="sm" c="dimmed" style={{ whiteSpace: "pre-wrap" }}>
                {error}
              </Text>
            </Stack>
          ) : (
            error
          )}
        </Alert>
      ) : null}

      <Box style={{ flexShrink: 0 }}>
        <form
          id={`chat-composer--conv--${cId}`}
          onSubmit={(e) => void handleSubmit(e)}
          aria-describedby={`agent-workspace-context--conv--${cId}`}
        >
          <Box
            p={2}
            style={{
              border: "1px solid var(--mantine-color-default-border)",
              borderRadius: "var(--mantine-radius-md)",
              backgroundColor: "var(--mantine-color-body)"
            }}
          >
            <Textarea
              id={`chat-message--${cId}`}
              aria-label="Zpráva"
              variant="unstyled"
              value={question}
              onChange={(e) => setQuestion(e.currentTarget.value)}
              onKeyDown={(e) => {
                if (e.key !== "Enter" || e.shiftKey) return;
                if (loading || !question.trim()) return;
                e.preventDefault();
                e.currentTarget.form?.requestSubmit();
              }}
              minRows={2}
              autosize
              maxRows={10}
              placeholder="Zpráva… Enter = odeslat, Shift+Enter = nový řádek"
              disabled={loading}
              styles={{
                input: {
                  fontSize: "var(--mantine-font-size-sm)",
                  padding: "10px 12px",
                  lineHeight: 1.45
                }
              }}
            />
            <Divider my={2} />
            <Group justify="space-between" align="center" wrap="nowrap" gap="sm" px={6} pb={6} pt={2}>
              <Box style={{ minWidth: 0, flex: 1 }}>
                <Menu withinPortal position="top-start" shadow="md" width={280}>
                  <Menu.Target>
                    <Button
                      {...pillButtonProps}
                      leftSection={
                        <Text span fz={14} fw={700} lh={1} c="dimmed" aria-hidden>
                          ∞
                        </Text>
                      }
                      rightSection={<IconChevronDown />}
                      disabled={loading}
                      aria-label={`Agent: ${selectedAgent?.label ?? "vyberte"}`}
                      style={{ maxWidth: "min(100%, 220px)" }}
                    >
                      <Text component="span" size="sm" truncate>
                        {selectedAgent?.label ?? "Agent"}
                      </Text>
                    </Button>
                  </Menu.Target>
                  <Menu.Dropdown>
                    <Menu.Label>Profil agenta</Menu.Label>
                    {agents.map((a) => (
                      <Menu.Item
                        key={a.id}
                        onClick={() => {
                          setAgentId(a.id);
                          onAgentChange?.(a.id);
                        }}
                        closeMenuOnClick
                      >
                        <Text size="sm" fw={a.id === agentId ? 700 : 500}>
                          {a.label}
                          {a.id === agentId ? " ✓" : ""}
                        </Text>
                        <Text size="xs" c="dimmed" lineClamp={3}>
                          {a.mode} — {a.description}
                        </Text>
                      </Menu.Item>
                    ))}
                  </Menu.Dropdown>
                </Menu>
              </Box>

              <ActionIcon
                type="submit"
                size={40}
                radius="xl"
                variant="filled"
                color="indigo"
                disabled={loading || !question.trim()}
                loading={loading}
                aria-label="Odeslat zprávu"
              >
                <IconArrowUp />
              </ActionIcon>
            </Group>
          </Box>
        </form>
      </Box>
    </Stack>
  );
}
