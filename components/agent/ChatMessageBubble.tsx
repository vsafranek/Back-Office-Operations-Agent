"use client";

import { Anchor, Box, Button, Collapse, Group, List, Paper, Text } from "@mantine/core";
import { useState } from "react";
import { AgentTraceTree } from "@/components/agent/AgentTraceTree";
import { FormattedAssistantContent } from "@/components/agent/FormattedAssistantContent";

export type ChatThreadMessage = {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  created_at: string;
  metadata: Record<string, unknown>;
};

function formatTime(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleString("cs-CZ", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
  } catch {
    return "";
  }
}

type ArtifactMeta = { type?: string; label?: string; url?: string; content?: string };

type AssistantMetadata = {
  runId?: string;
  agentId?: string;
  streaming?: boolean;
  agentMode?: string;
  intent?: string;
  confidence?: number;
  sources?: string[];
  next_actions?: string[];
  generated_artifacts?: ArtifactMeta[];
  orchestration?: { reasoning?: string; agentId?: string; mode?: string };
};

function readAssistantMeta(metadata: Record<string, unknown>): AssistantMetadata {
  const m = metadata as AssistantMetadata;
  return m;
}

type Props = {
  message: ChatThreadMessage;
  getAccessToken: () => Promise<string | null>;
  agentLabelById?: Record<string, string>;
};

export function ChatMessageBubble({ message, getAccessToken, agentLabelById }: Props) {
  const [traceOpen, setTraceOpen] = useState(false);
  const [reasoningOpen, setReasoningOpen] = useState(false);
  const t = formatTime(message.created_at);

  if (message.role === "system") {
    return (
      <Box style={{ display: "flex", justifyContent: "center" }}>
        <Paper radius="md" px="md" py={6} bg="yellow.0" withBorder style={{ borderStyle: "dashed", maxWidth: "90%" }}>
          <Text size="xs" c="dark.7" ta="center" style={{ whiteSpace: "pre-wrap" }}>
            {message.content}
          </Text>
          {t ? (
            <Text size="xs" c="dimmed" ta="center" mt={4}>
              {t}
            </Text>
          ) : null}
        </Paper>
      </Box>
    );
  }

  if (message.role === "user") {
    const agentId = typeof message.metadata?.agentId === "string" ? message.metadata.agentId : undefined;
    const agentLabel = agentId ? agentLabelById?.[agentId] ?? agentId : undefined;
    return (
      <Box style={{ display: "flex", justifyContent: "flex-end" }}>
        <Paper
          radius="lg"
          px="md"
          py="sm"
          maw="min(92%, 560px)"
          bg="indigo.1"
          style={{ borderBottomRightRadius: 6 }}
        >
          <Text size="sm" style={{ whiteSpace: "pre-wrap" }}>
            {message.content}
          </Text>
          <Group justify="flex-end" gap="xs" mt={6} wrap="wrap">
            {agentLabel ? (
              <Text size="xs" c="indigo.8" fw={500}>
                {agentLabel}
              </Text>
            ) : null}
            {t ? (
              <Text size="xs" c="dimmed">
                {t}
              </Text>
            ) : null}
          </Group>
        </Paper>
      </Box>
    );
  }

  const meta = readAssistantMeta(message.metadata);
  const streaming = meta.streaming === true;
  const runId = typeof meta.runId === "string" ? meta.runId : undefined;
  const reasoning =
    typeof meta.orchestration?.reasoning === "string" && meta.orchestration.reasoning.trim()
      ? meta.orchestration.reasoning
      : null;
  const conf = typeof meta.confidence === "number" ? meta.confidence : undefined;
  const sources = Array.isArray(meta.sources) ? meta.sources.filter((s): s is string => typeof s === "string") : [];
  const nextActions = Array.isArray(meta.next_actions)
    ? meta.next_actions.filter((s): s is string => typeof s === "string")
    : [];
  const artifacts = Array.isArray(meta.generated_artifacts)
    ? meta.generated_artifacts.filter((a): a is ArtifactMeta => a != null && typeof a === "object")
    : [];

  const intent = typeof meta.intent === "string" ? meta.intent : undefined;
  const hideTraceForCasualChat = intent === "casual_chat" && artifacts.length === 0;

  return (
    <Box id={runId ? `chat-assistant-run-${runId}` : undefined} style={{ display: "flex", justifyContent: "flex-start" }}>
      <Paper
        radius="lg"
        px="md"
        py="sm"
        maw="min(96%, 640px)"
        withBorder
        bg="gray.0"
        style={{ borderBottomLeftRadius: 6 }}
      >
        <FormattedAssistantContent content={message.content} />

        {streaming ? (
          <Text size="xs" c="dimmed" mt={6}>
            Dokončuji odpověď…
          </Text>
        ) : null}

        {!streaming && reasoning ? (
          <Box mt="sm">
            <Button
              type="button"
              variant="subtle"
              size="compact-xs"
              color="gray"
              onClick={() => setReasoningOpen((o) => !o)}
              aria-expanded={reasoningOpen}
            >
              {reasoningOpen ? "Skrýt úvahu Thinking Agent" : "Úvaha Thinking Agent"}
            </Button>
            <Collapse in={reasoningOpen}>
              <Text size="xs" c="dimmed" mt="xs" style={{ whiteSpace: "pre-wrap" }}>
                {reasoning}
              </Text>
            </Collapse>
          </Box>
        ) : null}

        {!streaming && (conf != null || sources.length > 0) && (
          <Text size="xs" c="dimmed" mt="xs">
            {conf != null ? `Spolehlivost: ${conf.toFixed(2)}` : null}
            {conf != null && sources.length > 0 ? " · " : null}
            {sources.length > 0 ? `Zdroje: ${sources.join(", ")}` : null}
          </Text>
        )}

        {!streaming && nextActions.length > 0 ? (
          <Box mt="sm">
            <Text size="xs" fw={600} mb={4}>
              Další kroky
            </Text>
            <List size="xs" spacing={4}>
              {nextActions.map((a, i) => (
                <List.Item key={i}>{a}</List.Item>
              ))}
            </List>
          </Box>
        ) : null}

        {!streaming && artifacts.length > 0 ? (
          <Box mt="sm">
            <Text size="xs" fw={600} mb={4}>
              Artefakty
            </Text>
            <List size="xs" spacing={4}>
              {artifacts.map((art, i) => (
                <List.Item key={i}>
                  {art.label ?? "Soubor"}
                  {art.url ? (
                    <>
                      {" "}
                      <Anchor href={art.url} target="_blank" rel="noreferrer" size="xs">
                        odkaz
                      </Anchor>
                    </>
                  ) : null}
                </List.Item>
              ))}
            </List>
          </Box>
        ) : null}

        {!streaming && runId && !hideTraceForCasualChat ? (
          <Box mt="sm">
            <Button
              type="button"
              variant="light"
              size="compact-xs"
              color="indigo"
              onClick={() => setTraceOpen((o) => !o)}
              aria-expanded={traceOpen}
            >
              {traceOpen ? "Skrýt strom volání (subagenti a nástroje)" : "Strom volání (subagenti a nástroje)"}
            </Button>
            <Collapse in={traceOpen}>
              <Box mt="xs" p="xs" bg="white" style={{ borderRadius: 8, border: "1px solid var(--mantine-color-default-border)" }}>
                {traceOpen ? (
                  <AgentTraceTree runId={runId} getAccessToken={getAccessToken} variant="embedded" />
                ) : null}
              </Box>
            </Collapse>
          </Box>
        ) : null}

        {t ? (
          <Text size="xs" c="dimmed" mt="xs" ta="right">
            {t}
          </Text>
        ) : null}
      </Paper>
    </Box>
  );
}
