"use client";

import { Badge, Button, Card, Container, Group, Loader, Stack, Table, Text, TextInput, Title } from "@mantine/core";
import { useState } from "react";

type RunMetadata = {
  reconciliationSkippedReason?: string | null;
  diagnostics?: {
    isCompleteSnapshot?: boolean;
    failedPages?: number[];
    pagesRequested?: number;
    pagesSucceeded?: number;
    cappedByMaxPages?: boolean;
  };
};

type RunItem = {
  id: string;
  sourceKey: string;
  triggerMode: string;
  status: string;
  startedAt: string;
  finishedAt: string | null;
  fetchedCount: number;
  parsedCount: number;
  upsertedCount: number;
  failedCount: number;
  errorMessage: string | null;
  metadata?: RunMetadata | null;
};

function renderSnapshotState(run: RunItem): string {
  const complete = run.metadata?.diagnostics?.isCompleteSnapshot;
  if (complete === true) return "complete";
  if (complete === false) return "incomplete";
  return "unknown";
}

function renderFailedPages(run: RunItem): string {
  const pages = run.metadata?.diagnostics?.failedPages;
  if (!pages || pages.length === 0) return "-";
  const preview = pages.slice(0, 5).join(",");
  const suffix = pages.length > 5 ? ` +${pages.length - 5}` : "";
  return `${preview}${suffix}`;
}

export default function IngestionAdminPage() {
  const [operatorKey, setOperatorKey] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [items, setItems] = useState<RunItem[]>([]);

  async function loadRuns() {
    setLoading(true);
    setError(null);

    const response = await fetch("/api/integrations/sreality/ingest/runs?limit=100", {
      headers: operatorKey ? { "x-operator-key": operatorKey } : undefined
    });

    if (!response.ok) {
      const body = (await response.json().catch(() => ({}))) as { error?: string };
      setError(body.error ?? `Load failed (${response.status})`);
      setLoading(false);
      return;
    }

    const body = (await response.json()) as { items: RunItem[] };
    setItems(body.items);
    setLoading(false);
  }

  return (
    <Container size="xl" py="xl">
      <Stack gap="lg">
        <Group justify="space-between">
          <div>
            <Title order={1} size="h2">
              Ingestion Monitor
            </Title>
            <Text c="dimmed">Přehled posledních scrape běhů Sreality (byty).</Text>
          </div>
          <Badge variant="light">Runs: {items.length}</Badge>
        </Group>

        <Card withBorder>
          <Stack>
            <TextInput
              label="Operator key"
              placeholder="x-operator-key"
              value={operatorKey}
              onChange={(event) => setOperatorKey(event.currentTarget.value)}
            />
            <Group>
              <Button onClick={() => void loadRuns()} loading={loading}>
                Načíst běhy
              </Button>
            </Group>
            {error ? <Text c="red">{error}</Text> : null}
          </Stack>
        </Card>

        {loading ? (
          <Group justify="center" py="xl">
            <Loader />
          </Group>
        ) : (
          <Card withBorder>
            <Table.ScrollContainer minWidth={1300}>
              <Table striped highlightOnHover withTableBorder>
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th>Run ID</Table.Th>
                    <Table.Th>Status</Table.Th>
                    <Table.Th>Trigger</Table.Th>
                    <Table.Th>Started</Table.Th>
                    <Table.Th>Finished</Table.Th>
                    <Table.Th>Fetched</Table.Th>
                    <Table.Th>Parsed</Table.Th>
                    <Table.Th>Upserted</Table.Th>
                    <Table.Th>Failed</Table.Th>
                    <Table.Th>Snapshot</Table.Th>
                    <Table.Th>Fail pages</Table.Th>
                    <Table.Th>Reconcile skip</Table.Th>
                    <Table.Th>Error</Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {items.map((run) => (
                    <Table.Tr key={run.id}>
                      <Table.Td>{run.id.slice(0, 8)}...</Table.Td>
                      <Table.Td>{run.status}</Table.Td>
                      <Table.Td>{run.triggerMode}</Table.Td>
                      <Table.Td>{new Date(run.startedAt).toLocaleString("cs-CZ")}</Table.Td>
                      <Table.Td>{run.finishedAt ? new Date(run.finishedAt).toLocaleString("cs-CZ") : "-"}</Table.Td>
                      <Table.Td>{run.fetchedCount}</Table.Td>
                      <Table.Td>{run.parsedCount}</Table.Td>
                      <Table.Td>{run.upsertedCount}</Table.Td>
                      <Table.Td>{run.failedCount}</Table.Td>
                      <Table.Td>{renderSnapshotState(run)}</Table.Td>
                      <Table.Td>{renderFailedPages(run)}</Table.Td>
                      <Table.Td>{run.metadata?.reconciliationSkippedReason ?? "-"}</Table.Td>
                      <Table.Td>{run.errorMessage ?? "-"}</Table.Td>
                    </Table.Tr>
                  ))}
                </Table.Tbody>
              </Table>
            </Table.ScrollContainer>
          </Card>
        )}
      </Stack>
    </Container>
  );
}
