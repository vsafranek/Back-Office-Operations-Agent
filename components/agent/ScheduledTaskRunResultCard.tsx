"use client";

import {
  Badge,
  Box,
  Button,
  Code,
  Divider,
  Group,
  Paper,
  ScrollArea,
  Stack,
  Text
} from "@mantine/core";
import { AgentDataPanel } from "@/components/agent/AgentDataPanel";
import { FormattedAssistantContent } from "@/components/agent/FormattedAssistantContent";
import { agentAnswerSliceFromPersistPayload } from "@/lib/agent/conversation/agent-panel-persist";

export type ScheduledTaskNotificationRow = {
  id: string;
  task_id: string;
  task_title: string;
  task_cron: string;
  agent_run_id: string | null;
  status: "ok" | "error";
  summary: string;
  detail: string | null;
  panel_payload?: unknown | null;
  agent_question?: string | null;
  agent_answer?: string | null;
  read_at: string | null;
  created_at: string;
};

/** Tělo pro modal „Celá zpráva“ (jeden řetězec; u úspěchu preferuje plný detail). */
export function cronNotificationFullBody(n: ScheduledTaskNotificationRow): string {
  if (n.status === "ok") {
    return (n.detail?.trim() || n.summary || "Úloha doběhla.").trim();
  }
  return [n.summary, n.detail ?? ""].filter((s) => s.trim()).join("\n\n").trim() || "—";
}

type SplitOkParts = { notice: string | null; agentReply: string | null };

/** Stejný oddělovač jako u `runBackOfficeAgent` + cron úlohy (`orchestratorQuestionPrefix`). */
const SCHEDULED_TASK_QUESTION_DELIM = "\n\n--- Dotaz / šablona úlohy ---\n";

/**
 * Část před `--- Dotaz / šablona úlohy ---` — systémové zadání / orchestrátor (volající kontext).
 * Vlastní dotaz úlohy se v UI nezobrazuje (je v „Finální odpověď agenta“ jen výstup).
 */
export function splitScheduledTaskCallerPrompt(full: string | null | undefined): string | null {
  const t = full?.trim() ?? "";
  if (!t) return null;
  const idx = t.indexOf(SCHEDULED_TASK_QUESTION_DELIM);
  if (idx === -1) return null;
  return t.slice(0, idx).trim() || null;
}

/**
 * Oddělí krátký řádek notifikace od plné odpovědi agenta.
 * U krátké odpovědi bývá summary === detail → vrátí jen jeden blok (`agentReply`).
 */
export function splitCronOkNotification(summary: string, detail: string | null): SplitOkParts {
  const s = summary.trim();
  const d = (detail ?? "").trim();
  if (!d) {
    return { notice: null, agentReply: s || null };
  }
  if (d === s) {
    return { notice: null, agentReply: d };
  }
  const truncatedMarker = s.endsWith("…") || s.endsWith("...");
  if (truncatedMarker || d.length > s.length + 10) {
    return { notice: s || null, agentReply: d };
  }
  return { notice: null, agentReply: d };
}

export type ScheduledTaskRunResultCardProps = {
  notification: ScheduledTaskNotificationRow;
  onOpenFullMessage: () => void;
  onMarkRead?: () => void;
  getAccessToken?: () => Promise<string | null>;
};

export function ScheduledTaskRunResultCard({
  notification: n,
  onOpenFullMessage,
  onMarkRead,
  getAccessToken
}: ScheduledTaskRunResultCardProps) {
  const { notice, agentReply } =
    n.status === "ok" ? splitCronOkNotification(n.summary, n.detail) : { notice: null, agentReply: null };
  const finalAgentReply = n.agent_answer?.trim() || agentReply;
  const callerPrompt = splitScheduledTaskCallerPrompt(n.agent_question);
  const panelSlice = n.panel_payload ? agentAnswerSliceFromPersistPayload(n.panel_payload) : null;
  const panelBundles =
    panelSlice?.dataPanelBundles && panelSlice.dataPanelBundles.length > 0
      ? panelSlice.dataPanelBundles
      : panelSlice?.dataPanel
        ? [{ dataPanel: panelSlice.dataPanel, dataPanelDownloads: panelSlice.dataPanelDownloads }]
        : [];

  return (
    <Paper withBorder p="sm" radius="md">
      <Group justify="space-between" wrap="nowrap" gap={6} mb={6}>
        <Group gap={6} wrap="nowrap">
          <Badge size="xs" color={n.status === "ok" ? "teal" : "red"}>
            {n.status}
          </Badge>
          {!n.read_at ? (
            <Badge size="xs" variant="outline" color="orange">
              Nepřečtené
            </Badge>
          ) : null}
        </Group>
        <Group gap={6} wrap="nowrap">
          <Button size="compact-xs" variant="light" onClick={onOpenFullMessage}>
            Celá zpráva
          </Button>
          {!n.read_at && onMarkRead ? (
            <Button size="compact-xs" variant="subtle" onClick={() => void onMarkRead()}>
              Přečíst
            </Button>
          ) : null}
          <Text size="xs" c="dimmed">
            {new Date(n.created_at).toLocaleString("cs-CZ")}
          </Text>
        </Group>
      </Group>

      {n.status === "ok" ? (
        <Stack gap="sm">
          {(notice ?? n.summary).trim() ? (
            <Box>
              <Text size="xs" fw={700} tt="uppercase" c="dimmed" mb={4}>
                Shrnutí — co se zjistilo
              </Text>
              <ScrollArea.Autosize mah={160} mih={40} type="auto" offsetScrollbars>
                <Box py={4}>
                  <FormattedAssistantContent content={(notice ?? n.summary).trim()} />
                </Box>
              </ScrollArea.Autosize>
            </Box>
          ) : null}
          {callerPrompt ? (
            <Box>
              <Divider label="Prompt volajícího agenta" labelPosition="left" mb="sm" />
              <ScrollArea.Autosize mah={280} mih={60} type="auto" offsetScrollbars>
                <Box py={4}>
                  <FormattedAssistantContent content={callerPrompt} />
                </Box>
              </ScrollArea.Autosize>
            </Box>
          ) : null}
          {finalAgentReply ? (
            <Box>
              <Divider label="Finální odpověď agenta" labelPosition="left" mb="sm" />
              <ScrollArea.Autosize mah={360} mih={80} type="auto" offsetScrollbars>
                <Box py={4}>
                  <FormattedAssistantContent content={finalAgentReply} />
                </Box>
              </ScrollArea.Autosize>
            </Box>
          ) : (
            <Text size="sm" c="dimmed">
              Úloha doběhla — text odpovědi není k dispozici.
            </Text>
          )}
          {panelBundles.length > 0 ? (
            <Box>
              <Divider label="Data z běhu (panely)" labelPosition="left" my="sm" />
              <Stack gap="md">
                {panelBundles.map((b, i) => (
                  <AgentDataPanel
                    key={`${n.id}-panel-${i}`}
                    panel={b.dataPanel}
                    dataPanelDownloads={b.dataPanelDownloads}
                    getAccessToken={getAccessToken}
                  />
                ))}
              </Stack>
            </Box>
          ) : null}
        </Stack>
      ) : (
        <Stack gap="xs">
          <Text size="xs" fw={700} tt="uppercase" c="dimmed">
            Chyba
          </Text>
          <FormattedAssistantContent content={n.summary} />
          {n.detail ? (
            <Box>
              <Text size="xs" fw={600} c="dimmed" mb={4}>
                Detail
              </Text>
              <FormattedAssistantContent content={n.detail} />
            </Box>
          ) : null}
        </Stack>
      )}

      {n.agent_run_id ? (
        <Text size="xs" c="dimmed" mt="sm">
          run_id: <Code>{n.agent_run_id}</Code>
        </Text>
      ) : null}
    </Paper>
  );
}

/** Obsah modalu — stejné oddělení notifikace / odpovědi jako u karty. */
export function ScheduledTaskRunModalContent({
  status,
  summary,
  detail,
  agentQuestion,
  agentAnswer,
  panelPayload,
  getAccessToken
}: {
  status: "ok" | "error";
  summary: string;
  detail: string | null;
  agentQuestion?: string | null;
  agentAnswer?: string | null;
  panelPayload?: unknown | null;
  getAccessToken?: () => Promise<string | null>;
}) {
  if (status === "error") {
    const body = [summary, detail ?? ""].filter((s) => s.trim()).join("\n\n").trim() || "—";
    return (
      <ScrollArea h="75vh" type="auto" offsetScrollbars>
        <FormattedAssistantContent content={body} />
      </ScrollArea>
    );
  }

  const { notice, agentReply } = splitCronOkNotification(summary, detail);
  const finalAgentReply = agentAnswer?.trim() || agentReply;
  const callerPrompt = splitScheduledTaskCallerPrompt(agentQuestion);
  const panelSlice = panelPayload ? agentAnswerSliceFromPersistPayload(panelPayload) : null;
  const panelBundles =
    panelSlice?.dataPanelBundles && panelSlice.dataPanelBundles.length > 0
      ? panelSlice.dataPanelBundles
      : panelSlice?.dataPanel
        ? [{ dataPanel: panelSlice.dataPanel, dataPanelDownloads: panelSlice.dataPanelDownloads }]
        : [];
  return (
    <ScrollArea h="75vh" type="auto" offsetScrollbars>
      <Stack gap="md" pr="sm" pb="md">
        {(notice ?? summary).trim() ? (
          <Box>
            <Text size="xs" fw={700} tt="uppercase" c="dimmed" mb={6}>
              Shrnutí — co se zjistilo
            </Text>
            <FormattedAssistantContent content={(notice ?? summary).trim()} />
          </Box>
        ) : null}
        {callerPrompt ? (
          <Box>
            <Divider label="Prompt volajícího agenta" labelPosition="left" mb="sm" />
            <FormattedAssistantContent content={callerPrompt} />
          </Box>
        ) : null}
        {finalAgentReply ? (
          <Box>
            <Divider label="Finální odpověď agenta" labelPosition="left" mb="sm" />
            <FormattedAssistantContent content={finalAgentReply} />
          </Box>
        ) : (
          <Text size="sm" c="dimmed">
            Úloha doběhla — text odpovědi není k dispozici.
          </Text>
        )}
        {panelBundles.length > 0 ? (
          <Box>
            <Divider label="Data z běhu (panely)" labelPosition="left" />
            <Stack gap="md" mt="md">
              {panelBundles.map((b, i) => (
                <AgentDataPanel
                  key={`modal-panel-${i}`}
                  panel={b.dataPanel}
                  dataPanelDownloads={b.dataPanelDownloads}
                  getAccessToken={getAccessToken}
                />
              ))}
            </Stack>
          </Box>
        ) : null}
      </Stack>
    </ScrollArea>
  );
}
