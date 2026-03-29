"use client";

import {
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
  IconHome,
  IconLayoutSidebarRightExpand,
  IconMail,
  IconShieldCheck,
  IconDatabase,
  IconGitBranch,
  IconFolder
} from "@tabler/icons-react";
import Link from "next/link";
import { useState, type ReactNode } from "react";
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
  onNavigateConversation: (conversationId: string, runId?: string | null) => void;
  /** Šířka rozbaleného panelu (px). */
  expandedWidthPx?: number;
  /** Šířka sbaleného pruhu s ikonami (px). */
  collapsedWidthPx?: number;
  /** Vypnout animaci šířky při táhnutí rozdělovače. */
  disableWidthTransition?: boolean;
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
  onNavigateConversation,
  expandedWidthPx = 420,
  collapsedWidthPx = 52,
  disableWidthTransition = false
}: ChatCompanionSidebarProps) {
  const [activeSection, setActiveSection] = useState<CompanionSectionId>("context");
  const agent = agentOptions.find((a) => a.id === selectedAgentId);

  const navItems: { id: CompanionSectionId; label: string; icon: ReactNode }[] = [
    { id: "context", label: "Kontext", icon: <IconLayoutSidebarRightExpand size={20} stroke={1.5} /> },
    { id: "mail", label: "Maily", icon: <IconMail size={20} stroke={1.5} /> },
    { id: "calendar", label: "Kalendář", icon: <IconCalendar size={20} stroke={1.5} /> },
    { id: "data", label: "Data (presety)", icon: <IconDatabase size={20} stroke={1.5} /> },
    { id: "viz", label: "Tabulka / graf", icon: <IconChartBar size={20} stroke={1.5} /> },
    { id: "market", label: "Nabídky", icon: <IconHome size={20} stroke={1.5} /> },
    { id: "trace", label: "Trace", icon: <IconGitBranch size={20} stroke={1.5} /> },
    { id: "audit", label: "Audit", icon: <IconShieldCheck size={20} stroke={1.5} /> },
    { id: "storage", label: "Storage", icon: <IconFolder size={20} stroke={1.5} /> },
    { id: "help", label: "Nápověda", icon: <IconBook size={20} stroke={1.5} /> }
  ];

  function renderContent() {
    switch (activeSection) {
      case "context":
        return (
          <Stack gap="sm">
            <div>
              <Text size="xs" c="dimmed" tt="uppercase" fw={600}>
                Konverzace
              </Text>
              <Text size="sm" fw={500}>
                {conversationTitle?.trim() || (conversationId ? `Konverzace ${conversationId.slice(0, 8)}…` : "—")}
              </Text>
              {conversationId ? (
                <Code block mt={6} fz="xs">
                  {conversationId}
                </Code>
              ) : (
                <Text size="xs" c="dimmed" mt={4}>
                  Žádná aktivní konverzace — spusťte dotaz nebo vytvořte konverzaci vlevo.
                </Text>
              )}
            </div>
            <div>
              <Text size="xs" c="dimmed" tt="uppercase" fw={600}>
                Agent
              </Text>
              {agent ? (
                <Stack gap={4} mt={4}>
                  <Text size="sm" fw={600}>
                    {agent.label}{" "}
                    <Text span c="dimmed" size="sm" fw={400}>
                      ({agent.mode})
                    </Text>
                  </Text>
                  <Text size="xs" c="dimmed">
                    {agent.description}
                  </Text>
                </Stack>
              ) : (
                <Text size="sm" c="dimmed">
                  {selectedAgentId}
                </Text>
              )}
            </div>
          </Stack>
        );
      case "mail":
        return (
          <MailToolPanel
            getAccessToken={getAccessToken}
            conversationId={conversationId}
            focusRunId={focusRunId}
            onNavigateConversation={onNavigateConversation}
          />
        );
      case "calendar":
        return <CalendarToolPanel getAccessToken={getAccessToken} />;
      case "data":
        return <DataPresetPanel getAccessToken={getAccessToken} />;
      case "viz":
        return (
          <VizPanel
            lastAgentAnswer={lastAgentAnswer}
            conversationId={conversationId}
            getAccessToken={getAccessToken}
            onNavigateConversation={onNavigateConversation}
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
              panelu. Trace a Audit vycházejí z posledního běhu v aktuální konverzaci.
            </Text>
            <Text size="sm">
              <Text span fw={600}>
                Odkazy do chatu
              </Text>{" "}
              — u odchozích e-mailů a u tabulky/grafu použijte „Otevřít konverzaci“ / „Zobrazit v kontextu chatu“.
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
        <Stack align="center" gap={6} pt={4} pb="md" px={0} style={{ flex: 1, minHeight: 0, width: "100%" }}>
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
            <Group align="flex-start" gap="sm" wrap="nowrap" style={{ minHeight: 0, flex: 1 }} mih={400}>
              <ScrollArea flex="1" type="auto" offsetScrollbars mih={360} mah="min(70vh, 640px)">
                <Stack gap="xs" pr="xs">
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
