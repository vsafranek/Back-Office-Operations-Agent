"use client";

import {
  Box,
  Button,
  Divider,
  Flex,
  Group,
  List,
  Modal,
  Paper,
  ScrollArea,
  Stack,
  Text,
  TextInput,
  Title,
  UnstyledButton
} from "@mantine/core";
import { useDisclosure, useMediaQuery } from "@mantine/hooks";
import { modals } from "@mantine/modals";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ChatCompanionSidebar } from "@/components/agent/ChatCompanionSidebar";
import { PanelResizeHandle } from "@/components/layout/PanelResizeHandle";
import {
  ConfigurableAgentPanel,
  type ChatThreadMessage
} from "@/components/agent/ConfigurableAgentPanel";
import { DEFAULT_AGENT_ID, listAgentIds, listAgentUiOptions } from "@/lib/agent/config/agent-definitions";
import { readAgentNdjsonStream } from "@/lib/agent/stream-client";
import {
  AGENT_PANEL_PAYLOAD_KEY,
  agentAnswerSliceFromPersistPayload
} from "@/lib/agent/conversation/agent-panel-persist";
import type { AgentAnswer } from "@/lib/agent/types";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser-client";

type Conversation = {
  id: string;
  title: string;
  created_at: string;
  updated_at: string;
};

type ConversationMessage = {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  created_at: string;
  metadata: Record<string, unknown>;
};

const LS_CONV_W = "bo-dashboard-conv-width";
const LS_COMP_W = "bo-dashboard-companion-width";
const MIN_CONV_W = 200;
const MAX_CONV_W = 480;
const MIN_COMP_W = 380;
const MAX_COMP_W = 1200;
const DEFAULT_COMP_W = 680;
const COLLAPSED_CONV_W = 48;
const COLLAPSED_COMP_W = 52;

function readWidth(key: string, fallback: number) {
  if (typeof window === "undefined") return fallback;
  const n = Number.parseInt(localStorage.getItem(key) ?? "", 10);
  return Number.isFinite(n) ? n : fallback;
}

function clamp(n: number, lo: number, hi: number) {
  return Math.min(hi, Math.max(lo, n));
}

export default function DashboardPage() {
  const supabase = useMemo(() => getSupabaseBrowserClient(), []);
  const router = useRouter();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ConversationMessage[]>([]);
  const [renaming, setRenaming] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [renameOpened, { open: openRenameModal, close: closeRenameModal }] = useDisclosure(false);
  const [renameDraft, setRenameDraft] = useState("");
  const [convPanelOpen, { toggle: toggleConvPanel }] = useDisclosure(true);
  const [companionPanelOpen, { toggle: toggleCompanionPanel }] = useDisclosure(true);
  const [companionRunId, setCompanionRunId] = useState<string | null>(null);
  const [lastAgentAnswer, setLastAgentAnswer] = useState<AgentAnswer | null>(null);
  const [selectedAgentId, setSelectedAgentId] = useState(DEFAULT_AGENT_ID);
  const isDesktop = useMediaQuery("(min-width: 48em)");
  const prevConversationIdRef = useRef<string | null>(null);
  const skipNextCompanionClearRef = useRef(false);
  const [convWidthPx, setConvWidthPx] = useState(280);
  const [companionWidthPx, setCompanionWidthPx] = useState(DEFAULT_COMP_W);
  const [panelResizeActive, setPanelResizeActive] = useState(false);
  const layoutRowRef = useRef<HTMLDivElement>(null);

  /** Asistentovy odpovědi s uloženým panelem (nejnovější první) — pro přepínání v nástrojích Tabulka/graf. */
  const vizAnswerRuns = useMemo(() => {
    const assistants = messages.filter((m) => m.role === "assistant");
    const ordered = [...assistants].reverse();
    const out: { runId: string; preview: string }[] = [];
    for (const m of ordered) {
      const meta = m.metadata as Record<string, unknown>;
      const runId = meta.runId;
      if (typeof runId !== "string" || !runId.trim()) continue;
      if (!agentAnswerSliceFromPersistPayload(meta[AGENT_PANEL_PAYLOAD_KEY])) continue;
      const full = m.content.replace(/\s+/g, " ").trim();
      const short = full.slice(0, 56);
      const preview = full.length > 56 ? `${short}…` : short || "Odpověď asistenta";
      out.push({ runId, preview });
    }
    return out;
  }, [messages]);

  useEffect(() => {
    setConvWidthPx(clamp(readWidth(LS_CONV_W, 280), MIN_CONV_W, MAX_CONV_W));
    setCompanionWidthPx(clamp(readWidth(LS_COMP_W, DEFAULT_COMP_W), MIN_COMP_W, MAX_COMP_W));
  }, []);

  useEffect(() => {
    const prev = prevConversationIdRef.current;
    if (prev !== null && prev !== activeConversationId) {
      if (skipNextCompanionClearRef.current) {
        skipNextCompanionClearRef.current = false;
      } else {
        setCompanionRunId(null);
      }
      setLastAgentAnswer(null);
    }
    prevConversationIdRef.current = activeConversationId;
  }, [activeConversationId]);

  useEffect(() => {
    if (!activeConversationId) {
      setSelectedAgentId(DEFAULT_AGENT_ID);
      return;
    }
    const lastUser = [...messages].reverse().find((m) => m.role === "user");
    const aid = (lastUser?.metadata as { agentId?: string } | undefined)?.agentId;
    setSelectedAgentId(aid && listAgentIds().includes(aid) ? aid : DEFAULT_AGENT_ID);
  }, [activeConversationId, messages]);

  useEffect(() => {
    void supabase.auth.getSession().then(async ({ data }) => {
      if (!data.session) {
        router.replace("/auth/login");
        return;
      }

      const accessToken = data.session.access_token;

      void fetch("/api/auth/sync-account", {
        method: "POST",
        headers: { Authorization: `Bearer ${accessToken}` }
      }).catch(() => {});

      const convResponse = await fetch("/api/conversations", {
        headers: { Authorization: `Bearer ${accessToken}` }
      });
      if (convResponse.ok) {
        const convs = (await convResponse.json()) as Conversation[];
        setConversations(convs);
        const urlParams = new URLSearchParams(typeof window !== "undefined" ? window.location.search : "");
        const convFromUrl = urlParams.get("conv");
        const runFromUrl = urlParams.get("run");
        if (convFromUrl && convs.some((c) => c.id === convFromUrl)) {
          setActiveConversationId(convFromUrl);
          if (runFromUrl) setCompanionRunId(runFromUrl);
        } else if (convs.length > 0) {
          setActiveConversationId(convs[0].id);
        }
      }
    });
  }, [router, supabase.auth]);

  useEffect(() => {
    void (async () => {
      if (!activeConversationId) {
        setMessages([]);
        return;
      }
      const sessionResult = await supabase.auth.getSession();
      const accessToken = sessionResult.data.session?.access_token;
      if (!accessToken) return;
      const response = await fetch(`/api/conversations/${activeConversationId}/messages`, {
        headers: { Authorization: `Bearer ${accessToken}` }
      });
      if (!response.ok) return;
      const rows = (await response.json()) as ConversationMessage[];
      setMessages(rows);
    })();
  }, [activeConversationId, supabase.auth]);

  useEffect(() => {
    if (!activeConversationId) return;
    const assistants = messages.filter((m) => m.role === "assistant");
    if (assistants.length === 0) {
      setLastAgentAnswer(null);
      return;
    }
    const ordered = [...assistants].reverse();

    let target: ConversationMessage | undefined;
    if (companionRunId != null) {
      target = ordered.find((m) => (m.metadata as { runId?: string }).runId === companionRunId);
      if (!target) {
        const latest = ordered[0]!;
        const lm = latest.metadata as Record<string, unknown>;
        if (lm[AGENT_PANEL_PAYLOAD_KEY] != null) target = latest;
      }
    } else {
      const latest = ordered[0]!;
      const lm = latest.metadata as Record<string, unknown>;
      if (lm[AGENT_PANEL_PAYLOAD_KEY] == null) {
        setLastAgentAnswer(null);
        return;
      }
      target = latest;
    }

    if (!target) return;
    const meta = target.metadata as Record<string, unknown>;
    const slice = agentAnswerSliceFromPersistPayload(meta[AGENT_PANEL_PAYLOAD_KEY]);
    if (!slice) return;

    setLastAgentAnswer({
      answer_text: target.content,
      confidence: typeof meta.confidence === "number" ? meta.confidence : 0,
      sources: Array.isArray(meta.sources)
        ? meta.sources.filter((s): s is string => typeof s === "string")
        : [],
      generated_artifacts: Array.isArray(meta.generated_artifacts)
        ? (meta.generated_artifacts as AgentAnswer["generated_artifacts"])
        : [],
      next_actions: Array.isArray(meta.next_actions)
        ? meta.next_actions.filter((s): s is string => typeof s === "string")
        : [],
      ...slice,
      runId: typeof meta.runId === "string" ? meta.runId : undefined,
      intent: typeof meta.intent === "string" ? (meta.intent as AgentAnswer["intent"]) : undefined
    });
  }, [activeConversationId, messages, companionRunId]);

  async function createConversation() {
    const sessionResult = await supabase.auth.getSession();
    const accessToken = sessionResult.data.session?.access_token;
    if (!accessToken) return;
    const response = await fetch("/api/conversations", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`
      },
      body: JSON.stringify({ title: "Nova konverzace" })
    });
    if (!response.ok) return;
    const created = (await response.json()) as Conversation;
    setConversations((prev) => [created, ...prev]);
    setActiveConversationId(created.id);
    setMessages([]);
  }

  function beginRenameActiveConversation() {
    if (!activeConversationId) return;
    const active = conversations.find((c) => c.id === activeConversationId);
    setRenameDraft(active?.title ?? "Nova konverzace");
    openRenameModal();
  }

  async function submitRenameActiveConversation() {
    if (!activeConversationId) return;
    const nextTitle = renameDraft.trim();
    if (!nextTitle) return;
    const active = conversations.find((c) => c.id === activeConversationId);
    if (nextTitle === (active?.title ?? "")) {
      closeRenameModal();
      return;
    }

    const sessionResult = await supabase.auth.getSession();
    const accessToken = sessionResult.data.session?.access_token;
    if (!accessToken) return;
    setRenaming(true);

    const response = await fetch(`/api/conversations/${activeConversationId}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`
      },
      body: JSON.stringify({ title: nextTitle })
    });
    setRenaming(false);
    if (!response.ok) return;

    const updated = (await response.json()) as Conversation;
    setConversations((prev) => prev.map((c) => (c.id === updated.id ? updated : c)));
    closeRenameModal();
  }

  function confirmDeleteActiveConversation() {
    if (!activeConversationId) return;
    modals.openConfirmModal({
      title: "Smazat konverzaci?",
      children: <Text size="sm">Opravdu chcete smazat tuto konverzaci? Akci nelze vrátit zpět.</Text>,
      labels: { confirm: "Smazat", cancel: "Zrušit" },
      confirmProps: { color: "red" },
      onConfirm: () => void deleteActiveConversation()
    });
  }

  async function deleteActiveConversation() {
    if (!activeConversationId) return;

    const sessionResult = await supabase.auth.getSession();
    const accessToken = sessionResult.data.session?.access_token;
    if (!accessToken) return;
    setDeleting(true);

    const response = await fetch(`/api/conversations/${activeConversationId}`, {
      method: "DELETE",
      headers: {
        Authorization: `Bearer ${accessToken}`
      }
    });
    setDeleting(false);
    if (!response.ok) return;

    const updated = conversations.filter((c) => c.id !== activeConversationId);
    setConversations(updated);
    setActiveConversationId(updated[0]?.id ?? null);
    setMessages([]);
  }

  const activeConversationTitle = conversations.find((c) => c.id === activeConversationId)?.title;

  function scrollChatToAgentRun(conversationId: string, runId: string) {
    const tryScroll = (attempt: number) => {
      const answerBubble = document.getElementById(`chat-assistant-run-${runId}`);
      const extra = document.getElementById(`agent-extras--conv--${conversationId}--run--${runId}`);
      const panel0 = document.getElementById(`agent-data-panel--conv--${conversationId}--run--${runId}--0`);
      const target = answerBubble ?? extra ?? panel0;
      if (target) {
        target.scrollIntoView({ behavior: "smooth", block: "center" });
        return;
      }
      if (attempt < 12) window.setTimeout(() => tryScroll(attempt + 1), 80);
    };
    window.setTimeout(() => tryScroll(0), 50);
  }

  function navigateToConversation(conversationId: string, runId?: string | null) {
    if (runId) skipNextCompanionClearRef.current = true;
    setActiveConversationId(conversationId);
    if (runId) setCompanionRunId(runId);
    requestAnimationFrame(() => {
      document.getElementById(`conversation-nav--${conversationId}`)?.scrollIntoView({
        behavior: "smooth",
        block: "nearest"
      });
      document.getElementById(`dashboard-main--conv--${conversationId}`)?.scrollIntoView({
        behavior: "smooth",
        block: "nearest"
      });
      if (runId) scrollChatToAgentRun(conversationId, runId);
    });
  }

  const threadMessages: ChatThreadMessage[] = useMemo(
    () =>
      messages.map((m) => ({
        ...m,
        role: m.role as ChatThreadMessage["role"]
      })),
    [messages]
  );

  const convWRef = useRef(convWidthPx);
  const compWRef = useRef(companionWidthPx);
  convWRef.current = convWidthPx;
  compWRef.current = companionWidthPx;

  const persistPanelWidths = useCallback(() => {
    if (typeof window === "undefined") return;
    localStorage.setItem(LS_CONV_W, String(convWRef.current));
    localStorage.setItem(LS_COMP_W, String(compWRef.current));
  }, []);

  const minChatPx = 300;
  const handleCount =
    (isDesktop && convPanelOpen ? 1 : 0) + (isDesktop && companionPanelOpen ? 1 : 0);
  const handleTotalPx = handleCount * 6;

  const dragConvWidth = useCallback(
    (dx: number) => {
      setConvWidthPx((w) => {
        const rowW = layoutRowRef.current?.clientWidth ?? 1600;
        const compW = companionPanelOpen ? compWRef.current : COLLAPSED_COMP_W;
        const maxConv = rowW - compW - handleTotalPx - minChatPx;
        const capHigh = Math.min(MAX_CONV_W, Math.max(MIN_CONV_W, maxConv));
        return clamp(w + dx, MIN_CONV_W, capHigh);
      });
    },
    [companionPanelOpen, convPanelOpen, handleTotalPx]
  );

  const dragCompanionWidth = useCallback(
    (dx: number) => {
      setCompanionWidthPx((w) => {
        const rowW = layoutRowRef.current?.clientWidth ?? 1600;
        const convW = convPanelOpen ? convWRef.current : COLLAPSED_CONV_W;
        const maxComp = rowW - convW - handleTotalPx - minChatPx;
        const capHigh = Math.min(MAX_COMP_W, Math.max(MIN_COMP_W, maxComp));
        // Rozdělovač je na levém okraji panelu nástrojů: tah vpravo zužuje nástroje (rostoucí chat).
        return clamp(w - dx, MIN_COMP_W, capHigh);
      });
    },
    [convPanelOpen, handleTotalPx]
  );

  return (
    <>
      <Modal opened={renameOpened} onClose={closeRenameModal} title="Nový název konverzace" centered>
        <Stack gap="md">
          <TextInput
            label="Název"
            value={renameDraft}
            onChange={(e) => setRenameDraft(e.currentTarget.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") void submitRenameActiveConversation();
            }}
            autoFocus
          />
          <Group justify="flex-end">
            <Button variant="default" onClick={closeRenameModal}>
              Zrušit
            </Button>
            <Button loading={renaming} onClick={() => void submitRenameActiveConversation()}>
              Uložit
            </Button>
          </Group>
        </Stack>
      </Modal>

      <Box
        style={{
          marginInline: "calc(-1 * var(--mantine-spacing-md))",
          width: "calc(100% + 2 * var(--mantine-spacing-md))",
          display: "flex",
          flexDirection: "column",
          flex: 1,
          minHeight: "calc(100dvh - 168px)"
        }}
      >
        <Box px="md" pb="sm">
          <Title order={1} size="h3" fw={600}>
            Dashboard
          </Title>
          <Text c="dimmed" size="sm" mt={4}>
            Konverzace a agent v jednom přehledu. Šířku sloupců upravíte tahem u rozdělovače.
          </Text>
        </Box>

        <Box ref={layoutRowRef} style={{ flex: 1, minHeight: 0, width: "100%", display: "flex" }}>
          <Flex
            gap={0}
            align="stretch"
            direction={{ base: "column", md: "row" }}
            wrap="nowrap"
            style={{ flex: 1, minHeight: 0, width: "100%" }}
          >
          <Paper
            component="aside"
            id="conversation-sidebar"
            aria-labelledby="conversation-sidebar-heading"
            withBorder
            radius="md"
            flex="0 0 auto"
            p={isDesktop && !convPanelOpen ? "xs" : "md"}
            w={isDesktop ? (convPanelOpen ? convWidthPx : COLLAPSED_CONV_W) : "100%"}
            miw={isDesktop ? (convPanelOpen ? convWidthPx : COLLAPSED_CONV_W) : undefined}
            style={{
              transition: panelResizeActive ? "none" : "width 200ms ease, padding 200ms ease",
              overflow: "hidden",
              alignSelf: "stretch"
            }}
          >
            {isDesktop && !convPanelOpen ? (
              <Stack align="center" gap="xs" pt={4} pb="md" px={0}>
                <UnstyledButton
                  type="button"
                  onClick={toggleConvPanel}
                  aria-expanded={false}
                  aria-controls="conversation-sidebar-panel"
                  aria-label="Rozbalit panel konverzací"
                  py={8}
                  px={4}
                  style={{ borderRadius: 8 }}
                >
                  <Text aria-hidden size="lg" c="dimmed" fw={600} lh={1}>
                    ▶
                  </Text>
                </UnstyledButton>
              </Stack>
            ) : (
              <Stack gap="sm">
                <Group justify="space-between" wrap="nowrap" gap="xs" align="center">
                  <Title order={4} id="conversation-sidebar-heading" style={{ textAlign: "left", flex: 1, minWidth: 0 }}>
                    Konverzace
                  </Title>
                  {isDesktop ? (
                    <UnstyledButton
                      type="button"
                      onClick={toggleConvPanel}
                      aria-expanded
                      aria-controls="conversation-sidebar-panel"
                      aria-label="Sbalit panel konverzací"
                      py={4}
                      px={6}
                      style={{ borderRadius: 8, flexShrink: 0 }}
                    >
                      <Text aria-hidden size="sm" c="dimmed" fw={600} lh={1}>
                        ◀
                      </Text>
                    </UnstyledButton>
                  ) : null}
                </Group>

                <Stack id="conversation-sidebar-panel" gap="sm">
                  <Button fullWidth onClick={() => void createConversation()}>
                    Nová konverzace
                  </Button>
                  <Group grow gap="xs">
                    <Button
                      variant="light"
                      size="xs"
                      onClick={beginRenameActiveConversation}
                      disabled={!activeConversationId || renaming}
                    >
                      {renaming ? "Ukládám…" : "Přejmenovat"}
                    </Button>
                    <Button
                      variant="light"
                      color="red"
                      size="xs"
                      onClick={confirmDeleteActiveConversation}
                      disabled={!activeConversationId || deleting}
                    >
                      {deleting ? "Mažu…" : "Smazat"}
                    </Button>
                  </Group>
                  <Divider />
                  <ScrollArea.Autosize mah={480} type="auto" offsetScrollbars>
                    <List listStyleType="none" spacing={4} p={0} m={0}>
                      {conversations.map((conv) => (
                        <List.Item key={conv.id} p={0}>
                          <UnstyledButton
                            component="button"
                            type="button"
                            id={`conversation-nav--${conv.id}`}
                            data-conversation-id={conv.id}
                            data-conversation-title={conv.title}
                            onClick={() => setActiveConversationId(conv.id)}
                            aria-current={activeConversationId === conv.id ? "true" : undefined}
                            w="100%"
                            p="xs"
                            style={{
                              borderRadius: 8,
                              fontWeight: activeConversationId === conv.id ? 600 : 400,
                              background:
                                activeConversationId === conv.id
                                  ? "var(--mantine-color-indigo-light)"
                                  : "transparent"
                            }}
                          >
                            <Text size="sm" lineClamp={2}>
                              {conv.title}
                            </Text>
                          </UnstyledButton>
                        </List.Item>
                      ))}
                    </List>
                  </ScrollArea.Autosize>
                </Stack>
              </Stack>
            )}
          </Paper>

          {isDesktop && convPanelOpen ? (
            <PanelResizeHandle
              aria-label="Změnit šířku panelu konverzací"
              onDrag={dragConvWidth}
              onDragStart={() => setPanelResizeActive(true)}
              onDragEnd={() => {
                setPanelResizeActive(false);
                persistPanelWidths();
              }}
            />
          ) : null}

          <Box
            style={{
              flex: "1 1 0",
              minWidth: 0,
              width: "100%",
              order: isDesktop ? undefined : 1,
              display: "flex",
              flexDirection: "column",
              minHeight: isDesktop ? "min(560px, calc(100dvh - 220px))" : "min(420px, 70dvh)",
              height: isDesktop ? "100%" : undefined,
              maxHeight: isDesktop ? "calc(100dvh - 220px)" : "min(720px, 85dvh)"
            }}
          >
            <Stack gap="lg" style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column" }}>
              <section
                id={
                  activeConversationId
                    ? `dashboard-main--conv--${activeConversationId}`
                    : "dashboard-main--no-conv"
                }
                aria-label={
                  activeConversationTitle
                    ? `Obsah konverzace: ${activeConversationTitle}`
                    : "Obsah dashboardu bez konverzace"
                }
                style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column", overflow: "hidden" }}
              >
                <ConfigurableAgentPanel
                  key={activeConversationId ?? "new"}
                  agents={listAgentUiOptions()}
                  defaultAgentId={selectedAgentId}
                  threadMessages={threadMessages}
                  syncedAgentAnswer={lastAgentAnswer}
                  conversationContext={{
                    id: activeConversationId,
                    title: activeConversationTitle
                  }}
                  onAgentChange={setSelectedAgentId}
                  onRunComplete={(answer) => {
                    if (answer.runId) setCompanionRunId(answer.runId);
                    setLastAgentAnswer(answer);
                  }}
                  getAccessToken={async () => {
                    const sessionResult = await supabase.auth.getSession();
                    return sessionResult.data.session?.access_token ?? null;
                  }}
                  onRun={async ({ question, agentId }, streamOpts) => {
                    const sessionResult = await supabase.auth.getSession();
                    const accessToken = sessionResult.data.session?.access_token;

                    if (!accessToken) {
                      router.push("/auth/login");
                      throw new Error("Nejste přihlášeni.");
                    }

                    let conversationId = activeConversationId;
                    if (!conversationId) {
                      const convResponse = await fetch("/api/conversations", {
                        method: "POST",
                        headers: {
                          "Content-Type": "application/json",
                          Authorization: `Bearer ${accessToken}`
                        },
                        body: JSON.stringify({ title: question.slice(0, 60) })
                      });
                      if (convResponse.ok) {
                        const created = (await convResponse.json()) as Conversation;
                        conversationId = created.id;
                        setConversations((prev) => [created, ...prev]);
                        setActiveConversationId(created.id);
                      }
                    }

                    const response = await fetch("/api/agent/stream", {
                      method: "POST",
                      headers: {
                        "Content-Type": "application/json",
                        Authorization: `Bearer ${accessToken}`
                      },
                      body: JSON.stringify({ question, conversationId, agentId })
                    });

                    if (!response.ok) {
                      const errText = await response.text();
                      let message = `HTTP ${response.status}`;
                      try {
                        const firstLine = errText.trim().split("\n")[0];
                        if (firstLine) {
                          const parsed = JSON.parse(firstLine) as { message?: string };
                          if (parsed.message) message = parsed.message;
                        }
                      } catch {
                        if (errText) message = errText.slice(0, 200);
                      }
                      throw new Error(message);
                    }

                    const payload = await readAgentNdjsonStream(response, {
                      onPhase: streamOpts?.onPhase,
                      onOrchestratorDelta: streamOpts?.onOrchestratorDelta
                    });

                    if (conversationId) {
                      const messagesResponse = await fetch(`/api/conversations/${conversationId}/messages`, {
                        headers: { Authorization: `Bearer ${accessToken}` }
                      });
                      if (messagesResponse.ok) {
                        const rows = (await messagesResponse.json()) as ConversationMessage[];
                        setMessages(rows);
                      }
                      const convResponse = await fetch("/api/conversations", {
                        headers: { Authorization: `Bearer ${accessToken}` }
                      });
                      if (convResponse.ok) {
                        const convs = (await convResponse.json()) as Conversation[];
                        setConversations(convs);
                      }
                    }

                    return payload as AgentAnswer;
                  }}
                />
              </section>
            </Stack>
          </Box>

          {isDesktop && companionPanelOpen ? (
            <PanelResizeHandle
              aria-label="Změnit šířku panelu nástrojů"
              onDrag={dragCompanionWidth}
              onDragStart={() => setPanelResizeActive(true)}
              onDragEnd={() => {
                setPanelResizeActive(false);
                persistPanelWidths();
              }}
            />
          ) : null}

          <ChatCompanionSidebar
            isDesktop={Boolean(isDesktop)}
            panelOpen={companionPanelOpen}
            onTogglePanel={toggleCompanionPanel}
            conversationId={activeConversationId}
            conversationTitle={activeConversationTitle}
            selectedAgentId={selectedAgentId}
            agentOptions={listAgentUiOptions()}
            focusRunId={companionRunId}
            lastAgentAnswer={lastAgentAnswer}
            vizAnswerRuns={vizAnswerRuns}
            onSelectVizAnswerRun={setCompanionRunId}
            onNavigateConversation={navigateToConversation}
            expandedWidthPx={companionWidthPx}
            collapsedWidthPx={COLLAPSED_COMP_W}
            disableWidthTransition={panelResizeActive}
            getAccessToken={async () => {
              const sessionResult = await supabase.auth.getSession();
              return sessionResult.data.session?.access_token ?? null;
            }}
          />
          </Flex>
        </Box>
      </Box>
    </>
  );
}
