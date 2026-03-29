"use client";

import {
  ActionIcon,
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
  IconHome,
  IconLayoutSidebarRightExpand,
  IconMail,
  IconShieldCheck,
  IconDatabase,
  IconGitBranch,
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
  VizPanel
} from "@/components/agent/companion/CompanionToolPanels";
import type { AgentUiOption } from "@/lib/agent/config/types";
import type { AgentAnswer } from "@/lib/agent/types";
import { findViewingEmailDataPanel } from "@/lib/agent/viewing-email-answer-helpers";
import {
  companionRunNavCanGoNewer,
  companionRunNavCanGoOlder,
  companionRunNavCursor,
  companionRunNavGoNewer,
  companionRunNavGoOlder
} from "@/lib/ui/companion-run-nav";
import type { VizAnswerRunOption } from "@/components/agent/companion/CompanionToolPanels";

export type CompanionSectionId =
  | "context"
  | "mail"
  | "calendar"
  | "data"
  | "viz"
  | "market"
  | "trace"
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
  /** Odpovědi s návrhem e-mailu (prohlídka) — přepínač v Maily. */
  viewingEmailRuns?: VizAnswerRunOption[];
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
  viewingEmailRuns = [],
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
  const agent = agentOptions.find((a) => a.id === selectedAgentId);
  const mailAutoOpenRunRef = useRef<string | null>(null);

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

  const navItems: { id: CompanionSectionId; label: string; icon: ReactNode }[] = [
    { id: "mail", label: "Maily", icon: <IconMail size={20} stroke={1.5} /> },
    { id: "calendar", label: "Kalendář", icon: <IconCalendar size={20} stroke={1.5} /> },
    { id: "data", label: "Data", icon: <IconDatabase size={20} stroke={1.5} /> },
    { id: "viz", label: "Tabulka / graf", icon: <IconChartBar size={20} stroke={1.5} /> },
    { id: "market", label: "Nabídky", icon: <IconHome size={20} stroke={1.5} /> },
    { id: "trace", label: "Trace", icon: <IconGitBranch size={20} stroke={1.5} /> },
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
        return <MarketSidebarPanel getAccessToken={getAccessToken} />;
      case "trace":
        return focusRunId ? (
          <AgentTraceTree runId={focusRunId} getAccessToken={getAccessToken} />
        ) : (
          <Text size="sm" c="dimmed">
            Spusťte agenta dotazem ve středu obrazovky. Po dokončení běhu se zde zobrazí strom trace.
          </Text>
        );
      case "audit":
        return focusRunId ? (
          <AuditRunSummary runId={focusRunId} getAccessToken={getAccessToken} />
        ) : (
          <Text size="sm" c="dimmed">
            Audit je k dispozici po dokončení běhu s přiřazeným run ID.
          </Text>
        );
      case "storage":
        return (
          <Stack gap="sm">
            <Text size="sm">
              Soubory a artefakty najdete na stránce Storage (celá obrazovka).
            </Text>
            <Text component={Link} href="/storage" size="sm" c="indigo" fw={600}>
              Otevřít Storage →
            </Text>
          </Stack>
        );
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
              panelu. V sekci <Text span fw={600}>Kontext</Text> je strom volání pro zvolený běh (šipkami jako u
              dalších nástrojů); samostatná záložka Trace zobrazuje totéž pro rychlý přístup. Audit vychází ze zvoleného běhu v konverzaci.
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
            {item.icon}
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
                        {item.icon}
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
