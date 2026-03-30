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
import { FormattedAssistantContent } from "@/components/agent/FormattedAssistantContent";

export type ScheduledTaskNotificationRow = {
  id: string;
  task_id: string;
  task_title: string;
  task_cron: string;
  agent_run_id: string | null;
  status: "ok" | "error";
  summary: string;
  detail: string | null;
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
};

export function ScheduledTaskRunResultCard({
  notification: n,
  onOpenFullMessage,
  onMarkRead
}: ScheduledTaskRunResultCardProps) {
  const { notice, agentReply } =
    n.status === "ok" ? splitCronOkNotification(n.summary, n.detail) : { notice: null, agentReply: null };

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
          {notice ? (
            <Box>
              <Text size="xs" fw={700} tt="uppercase" c="dimmed" mb={4}>
                Shrnutí (notifikace)
              </Text>
              <Text size="sm" style={{ whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
                {notice}
              </Text>
            </Box>
          ) : null}
          {notice && agentReply ? <Divider label="Plná odpověď agenta" labelPosition="left" /> : null}
          {agentReply ? (
            <Box>
              {notice ? null : (
                <Text size="xs" fw={700} tt="uppercase" c="dimmed" mb={4}>
                  Výsledek běhu
                </Text>
              )}
              <ScrollArea.Autosize mah={360} mih={80} type="auto" offsetScrollbars>
                <Box py={4}>
                  <FormattedAssistantContent content={agentReply} />
                </Box>
              </ScrollArea.Autosize>
            </Box>
          ) : (
            <Text size="sm" c="dimmed">
              Úloha doběhla — text odpovědi není k dispozici.
            </Text>
          )}
        </Stack>
      ) : (
        <Stack gap="xs">
          <Text size="xs" fw={700} tt="uppercase" c="dimmed">
            Chyba
          </Text>
          <Text size="sm" style={{ whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
            {n.summary}
          </Text>
          {n.detail ? (
            <Box>
              <Text size="xs" fw={600} c="dimmed" mb={4}>
                Detail
              </Text>
              <Text size="xs" c="dimmed" style={{ whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
                {n.detail}
              </Text>
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
  detail
}: {
  status: "ok" | "error";
  summary: string;
  detail: string | null;
}) {
  if (status === "error") {
    const body = [summary, detail ?? ""].filter((s) => s.trim()).join("\n\n").trim() || "—";
    return (
      <ScrollArea h="75vh" type="auto" offsetScrollbars>
        <Text size="sm" style={{ whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
          {body}
        </Text>
      </ScrollArea>
    );
  }

  const { notice, agentReply } = splitCronOkNotification(summary, detail);
  return (
    <ScrollArea h="75vh" type="auto" offsetScrollbars>
      <Stack gap="md" pr="sm" pb="md">
        {notice ? (
          <Box>
            <Text size="xs" fw={700} tt="uppercase" c="dimmed" mb={6}>
              Shrnutí (notifikace)
            </Text>
            <Text size="sm" style={{ whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
              {notice}
            </Text>
          </Box>
        ) : null}
        {notice && agentReply ? <Divider label="Plná odpověď agenta" labelPosition="left" /> : null}
        {agentReply ? (
          <Box>
            {notice ? null : (
              <Text size="xs" fw={700} tt="uppercase" c="dimmed" mb={6}>
                Výsledek běhu
              </Text>
            )}
            <FormattedAssistantContent content={agentReply} />
          </Box>
        ) : (
          <Text size="sm" c="dimmed">
            Úloha doběhla — text odpovědi není k dispozici.
          </Text>
        )}
      </Stack>
    </ScrollArea>
  );
}
