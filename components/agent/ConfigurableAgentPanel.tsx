"use client";

import type { CSSProperties } from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  ActionIcon,
  Alert,
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
import { AgentDataPanel } from "@/components/agent/AgentDataPanel";
import { ChatMessageBubble, type ChatThreadMessage } from "@/components/agent/ChatMessageBubble";
import type { AgentUiOption } from "@/lib/agent/config/types";
import type { AgentAnswer } from "@/lib/agent/types";

export type { ChatThreadMessage };

export type AgentPanelRunOptions = {
  onPhase?: (label: string) => void;
  onOrchestratorDelta?: (chunk: string) => void;
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
   * Doplňuje `result` po F5 nebo pro tlačítko „Přejít na odpověď v chatu“.
   */
  syncedAgentAnswer?: AgentAnswer | null;
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

/** Sekce audit / panely pod odpovědí — u čistého small talku bez artefaktů ji nezobrazujeme. */
function shouldShowRelatedOutputs(result: AgentAnswer): boolean {
  if (result.dataPanelBundles?.length) return true;
  if (result.dataPanel) return true;
  if (result.dataPanelDownloads?.chartPngs?.length) return true;
  if (result.dataPanelDownloads?.excel || result.dataPanelDownloads?.csv) return true;
  if (result.generated_artifacts && result.generated_artifacts.length > 0) return true;
  if (result.intent === "casual_chat") return false;
  return true;
}

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
          <Text size="sm" c="dimmed">
            Zahajuji…
          </Text>
        ) : null}
        {phaseLog.length > 0 ? (
          <List type="ordered" size="sm" spacing="xs">
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
            <Text fw={600} size="xs" mb="xs" c="blue.9">
              Úvaha Thinking Agent
            </Text>
            <Text size="sm" style={{ whiteSpace: "pre-wrap" }} c="dark.7">
              {orchestratorStreamText}
              {loading && orchestratorStreamText.length === 0 ? (
                <Text span c="dimmed">
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
  syncedAgentAnswer = null
}: ConfigurableAgentPanelProps) {
  const [agentId, setAgentId] = useState(defaultAgentId);
  const [question, setQuestion] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<AgentAnswer | null>(null);
  const [phaseLog, setPhaseLog] = useState<string[]>([]);
  const [orchestratorStreamText, setOrchestratorStreamText] = useState("");
  const [optimisticUserContent, setOptimisticUserContent] = useState<string | null>(null);
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

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [threadMessages, loading, phaseLog.length, orchestratorStreamText, displayResult?.runId]);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setResult(null);
    setPhaseLog([]);
    setOrchestratorStreamText("");
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
        }
      });
      setPhaseLog([]);
      setOrchestratorStreamText("");
      setResult(payload);
      onRunComplete?.(payload);
    } catch (e) {
      setPhaseLog([]);
      setOrchestratorStreamText("");
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

              {displayResult && shouldShowRelatedOutputs(displayResult) ? (
                <Stack gap="md" pt="md" style={{ borderTop: "1px solid var(--mantine-color-default-border)" }}>
                  <Title order={4} size="h5" fw={600}>
                    Data a grafy
                  </Title>
                  <section
                    id={
                      displayResult.runId
                        ? `agent-extras--conv--${cId}--run--${displayResult.runId}`
                        : `agent-extras--conv--${cId}--pending`
                    }
                    data-conversation-id={conversationContext?.id ?? undefined}
                    data-run-id={displayResult.runId ?? undefined}
                    aria-label="Tabulka a grafy posledního běhu"
                  >
                    {(() => {
                      const bundles =
                        displayResult.dataPanelBundles && displayResult.dataPanelBundles.length > 0
                          ? displayResult.dataPanelBundles
                          : displayResult.dataPanel
                            ? [
                                {
                                  dataPanel: displayResult.dataPanel,
                                  dataPanelDownloads: displayResult.dataPanelDownloads
                                }
                              ]
                            : [];
                      const hasPanel = bundles.length > 0;
                      const primaryKind = bundles[0]?.dataPanel.kind;
                      if (!hasPanel) {
                        return (
                          <Text size="xs" c="dimmed">
                            U tohoto dotazu nejsou tabulka ani grafy — text a odkazy jsou v bublině asistenta výše. Audit
                            běhu je v postranním panelu záložka „Audit“.
                          </Text>
                        );
                      }
                      return (
                        <Stack gap="xl" w="100%" maw="100%" style={{ minWidth: 0 }}>
                          {primaryKind === "scheduled_task_confirmation" ? (
                            <Text size="sm" c="violet.8">
                              V postranním panelu Nástroje potvrďte nebo zrušte uložení naplánované úlohy (cron na
                              straně Supabase volá aplikaci podle návodu v Nastavení).
                            </Text>
                          ) : null}
                          {bundles.map((bundle, bi) => (
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
                              {bundles.length > 1 ? (
                                <Title order={5} size="sm" mb="sm" c="dimmed">
                                  Část {bi + 1}
                                </Title>
                              ) : null}
                              <AgentDataPanel
                                panel={bundle.dataPanel}
                                getAccessToken={getAccessToken}
                                dataPanelDownloads={bundle.dataPanelDownloads}
                              />
                            </div>
                          ))}
                        </Stack>
                      );
                    })()}
                  </section>
                </Stack>
              ) : null}

              <div ref={endRef} />
            </Stack>
          </ScrollArea>
        </Box>
      </Paper>

      {error ? (
        <Alert color="red" title="Chyba" style={{ flexShrink: 0 }}>
          {error}
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
