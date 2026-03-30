"use client";

import {
  ActionIcon,
  Badge,
  Box,
  Code,
  Divider,
  Group,
  Paper,
  ScrollArea,
  Stack,
  Text,
  Title,
  Tooltip,
  UnstyledButton
} from "@mantine/core";
import {
  IconBook,
  IconCalendar,
  IconChartBar,
  IconChevronLeft,
  IconChevronRight,
  IconClock,
  IconHome,
  IconLayoutSidebarRightExpand,
  IconMail,
  IconShieldCheck,
  IconDatabase,
  IconFolder
} from "@tabler/icons-react";
import Link from "next/link";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { AgentTraceTree } from "@/components/agent/AgentTraceTree";
import { AuditRunSummary } from "@/components/agent/AuditRunSummary";
import {
  CalendarToolPanel,
  DataPresetPanel,
  MailToolPanel,
  MarketSidebarPanel,
  ScheduledTasksNotificationsPanel,
  VizPanel
} from "@/components/agent/companion/CompanionToolPanels";
import type { AgentUiOption } from "@/lib/agent/config/types";
import type { AgentAnswer } from "@/lib/agent/types";
import { scheduledTaskConfirmationDraftFromAnswer } from "@/lib/agent/scheduled-task-answer-helpers";
import { marketListingsPanelsFromAnswer } from "@/lib/agent/market-listings-answer-helpers";
import { findViewingEmailDataPanel } from "@/lib/agent/viewing-email-answer-helpers";
import {
  companionRunNavCanGoNewer,
  companionRunNavCanGoOlder,
  companionRunNavCursor,
  companionRunNavDisplayedSlotNumber,
  companionRunNavGoNewer,
  companionRunNavGoOlder
} from "@/lib/ui/companion-run-nav";
import { storageFolderPrefixFromFilePublicUrl } from "@/lib/ui/storage-public-url";
import type { VizAnswerRunOption } from "@/components/agent/companion/CompanionToolPanels";

export type CompanionSectionId =
  | "context"
  | "mail"
  | "calendar"
  | "data"
  | "viz"
  | "market"
  | "scheduled"
  | "audit"
  | "storage"
  | "help";

export type ChatCompanionSidebarProps = {
  isDesktop: boolean;
  panelOpen: boolean;
  onTogglePanel: () => void;
  conversationId: string | null;
  conversationTitle?: string;
  selectedAgentId: string;
  agentOptions: AgentUiOption[];
  focusRunId: string | null;
  getAccessToken: () => Promise<string | null>;
  lastAgentAnswer: AgentAnswer | null;
  /** Odpovědi s tabulkou/grafem (v pořadí konverzace, nejstarší první) — navigace v sekci Tabulka/graf. */
  vizAnswerRuns?: VizAnswerRunOption[];
  /** Odpovědi s artefakty v úložišti (prezentace, reporty…) — navigace v sekci Storage. */
  presentationAnswerRuns?: VizAnswerRunOption[];
  /** Odpovědi s návrhem e-mailu (prohlídka) — přepínač v Maily. */
  viewingEmailRuns?: VizAnswerRunOption[];
  /** Odpovědi s panelem nabídek — přepínač v Nabídky → Z běhu agenta. */
  marketListingsAnswerRuns?: VizAnswerRunOption[];
  /** Assistant runId v pořadí konverzace (nejstarší první) — šipky mezi maily a tabulkami. */
  assistantRunIdsInOrder?: string[];
  /** Všechny odpovědi asistenta s runId — šipky v Kontextu u stromu volání. */
  assistantAnswerRuns?: VizAnswerRunOption[];
  onSelectVizAnswerRun?: (runId: string) => void;
  onNavigateConversation: (conversationId: string, runId?: string | null) => void;
  /** Šířka rozbaleného panelu (px). */
  expandedWidthPx?: number;
  /** Šířka sbaleného pruhu s ikonami (px). */
  collapsedWidthPx?: number;
  /** Vypnout animaci šířky při táhnutí rozdělovače. */
  disableWidthTransition?: boolean;
  onViewingEmailBodyChange?: (body: string) => void;
};

export function ChatCompanionSidebar({
  isDesktop,
  panelOpen,
  onTogglePanel,
  conversationId,
  conversationTitle,
  selectedAgentId,
  agentOptions,
  focusRunId,
  getAccessToken,
  lastAgentAnswer,
  vizAnswerRuns = [],
  presentationAnswerRuns = [],
  viewingEmailRuns = [],
  marketListingsAnswerRuns = [],
  assistantRunIdsInOrder = [],
  assistantAnswerRuns = [],
  onSelectVizAnswerRun,
  onNavigateConversation,
  expandedWidthPx = 680,
  collapsedWidthPx = 52,
  disableWidthTransition = false,
  onViewingEmailBodyChange
}: ChatCompanionSidebarProps) {
  const [activeSection, setActiveSection] = useState<CompanionSectionId>("mail");
  const [scheduledUnread, setScheduledUnread] = useState(0);
  const agent = agentOptions.find((a) => a.id === selectedAgentId);
  const mailAutoOpenRunRef = useRef<string | null>(null);
  const marketAutoOpenRunRef = useRef<string | null>(null);
  const storageAutoOpenRunRef = useRef<string | null>(null);
  const scheduledDraftAutoOpenRunRef = useRef<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function pollUnread() {
      const token = await getAccessToken();
      if (!token || cancelled) return;
      const res = await fetch("/api/settings/scheduled-task-notifications?count_only=1", {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok || cancelled) return;
      const data = (await res.json()) as { unread_count?: number };
      if (!cancelled) setScheduledUnread(typeof data.unread_count === "number" ? data.unread_count : 0);
    }
    void pollUnread();
    const t = setInterval(() => void pollUnread(), 90_000);
    return () => {
      cancelled = true;
      clearInterval(t);
    };
  }, [getAccessToken]);

  useEffect(() => {
    const runId = lastAgentAnswer?.runId ?? null;
    const isViewing = findViewingEmailDataPanel(lastAgentAnswer) != null;
    if (isViewing && runId && mailAutoOpenRunRef.current !== runId) {
      mailAutoOpenRunRef.current = runId;
      /** Neukrápat Kalendář / Tabulku při šipkách mezi běhy — tam mění runId záměrně. */
      setActiveSection((prev) =>
        prev === "calendar" || prev === "viz" || prev === "context" ? prev : "mail"
      );
    }
    if (!isViewing) mailAutoOpenRunRef.current = null;
  }, [lastAgentAnswer]);

  useEffect(() => {
    const runId = lastAgentAnswer?.runId ?? null;
    const hasMarket = marketListingsPanelsFromAnswer(lastAgentAnswer).length > 0;
    if (hasMarket && runId && marketAutoOpenRunRef.current !== runId) {
      marketAutoOpenRunRef.current = runId;
      setActiveSection((prev) =>
        prev === "calendar" || prev === "viz" || prev === "context" ? prev : "market"
      );
    }
    if (!hasMarket) marketAutoOpenRunRef.current = null;
  }, [lastAgentAnswer]);

  useEffect(() => {
    const runId = lastAgentAnswer?.runId ?? null;
    const hasScheduledDraft = scheduledTaskConfirmationDraftFromAnswer(lastAgentAnswer) != null;
    if (hasScheduledDraft && runId && scheduledDraftAutoOpenRunRef.current !== runId) {
      scheduledDraftAutoOpenRunRef.current = runId;
      if (isDesktop && !panelOpen) onTogglePanel();
      setActiveSection((prev) =>
        prev === "calendar" || prev === "viz" || prev === "context" ? prev : "scheduled"
      );
    }
    if (!hasScheduledDraft) scheduledDraftAutoOpenRunRef.current = null;
  }, [lastAgentAnswer, isDesktop, panelOpen, onTogglePanel]);

  useEffect(() => {
    const runId = lastAgentAnswer?.runId ?? null;
    const hasPresentationFiles = (lastAgentAnswer?.generated_artifacts ?? []).some(
      (a) => a.type === "presentation" && typeof a.url === "string" && a.url.trim().length > 0
    );
    if (hasPresentationFiles && runId && storageAutoOpenRunRef.current !== runId) {
      storageAutoOpenRunRef.current = runId;
      if (isDesktop && !panelOpen) onTogglePanel();
      setActiveSection((prev) =>
        prev === "calendar" || prev === "viz" || prev === "context" ? prev : "storage"
      );
    }
    if (!hasPresentationFiles) storageAutoOpenRunRef.current = null;
  }, [lastAgentAnswer, isDesktop, panelOpen, onTogglePanel]);

  const navItems: { id: CompanionSectionId; label: string; icon: ReactNode; badgeCount?: number }[] = [
    { id: "mail", label: "Maily", icon: <IconMail size={20} stroke={1.5} /> },
    { id: "calendar", label: "Kalendář", icon: <IconCalendar size={20} stroke={1.5} /> },
    { id: "data", label: "Data", icon: <IconDatabase size={20} stroke={1.5} /> },
    { id: "viz", label: "Tabulka / graf", icon: <IconChartBar size={20} stroke={1.5} /> },
    { id: "market", label: "Nabídky", icon: <IconHome size={20} stroke={1.5} /> },
    {
      id: "scheduled",
      label: "Úlohy (cron)",
      badgeCount: scheduledUnread > 0 ? scheduledUnread : undefined,
      icon: <IconClock size={20} stroke={1.5} />
    },
    { id: "audit", label: "Audit", icon: <IconShieldCheck size={20} stroke={1.5} /> },
    { id: "storage", label: "Storage", icon: <IconFolder size={20} stroke={1.5} /> },
    { id: "context", label: "Kontext", icon: <IconLayoutSidebarRightExpand size={20} stroke={1.5} /> },
    { id: "help", label: "Nápověda", icon: <IconBook size={20} stroke={1.5} /> }
  ];

  function renderContent() {
    switch (activeSection) {
      case "context": {
        const runs = assistantAnswerRuns;
        const ctxNavRunId = lastAgentAnswer?.runId ?? focusRunId ?? null;
        const ctxNavCursor = companionRunNavCursor(runs, ctxNavRunId, assistantRunIdsInOrder);
        const ctxRunCount = runs.length;
        const showCtxAnswerNav = ctxRunCount > 0 && onSelectVizAnswerRun != null;
        const effectiveRunId = focusRunId ?? lastAgentAnswer?.runId ?? null;
        let ctxDisplayIdx =
          effectiveRunId != null ? runs.findIndex((r) => r.runId === effectiveRunId) : ctxNavCursor;
        if (ctxDisplayIdx < 0 && ctxRunCount > 0) ctxDisplayIdx = ctxRunCount - 1;
        const ctxSlotLabel = ctxDisplayIdx >= 0 ? ctxDisplayIdx + 1 : "—";

        const runForContext =
          (effectiveRunId ? runs.find((r) => r.runId === effectiveRunId) : null) ??
          (ctxNavCursor >= 0 ? runs[ctxNavCursor] : ctxRunCount > 0 ? runs[ctxRunCount - 1] : null);
        const userQuestion = runForContext?.userPrompt?.trim();

        return (
          <Stack gap="sm">
            {showCtxAnswerNav ? (
              <Group justify="space-between" wrap="nowrap" gap="xs" align="center">
                <Tooltip label="Předchozí zpráva (asistent)">
                  <ActionIcon
                    variant="default"
                    size="sm"
                    aria-label="Předchozí zpráva"
                    disabled={ctxRunCount <= 1 || !companionRunNavCanGoOlder(ctxNavCursor)}
                    onClick={() => companionRunNavGoOlder(runs, ctxNavCursor, onSelectVizAnswerRun!)}
                  >
                    <IconChevronLeft size={18} stroke={1.5} />
                  </ActionIcon>
                </Tooltip>
                <Text size="xs" ta="center" fw={600} lineClamp={1} style={{ flex: 1, minWidth: 0 }}>
                  Zpráva {ctxSlotLabel} / {ctxRunCount || "—"}
                </Text>
                <Tooltip label="Další zpráva (asistent)">
                  <ActionIcon
                    variant="default"
                    size="sm"
                    aria-label="Další zpráva"
                    disabled={ctxRunCount <= 1 || !companionRunNavCanGoNewer(ctxNavCursor, ctxRunCount)}
                    onClick={() => companionRunNavGoNewer(runs, ctxNavCursor, onSelectVizAnswerRun!)}
                  >
                    <IconChevronRight size={18} stroke={1.5} />
                  </ActionIcon>
                </Tooltip>
              </Group>
            ) : null}

            <Text size="xs" c="dimmed" lineClamp={1}>
              {conversationTitle?.trim() || (conversationId ? `Konverzace ${conversationId.slice(0, 8)}…` : "—")}
              {agent ? (
                <>
                  {" · "}
                  <Text span fw={600} c="dimmed">
                    {agent.label}
                  </Text>
                </>
              ) : null}
            </Text>

            <div>
              <Text size="xs" c="dimmed" tt="uppercase" fw={600} mb={6}>
                Otázka uživatele
              </Text>
              {userQuestion ? (
                <Text size="sm" style={{ whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
                  {userQuestion}
                </Text>
              ) : effectiveRunId ? (
                <Text size="sm" c="dimmed">
                  U této odpovědi nebyla v konverzaci nalezena předchozí uživatelská zpráva.
                </Text>
              ) : (
                <Text size="sm" c="dimmed">
                  Spusťte dotaz ve vlákně — zobrazí se otázka a strom volání pro vybraný běh.
                </Text>
              )}
            </div>

            <Divider label="Strom volání" labelPosition="center" />
            {focusRunId ? (
              <AgentTraceTree
                key={focusRunId}
                runId={focusRunId}
                getAccessToken={getAccessToken}
                variant="embedded"
                structureMode="nested"
              />
            ) : (
              <Text size="sm" c="dimmed">
                Spusťte agenta dotazem ve středu obrazovky. Po dokončení běhu se zde zobrazí strom volání.
              </Text>
            )}
          </Stack>
        );
      }
      case "mail":
        return (
          <MailToolPanel
            getAccessToken={getAccessToken}
            conversationId={conversationId}
            focusRunId={focusRunId}
            onNavigateConversation={onNavigateConversation}
            lastAgentAnswer={lastAgentAnswer}
            viewingEmailRuns={viewingEmailRuns}
            assistantRunIdsInOrder={assistantRunIdsInOrder}
            onSelectViewingEmailRun={onSelectVizAnswerRun}
            onViewingEmailBodyChange={onViewingEmailBodyChange}
          />
        );
      case "calendar":
        return (
          <CalendarToolPanel
            getAccessToken={getAccessToken}
            lastAgentAnswer={lastAgentAnswer}
            focusRunId={focusRunId}
            viewingEmailRuns={viewingEmailRuns}
            assistantRunIdsInOrder={assistantRunIdsInOrder}
            onSelectViewingEmailRun={onSelectVizAnswerRun}
            onViewingEmailBodyChange={onViewingEmailBodyChange}
          />
        );
      case "data":
        return <DataPresetPanel getAccessToken={getAccessToken} />;
      case "viz":
        return (
          <VizPanel
            lastAgentAnswer={lastAgentAnswer}
            getAccessToken={getAccessToken}
            vizAnswerRuns={vizAnswerRuns}
            assistantRunIdsInOrder={assistantRunIdsInOrder}
            onSelectVizAnswerRun={onSelectVizAnswerRun}
          />
        );
      case "market":
        return (
          <MarketSidebarPanel
            getAccessToken={getAccessToken}
            lastAgentAnswer={lastAgentAnswer}
            marketListingsAnswerRuns={marketListingsAnswerRuns}
            assistantRunIdsInOrder={assistantRunIdsInOrder}
            onSelectMarketListingsRun={onSelectVizAnswerRun}
          />
        );
      case "scheduled":
        return (
          <ScheduledTasksNotificationsPanel
            getAccessToken={getAccessToken}
            onLoaded={setScheduledUnread}
            pendingTaskDraft={scheduledTaskConfirmationDraftFromAnswer(lastAgentAnswer)}
            pendingTaskSyncKey={lastAgentAnswer?.runId ?? null}
          />
        );
      case "audit":
        return focusRunId ? (
          <AuditRunSummary runId={focusRunId} getAccessToken={getAccessToken} />
        ) : (
          <Text size="sm" c="dimmed">
            Audit je k dispozici po dokončení běhu s přiřazeným run ID.
          </Text>
        );
      case "storage": {
        const presNavRunId = lastAgentAnswer?.runId ?? focusRunId ?? null;
        const presNavCursor = companionRunNavCursor(presentationAnswerRuns, presNavRunId, assistantRunIdsInOrder);
        const presCount = presentationAnswerRuns.length;
        const presDisplaySlot = companionRunNavDisplayedSlotNumber(presNavCursor, presCount);
        const showPresNav = presCount > 1 && onSelectVizAnswerRun != null;
        const runFileArtifacts = (lastAgentAnswer?.generated_artifacts ?? []).filter(
          (a) =>
            a.type !== "email" && typeof a.url === "string" && a.url.trim().length > 0
        );
        const folderFromArtifacts =
          runFileArtifacts.map((a) => storageFolderPrefixFromFilePublicUrl(a.url!)).find(Boolean) ?? null;

        return (
          <Stack gap="sm">
            {showPresNav ? (
              <Group justify="space-between" wrap="nowrap" gap="xs" align="center">
                <Tooltip label="Předchozí odpověď se soubory v úložišti">
                  <ActionIcon
                    variant="default"
                    size="sm"
                    aria-label="Předchozí odpověď se soubory"
                    disabled={presCount <= 1 || !companionRunNavCanGoOlder(presNavCursor)}
                    onClick={() => companionRunNavGoOlder(presentationAnswerRuns, presNavCursor, onSelectVizAnswerRun!)}
                  >
                    <IconChevronLeft size={18} stroke={1.5} />
                  </ActionIcon>
                </Tooltip>
                <Text size="xs" ta="center" fw={600} lineClamp={1} style={{ flex: 1, minWidth: 0 }}>
                  Odpověď {presDisplaySlot ?? "—"} / {presCount}
                </Text>
                <Tooltip label="Další odpověď se soubory v úložišti">
                  <ActionIcon
                    variant="default"
                    size="sm"
                    aria-label="Další odpověď se soubory"
                    disabled={presCount <= 1 || !companionRunNavCanGoNewer(presNavCursor, presCount)}
                    onClick={() => companionRunNavGoNewer(presentationAnswerRuns, presNavCursor, onSelectVizAnswerRun!)}
                  >
                    <IconChevronRight size={18} stroke={1.5} />
                  </ActionIcon>
                </Tooltip>
              </Group>
            ) : null}

            {runFileArtifacts.length > 0 ? (
              <Stack gap="xs">
                <Text size="xs" c="dimmed" tt="uppercase" fw={600}>
                  Soubory z této odpovědi
                </Text>
                {runFileArtifacts.map((a) => (
                  <Text key={`${a.type}-${a.label}-${a.url}`} size="sm">
                    <Text component="a" href={a.url} target="_blank" rel="noopener noreferrer" c="indigo" fw={600}>
                      {a.label}
                    </Text>
                  </Text>
                ))}
                {folderFromArtifacts ? (
                  <Text size="sm">
                    <Text
                      component={Link}
                      href={`/storage?prefix=${encodeURIComponent(folderFromArtifacts)}`}
                      c="indigo"
                      fw={600}
                    >
                      Otevřít složku ve Storage →
                    </Text>
                  </Text>
                ) : null}
              </Stack>
            ) : (
              <Text size="sm" c="dimmed">
                U této odpovědi zatím nejsou žádné soubory s odkazem. Po běhu s výstupy do úložiště se zde objeví odkazy.
              </Text>
            )}

            <Text size="sm" c="dimmed">
              Celý prohlížeč souborů v aplikaci:
            </Text>
            <Text component={Link} href="/storage" size="sm" c="indigo" fw={600}>
              Otevřít Storage →
            </Text>
          </Stack>
        );
      }
      case "help":
        return (
          <Stack gap="md">
            <Text size="sm">
              <Text span fw={600}>
                Integrace
              </Text>{" "}
              — kalendář a poštu připojíte v <Text component="span" fw={500}>Nastavení</Text>. Bez tokenů nástroje v
              tomto panelu nemusí fungovat.
            </Text>
            <Text size="sm">
              <Text span fw={600}>
                Ikonová navigace
              </Text>{" "}
              — vyberte sekci v pravém sloupci; obsah je vlevo od něj. Ikonky zůstávají viditelné i ve sbaleném
              panelu. V sekci <Text span fw={600}>Kontext</Text> je strom volání pro zvolený běh (šipkami mezi
              zprávami). Trace zůstává i v bublině asistenta ve vlákně. Audit vychází ze zvoleného běhu v konverzaci.
            </Text>
            <Text size="sm">
              <Text span fw={600}>
                Tabulka / graf a Maily
              </Text>{" "}
              — u tabulek a grafů jde o odpovědi s datovým panelem; pořadí od nejstarší po nejnovější. Šipky mezi
              odpověďmi (i mezi dílčími částmi jedné odpovědi) posunou středový chat k příslušné bublině. Stejný vzor
              šipek je u více návrhů e-mailu v záložce <Text span fw={600}>Maily</Text>. Při aktivním e-mailovém běhu
              můžete šipkami v Tabulka/graf přepnout zpět na starší tabulkovou odpověď. Prohlížeč si zapamatuje naposledy
              zvolený běh v konverzaci (do obnovení záložky). Kalendář a výběr termínu zůstávají ve vláknu chatu.
            </Text>
          </Stack>
        );
      default:
        return null;
    }
  }

  const contentTitle = navItems.find((n) => n.id === activeSection)?.label ?? "";

  function selectSection(id: CompanionSectionId) {
    setActiveSection(id);
    if (isDesktop && !panelOpen) onTogglePanel();
  }

  const iconRail = (
    <Stack gap={4} w={44} style={{ flexShrink: 0 }} align="center">
      {navItems.map((item) => (
        <Tooltip key={item.id} label={item.label} position="left" withArrow>
          <UnstyledButton
            type="button"
            onClick={() => selectSection(item.id)}
            aria-label={item.label}
            aria-current={activeSection === item.id ? "true" : undefined}
            style={{
              width: 40,
              height: 40,
              borderRadius: 10,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "var(--mantine-color-dark-6)",
              backgroundColor: activeSection === item.id ? "var(--mantine-color-indigo-light)" : "transparent",
              border:
                activeSection === item.id ? "1px solid var(--mantine-color-indigo-3)" : "1px solid transparent"
            }}
          >
            <Box pos="relative" style={{ display: "flex", alignItems: "center", justifyContent: "center" }}>
              {item.icon}
              {item.badgeCount != null && item.badgeCount > 0 ? (
                <Badge
                  size="xs"
                  variant="filled"
                  color="red"
                  circle
                  px={4}
                  style={{
                    position: "absolute",
                    top: -6,
                    right: -8,
                    minWidth: 18,
                    height: 18,
                    paddingInline: 4,
                    fontSize: 10,
                    lineHeight: 1,
                    pointerEvents: "none"
                  }}
                >
                  {item.badgeCount > 99 ? "99+" : item.badgeCount}
                </Badge>
              ) : null}
            </Box>
          </UnstyledButton>
        </Tooltip>
      ))}
    </Stack>
  );

  return (
    <Paper
      component="aside"
      id="chat-companion-sidebar"
      aria-label="Doprovodné nástroje pro chatbota"
      withBorder
      radius="md"
      flex="0 0 auto"
      p={isDesktop && !panelOpen ? "xs" : "md"}
      w={isDesktop ? (panelOpen ? expandedWidthPx : collapsedWidthPx) : "100%"}
      miw={isDesktop ? (panelOpen ? expandedWidthPx : collapsedWidthPx) : undefined}
      style={{
        transition: disableWidthTransition ? "none" : "width 200ms ease, padding 200ms ease",
        overflow: "hidden",
        alignSelf: "stretch",
        order: isDesktop ? undefined : 2,
        display: "flex",
        flexDirection: "column",
        minHeight: 0
      }}
    >
      {isDesktop && !panelOpen ? (
        <Stack align="center" gap={6} pt={0} pb="md" px={0} style={{ flex: 1, minHeight: 0, width: "100%" }}>
          <UnstyledButton
            type="button"
            onClick={onTogglePanel}
            aria-expanded={false}
            aria-controls="chat-companion-sidebar-panel"
            aria-label="Rozbalit doprovodný panel na celou šířku"
            py={6}
            px={4}
            style={{ borderRadius: 8, flexShrink: 0 }}
          >
            <Text aria-hidden size="lg" c="dimmed" fw={600} lh={1}>
              ◀
            </Text>
          </UnstyledButton>
          <ScrollArea flex={1} type="auto" offsetScrollbars style={{ width: "100%" }} mih={0}>
            {iconRail}
          </ScrollArea>
        </Stack>
      ) : (
        <Stack gap="sm" id="chat-companion-sidebar-panel" style={{ minHeight: 0 }}>
          {isDesktop ? (
            <Group justify="space-between" wrap="nowrap" gap="xs" align="center">
              <Title order={5} style={{ flex: 1, minWidth: 0, lineHeight: 1.2 }}>
                Nástroje
              </Title>
              <UnstyledButton
                type="button"
                onClick={onTogglePanel}
                aria-expanded
                aria-controls="chat-companion-sidebar-panel"
                aria-label="Sbalit doprovodný panel"
                py={4}
                px={6}
                style={{ borderRadius: 8, flexShrink: 0 }}
              >
                <Text aria-hidden size="sm" c="dimmed" fw={600} lh={1}>
                  ▶
                </Text>
              </UnstyledButton>
            </Group>
          ) : (
            <Title order={5}>Nástroje</Title>
          )}

          {isDesktop ? (
            <Group align="stretch" gap="sm" wrap="nowrap" style={{ minHeight: 0, flex: 1 }} mih={0}>
              <ScrollArea
                flex="1"
                type="auto"
                offsetScrollbars
                scrollbars="y"
                style={{
                  flex: 1,
                  minHeight: 0,
                  maxHeight: "min(calc(100dvh - 120px), 720px)"
                }}
              >
                <Stack gap="xs" pr="xs" pb="md">
                  <Text size="xs" c="dimmed" tt="uppercase" fw={700}>
                    {contentTitle}
                  </Text>
                  {renderContent()}
                </Stack>
              </ScrollArea>
              <Divider orientation="vertical" style={{ alignSelf: "stretch" }} />
              {iconRail}
            </Group>
          ) : (
            <Stack gap="md">
              <ScrollArea type="auto" scrollbars="x" offsetScrollbars>
                <Group gap={6} wrap="nowrap" pb={4}>
                  {navItems.map((item) => (
                    <UnstyledButton
                      key={item.id}
                      type="button"
                      onClick={() => setActiveSection(item.id)}
                      style={{
                        padding: "8px 10px",
                        borderRadius: 10,
                        backgroundColor:
                          activeSection === item.id ? "var(--mantine-color-indigo-light)" : "var(--mantine-color-gray-1)",
                        border: "1px solid var(--mantine-color-default-border)"
                      }}
                    >
                      <Group gap={6} wrap="nowrap">
                        <Box pos="relative" style={{ display: "flex" }}>
                          {item.icon}
                          {item.badgeCount != null && item.badgeCount > 0 ? (
                            <Badge
                              size="xs"
                              variant="filled"
                              color="red"
                              circle
                              px={4}
                              style={{
                                position: "absolute",
                                top: -6,
                                right: -6,
                                minWidth: 16,
                                height: 16,
                                fontSize: 9,
                                pointerEvents: "none"
                              }}
                            >
                              {item.badgeCount > 99 ? "99+" : item.badgeCount}
                            </Badge>
                          ) : null}
                        </Box>
                        <Text size="xs" fw={600}>
                          {item.label}
                        </Text>
                      </Group>
                    </UnstyledButton>
                  ))}
                </Group>
              </ScrollArea>
              <div>{renderContent()}</div>
            </Stack>
          )}
        </Stack>
      )}
    </Paper>
  );
}
