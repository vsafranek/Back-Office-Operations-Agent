"use client";

import { useCallback, useEffect, useState } from "react";
import { Badge, Button, Group, Paper, Stack, Text, Code } from "@mantine/core";
import type { AuditRunAggregate } from "@/lib/types/audit-run-aggregate";

type Props = {
  runId: string;
  getAccessToken: () => Promise<string | null>;
};

export function AuditRunSummary({ runId, getAccessToken }: Props) {
  const [data, setData] = useState<AuditRunAggregate | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const token = await getAccessToken();
    if (!token) {
      setError("Pro přehled auditu se přihlaste.");
      setLoading(false);
      return;
    }
    try {
      const res = await fetch(`/api/audit/run?runId=${encodeURIComponent(runId)}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const json = (await res.json()) as AuditRunAggregate | { error?: string };
      if (!res.ok) {
        setError("error" in json && json.error ? json.error : "Načtení auditu se nezdařilo.");
        setData(null);
        return;
      }
      setData(json as AuditRunAggregate);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Neznámá chyba");
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [runId, getAccessToken]);

  useEffect(() => {
    void load();
  }, [load]);

  async function downloadCsv() {
    const token = await getAccessToken();
    if (!token) return;
    const res = await fetch(`/api/audit/run?runId=${encodeURIComponent(runId)}&format=csv`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    if (!res.ok) return;
    const blob = await res.blob();
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `audit-run-${runId.slice(0, 8)}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  if (loading) {
    return (
      <Text size="sm" c="dimmed">
        Načítám audit log běhu…
      </Text>
    );
  }
  if (error) {
    return (
      <Text size="sm" c="red" role="alert">
        {error}
      </Text>
    );
  }
  if (!data) return null;

  return (
    <Stack gap="sm">
      <Group justify="space-between" wrap="wrap">
        <Text fw={700}>Audit log běhu</Text>
        <Group gap="xs">
          <Button size="compact-xs" variant="light" onClick={() => void load()}>
            Obnovit
          </Button>
          <Button size="compact-xs" variant="default" onClick={() => void downloadCsv()}>
            Stáhnout CSV
          </Button>
        </Group>
      </Group>

      <Paper withBorder p="sm" radius="sm">
        <Stack gap={6}>
          <Group gap="xs">
            <Badge variant="light">run {runId.slice(0, 8)}…</Badge>
            <Badge variant="light" color={data.agentRun ? "blue" : "gray"}>
              {data.agentRun ? `intent: ${data.agentRun.intent}` : "agent run nenalezen"}
            </Badge>
          </Group>
          {data.agentRun?.question ? (
            <Text size="xs" c="dimmed" lineClamp={2}>
              Dotaz: {data.agentRun.question}
            </Text>
          ) : null}
          <Text size="xs" c="dimmed">
            Trace eventy celkem: {data.traceEventCount} · Outbound e-maily: {data.outboundEmails.length}
          </Text>
        </Stack>
      </Paper>

      <Paper withBorder p="sm" radius="sm">
        <Stack gap="xs">
          <Text fw={600} size="sm">
            Timeline (sample)
          </Text>
          {data.traceSample.length === 0 ? (
            <Text size="xs" c="dimmed">
              Pro tento běh není dostupný trace sample.
            </Text>
          ) : (
            data.traceSample.map((e) => (
              <Code key={e.id} block style={{ whiteSpace: "pre-wrap" }}>
                [{new Date(e.created_at).toLocaleString("cs-CZ")}] {e.kind}/{e.name} · {e.status}
                {e.duration_ms != null ? ` · ${e.duration_ms} ms` : ""}
              </Code>
            ))
          )}
        </Stack>
      </Paper>

      <Paper withBorder p="sm" radius="sm">
        <Stack gap="xs">
          <Text fw={600} size="sm">
            Outbound e-maily
          </Text>
          {data.outboundEmails.length === 0 ? (
            <Text size="xs" c="dimmed">
              Žádné odchozí e-maily navázané na tento běh.
            </Text>
          ) : (
            data.outboundEmails.map((o) => (
              <Text key={o.id} size="xs">
                {new Date(o.created_at).toLocaleString("cs-CZ")} · <strong>{o.action}</strong> → {o.to_email}
                {o.leadIds.length > 0 ? ` · leady: ${o.leadIds.length}` : ""}
              </Text>
            ))
          )}
        </Stack>
      </Paper>
    </Stack>
  );
}
