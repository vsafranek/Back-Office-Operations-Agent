"use client";

import {
  Anchor,
  Button,
  Code,
  Divider,
  Group,
  Modal,
  MultiSelect,
  NumberInput,
  ScrollArea,
  Select,
  Stack,
  Text,
  Textarea,
  TextInput,
  UnstyledButton
} from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { AgentDataPanel } from "@/components/agent/AgentDataPanel";
import { MarketListingsDataPanelSection } from "@/components/agent/MarketListingsDataPanelSection";
import { DATASET_IDS } from "@/lib/agent/tools/data-pull-plan";
import type { FetchMarketListingsInput } from "@/lib/agent/tools/market-listings-tool";
import type { AgentAnswer } from "@/lib/agent/types";

type GmailRow = {
  id: string;
  threadId: string;
  snippet: string;
  from: string;
  subject: string;
  date: string;
};

type OutboundRow = {
  id: string;
  conversation_id: string | null;
  agent_run_id: string | null;
  action: string;
  to_email: string;
  subject: string;
  body_excerpt: string | null;
  created_at: string;
};

type CalendarEv = { id: string; summary: string; start: string; end: string; htmlLink?: string };

function startOfWeekMonday(d: Date): Date {
  const x = new Date(d);
  const day = x.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  x.setDate(x.getDate() + diff);
  x.setHours(0, 0, 0, 0);
  return x;
}

function addDays(d: Date, n: number): Date {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}

export function MailToolPanel(props: {
  getAccessToken: () => Promise<string | null>;
  conversationId: string | null;
  focusRunId: string | null;
  onNavigateConversation: (conversationId: string, runId?: string | null) => void;
}) {
  const { getAccessToken, conversationId, focusRunId, onNavigateConversation } = props;
  const [messages, setMessages] = useState<GmailRow[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [detail, setDetail] = useState<{ subject: string; from: string; bodyText: string } | null>(null);
  const [opened, { open, close }] = useDisclosure(false);
  const [composeTo, setComposeTo] = useState("");
  const [composeSubject, setComposeSubject] = useState("");
  const [composeBody, setComposeBody] = useState("");
  const [composeBusy, setComposeBusy] = useState(false);
  const [outbound, setOutbound] = useState<OutboundRow[] | null>(null);

  const loadList = useCallback(async () => {
    setLoading(true);
    setErr(null);
    const token = await getAccessToken();
    if (!token) {
      setErr("Nejste přihlášeni.");
      setLoading(false);
      return;
    }
    const u = new URL("/api/google/gmail/messages", window.location.origin);
    u.searchParams.set("maxResults", "20");
    if (q.trim()) u.searchParams.set("q", q.trim());
    const res = await fetch(u.toString(), { headers: { Authorization: `Bearer ${token}` } });
    const data = (await res.json()) as { messages?: GmailRow[]; error?: string };
    setLoading(false);
    if (!res.ok) {
      setErr(data.error ?? "Chyba načtení pošty.");
      return;
    }
    setMessages(data.messages ?? []);
  }, [getAccessToken, q]);

  const loadOutbound = useCallback(async () => {
    const token = await getAccessToken();
    if (!token) return;
    const res = await fetch("/api/mail/outbound-history", { headers: { Authorization: `Bearer ${token}` } });
    const data = (await res.json()) as { items?: OutboundRow[] };
    if (res.ok) setOutbound(data.items ?? []);
  }, [getAccessToken]);

  useEffect(() => {
    void loadList();
    void loadOutbound();
  }, [loadList, loadOutbound]);

  async function openMessage(id: string) {
    const token = await getAccessToken();
    if (!token) return;
    const res = await fetch(`/api/google/gmail/messages/${encodeURIComponent(id)}`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    const data = (await res.json()) as { subject?: string; from?: string; bodyText?: string; error?: string };
    if (!res.ok) {
      setErr(data.error ?? "Detail se nepodařil načíst.");
      return;
    }
    setDetail({
      subject: data.subject ?? "",
      from: data.from ?? "",
      bodyText: data.bodyText ?? ""
    });
  }

  async function submitDraft() {
    setComposeBusy(true);
    try {
      const token = await getAccessToken();
      if (!token) return;
      const res = await fetch("/api/mail/email-draft", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          to: composeTo.trim(),
          subject: composeSubject.trim(),
          body: composeBody.trim(),
          conversationId: conversationId ?? null,
          agentRunId: focusRunId ?? null
        })
      });
      if (!res.ok) {
        const j = (await res.json()) as { error?: string };
        setErr(j.error ?? "Draft se nepodařilo vytvořit.");
        return;
      }
      close();
      setComposeTo("");
      setComposeSubject("");
      setComposeBody("");
      void loadOutbound();
    } finally {
      setComposeBusy(false);
    }
  }

  return (
    <Stack gap="sm">
      <Text size="sm" c="dimmed">
        Gmail / Outlook podle nastavení integrace.{" "}
        <Anchor component={Link} href="/settings" size="sm">
          Nastavení
        </Anchor>
      </Text>
      <Group wrap="nowrap" gap="xs">
        <TextInput placeholder="Gmail hledání (q)…" value={q} onChange={(e) => setQ(e.currentTarget.value)} style={{ flex: 1 }} size="xs" />
        <Button size="xs" variant="light" onClick={() => void loadList()} loading={loading}>
          Načíst
        </Button>
        <Button size="xs" onClick={open}>
          Nový draft
        </Button>
      </Group>
      {err ? (
        <Text size="sm" c="red">
          {err}
        </Text>
      ) : null}
      {loading && messages == null ? <Text size="sm">Načítám…</Text> : null}
      <ScrollArea.Autosize mah={220} type="auto">
        <Stack gap={6}>
          {(messages ?? []).map((m) => (
            <UnstyledButton
              key={m.id}
              type="button"
              onClick={() => void openMessage(m.id)}
              style={{
                textAlign: "left",
                padding: 8,
                borderRadius: 8,
                border: "1px solid var(--mantine-color-default-border)"
              }}
            >
              <Text size="xs" fw={600} lineClamp={1}>
                {m.subject || "(Bez předmětu)"}
              </Text>
              <Text size="xs" c="dimmed" lineClamp={1}>
                {m.from}
              </Text>
              <Text size="xs" c="dimmed" lineClamp={2}>
                {m.snippet}
              </Text>
            </UnstyledButton>
          ))}
        </Stack>
      </ScrollArea.Autosize>

      <Divider label="Odchozí z aplikace" labelPosition="center" />
      <ScrollArea.Autosize mah={180} type="auto">
        <Stack gap={6}>
          {(outbound ?? []).map((o) => (
            <div key={o.id} style={{ padding: 8, borderRadius: 8, background: "var(--mantine-color-gray-0)" }}>
              <Text size="xs" fw={600} lineClamp={1}>
                {o.subject}
              </Text>
              <Text size="xs" c="dimmed">
                → {o.to_email} · {o.action} · {new Date(o.created_at).toLocaleString("cs-CZ")}
              </Text>
              {o.conversation_id ? (
                <Button
                  size="compact-xs"
                  variant="light"
                  mt={4}
                  onClick={() => onNavigateConversation(o.conversation_id!, o.agent_run_id)}
                >
                  Otevřít konverzaci
                </Button>
              ) : null}
            </div>
          ))}
        </Stack>
      </ScrollArea.Autosize>

      <Modal opened={opened} onClose={close} title="Nový draft" size="md">
        <Stack gap="sm">
          <TextInput label="Komu" value={composeTo} onChange={(e) => setComposeTo(e.currentTarget.value)} />
          <TextInput label="Předmět" value={composeSubject} onChange={(e) => setComposeSubject(e.currentTarget.value)} />
          <Textarea label="Text" minRows={4} value={composeBody} onChange={(e) => setComposeBody(e.currentTarget.value)} />
          <Group justify="flex-end">
            <Button variant="default" onClick={close}>
              Zrušit
            </Button>
            <Button loading={composeBusy} onClick={() => void submitDraft()}>
              Vytvořit draft
            </Button>
          </Group>
        </Stack>
      </Modal>

      <Modal opened={detail != null} onClose={() => setDetail(null)} title={detail?.subject ?? "Zpráva"} size="lg">
        {detail ? (
          <Stack gap="sm">
            <Text size="sm" c="dimmed">
              {detail.from}
            </Text>
            <Code block style={{ whiteSpace: "pre-wrap", maxHeight: 360, overflow: "auto" }}>
              {detail.bodyText}
            </Code>
          </Stack>
        ) : null}
      </Modal>
    </Stack>
  );
}

export function CalendarToolPanel({ getAccessToken }: { getAccessToken: () => Promise<string | null> }) {
  const [weekOffset, setWeekOffset] = useState(0);
  const [events, setEvents] = useState<CalendarEv[]>([]);
  const [provider, setProvider] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const range = useMemo(() => {
    const base = addDays(startOfWeekMonday(new Date()), weekOffset * 7);
    const timeMin = base.toISOString();
    const timeMax = addDays(base, 7).toISOString();
    return { timeMin, timeMax, label: `${base.toLocaleDateString("cs-CZ")} – ${addDays(base, 6).toLocaleDateString("cs-CZ")}` };
  }, [weekOffset]);

  const load = useCallback(async () => {
    setLoading(true);
    setErr(null);
    const token = await getAccessToken();
    if (!token) {
      setErr("Nejste přihlášeni.");
      setLoading(false);
      return;
    }
    const u = new URL("/api/google/calendar/events", window.location.origin);
    u.searchParams.set("timeMin", range.timeMin);
    u.searchParams.set("timeMax", range.timeMax);
    const res = await fetch(u.toString(), { headers: { Authorization: `Bearer ${token}` } });
    const data = (await res.json()) as { events?: CalendarEv[]; provider?: string; error?: string };
    setLoading(false);
    if (!res.ok) {
      setErr(data.error ?? "Kalendář se nepodařilo načíst.");
      return;
    }
    setEvents(data.events ?? []);
    setProvider(data.provider ?? "");
  }, [getAccessToken, range.timeMin, range.timeMax]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <Stack gap="sm">
      <Text size="sm" c="dimmed">
        Kalendář (Google / Microsoft dle nastavení).{" "}
        <Anchor component={Link} href="/settings" size="sm">
          Nastavení
        </Anchor>
      </Text>
      <Group justify="space-between">
        <Button size="xs" variant="default" onClick={() => setWeekOffset((w) => w - 1)}>
          ← Týden
        </Button>
        <Text size="sm" fw={600}>
          {range.label}
        </Text>
        <Button size="xs" variant="default" onClick={() => setWeekOffset((w) => w + 1)}>
          Týden →
        </Button>
      </Group>
      {provider ? (
        <Text size="xs" c="dimmed">
          Zdroj: {provider}
        </Text>
      ) : null}
      {err ? (
        <Text size="sm" c="red">
          {err}
        </Text>
      ) : null}
      {loading ? <Text size="sm">Načítám…</Text> : null}
      <ScrollArea.Autosize mah={400} type="auto">
        <Stack gap={6}>
          {events.map((e) => (
            <div key={e.id} style={{ padding: 8, borderRadius: 8, border: "1px solid var(--mantine-color-default-border)" }}>
              <Text size="sm" fw={600}>
                {e.summary}
              </Text>
              <Text size="xs" c="dimmed">
                {new Date(e.start).toLocaleString("cs-CZ")} – {new Date(e.end).toLocaleString("cs-CZ")}
              </Text>
              {e.htmlLink ? (
                <Anchor href={e.htmlLink} target="_blank" rel="noreferrer" size="xs">
                  Otevřít v kalendáři
                </Anchor>
              ) : null}
            </div>
          ))}
          {!loading && events.length === 0 ? <Text size="sm" c="dimmed">Žádné události v tomto týdnu.</Text> : null}
        </Stack>
      </ScrollArea.Autosize>
    </Stack>
  );
}

const DATA_OPTIONS = DATASET_IDS.map((id) => ({ value: id, label: id }));

export function DataPresetPanel({ getAccessToken }: { getAccessToken: () => Promise<string | null> }) {
  const [dataset, setDataset] = useState<string>(DATASET_IDS[0]!);
  const [narrow, setNarrow] = useState("");
  const [limit, setLimit] = useState(80);
  const [rows, setRows] = useState<Record<string, unknown>[]>([]);
  const [source, setSource] = useState("");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function run() {
    setLoading(true);
    setErr(null);
    const token = await getAccessToken();
    if (!token) {
      setErr("Nejste přihlášeni.");
      setLoading(false);
      return;
    }
    const res = await fetch("/api/data/preset-query", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        dataset,
        row_text_narrowing: narrow.trim() || null,
        limit
      })
    });
    const data = (await res.json()) as {
      rows?: Record<string, unknown>[];
      source?: string;
      error?: string;
    };
    setLoading(false);
    if (!res.ok) {
      setErr(data.error ?? "Dotaz selhal.");
      return;
    }
    setRows(data.rows ?? []);
    setSource(data.source ?? "");
  }

  const keys = rows[0] ? Object.keys(rows[0]) : [];

  return (
    <Stack gap="sm">
      <Text size="sm" c="dimmed">
        Předdefinované datasety (bez vlastního SQL).
      </Text>
      <Select label="Dataset" data={DATA_OPTIONS} value={dataset} onChange={(v) => setDataset(v ?? DATASET_IDS[0]!)} size="xs" />
      <TextInput label="Textové zúžení (volitelně)" value={narrow} onChange={(e) => setNarrow(e.currentTarget.value)} size="xs" />
      <NumberInput label="Limit řádků" value={limit} onChange={(v) => setLimit(typeof v === "number" ? v : 80)} min={1} max={200} size="xs" />
      <Button size="xs" onClick={() => void run()} loading={loading}>
        Spustit dotaz
      </Button>
      {err ? (
        <Text size="sm" c="red">
          {err}
        </Text>
      ) : null}
      {source ? (
        <Text size="xs" c="dimmed">
          {source}
        </Text>
      ) : null}
      <ScrollArea.Autosize mah={320} type="auto">
        <div style={{ overflow: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
            <thead>
              <tr>
                {keys.map((k) => (
                  <th key={k} style={{ textAlign: "left", padding: 6, borderBottom: "1px solid #e2e8f0" }}>
                    {k}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, ri) => (
                <tr key={ri}>
                  {keys.map((k) => (
                    <td key={k} style={{ padding: 6, borderBottom: "1px solid #f1f5f9", maxWidth: 140, overflow: "hidden", textOverflow: "ellipsis" }}>
                      {row[k] == null ? "—" : String(row[k])}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </ScrollArea.Autosize>
    </Stack>
  );
}

export function MarketSidebarPanel({ getAccessToken }: { getAccessToken: () => Promise<string | null> }) {
  const [location, setLocation] = useState("Praha");
  const [sources, setSources] = useState<string[]>(["sreality", "bezrealitky"]);
  const [perPage, setPerPage] = useState(24);
  const [params, setParams] = useState<FetchMarketListingsInput | null>(null);

  function search() {
    const src = (sources.length ? sources : ["sreality"]) as ("sreality" | "bezrealitky")[];
    setParams({
      location: location.trim() || "Česko",
      sources: src,
      page: 1,
      perPage,
      srealityOfferKind: "prodej"
    });
  }

  return (
    <Stack gap="sm">
      <Text size="sm" c="dimmed">
        Rychlé stažení nabídek (stejné API jako agent).
      </Text>
      <TextInput label="Lokalita" value={location} onChange={(e) => setLocation(e.currentTarget.value)} size="xs" />
      <MultiSelect
        label="Portály"
        data={[
          { value: "sreality", label: "Sreality" },
          { value: "bezrealitky", label: "Bezrealitky" }
        ]}
        value={sources}
        onChange={setSources}
        size="xs"
      />
      <NumberInput label="Počet" value={perPage} onChange={(v) => setPerPage(typeof v === "number" ? v : 24)} min={6} max={60} size="xs" />
      <Button size="xs" onClick={search}>
        Načíst nabídky
      </Button>
      {params ? (
        <MarketListingsDataPanelSection
          title={`Nabídky · ${params.location}`}
          fetchParams={params as Record<string, unknown>}
          initialListings={[]}
          getAccessToken={getAccessToken}
        />
      ) : null}
    </Stack>
  );
}

export function VizPanel(props: {
  lastAgentAnswer: AgentAnswer | null;
  conversationId: string | null;
  getAccessToken: () => Promise<string | null>;
  onNavigateConversation: (conversationId: string, runId?: string | null) => void;
}) {
  const { lastAgentAnswer, conversationId, getAccessToken, onNavigateConversation } = props;

  const bundles =
    lastAgentAnswer?.dataPanelBundles && lastAgentAnswer.dataPanelBundles.length > 0
      ? lastAgentAnswer.dataPanelBundles
      : lastAgentAnswer?.dataPanel
        ? [
            {
              dataPanel: lastAgentAnswer.dataPanel,
              dataPanelDownloads: lastAgentAnswer.dataPanelDownloads
            }
          ]
        : [];

  if (!lastAgentAnswer || bundles.length === 0) {
    return (
      <Text size="sm" c="dimmed">
        Tabulka nebo graf se zde objeví po posledním běhu agenta s datovým panelem. Použijte středový chat nebo sekci Data.
      </Text>
    );
  }

  return (
    <Stack gap="sm">
      {lastAgentAnswer.runId && conversationId ? (
        <Button
          size="xs"
          variant="light"
          onClick={() => onNavigateConversation(conversationId, lastAgentAnswer.runId ?? null)}
        >
          Přejít na odpověď v chatu
        </Button>
      ) : null}
      {bundles.map((bundle, bi) => (
        <AgentDataPanel
          key={`${lastAgentAnswer.runId ?? "run"}-viz-${bi}`}
          panel={bundle.dataPanel}
          getAccessToken={getAccessToken}
          dataPanelDownloads={bundle.dataPanelDownloads}
        />
      ))}
    </Stack>
  );
}
