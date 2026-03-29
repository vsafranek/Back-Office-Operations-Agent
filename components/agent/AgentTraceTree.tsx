"use client";

import { Box, Loader, Text } from "@mantine/core";
import { useCallback, useEffect, useState, type CSSProperties } from "react";
import type { AgentTraceEventRow } from "@/lib/agent/trace/types";

type Props = {
  runId: string;
  getAccessToken: () => Promise<string | null>;
  /**
   * `standalone` — tlačítko Zobrazit/skrýt (výchozí).
   * `embedded` — bez vnějšího tlačítka, načte trace po vykreslení (např. uvnitř bubliny).
   */
  variant?: "standalone" | "embedded";
  /**
   * `flat` (výchozí) — větve stromu jsou vždy vidět, rozkliknutí jen vstup/výstup uzlu; prvky do hloubky 2 startují rozbalené.
   * `nested` — uzly začínají sbalené (jen řádek kroku); rozkliknutím se ukáže detail i poduzly.
   */
  structureMode?: "flat" | "nested";
};

function kindStyle(kind: string): CSSProperties {
  const base: CSSProperties = {
    fontSize: 11,
    fontWeight: 700,
    textTransform: "uppercase",
    padding: "2px 6px",
    borderRadius: 4,
    marginRight: 8
  };
  switch (kind) {
    case "llm":
      return { ...base, background: "#dbeafe", color: "#1e3a5f" };
    case "tool":
      return { ...base, background: "#dcfce7", color: "#14532d" };
    case "subagent":
      return { ...base, background: "#fef3c7", color: "#78350f" };
    default:
      return { ...base, background: "#e2e8f0", color: "#334155" };
  }
}

function TraceNode({
  node,
  byParent,
  depth,
  structureMode
}: {
  node: AgentTraceEventRow;
  byParent: Map<string | null, AgentTraceEventRow[]>;
  depth: number;
  structureMode: "flat" | "nested";
}) {
  const nested = structureMode === "nested";
  const [open, setOpen] = useState(() => (nested ? false : depth < 2));
  const children = byParent.get(node.id) ?? [];

  const showPayloadBlock = open;
  const showChildList = nested ? open && children.length > 0 : children.length > 0;

  return (
    <li style={{ listStyle: "none", margin: "4px 0" }}>
      <div
        style={{
          marginLeft: depth * 14,
          borderLeft: depth ? "2px solid #cbd5e1" : undefined,
          paddingLeft: depth ? 8 : 0
        }}
      >
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          style={{
            display: "flex",
            flexWrap: "wrap",
            alignItems: "center",
            gap: 6,
            background: "transparent",
            border: "none",
            cursor: "pointer",
            padding: "4px 0",
            textAlign: "left",
            width: "100%"
          }}
        >
          <span style={{ fontFamily: "monospace", fontSize: 12, color: "#64748b" }}>
            {open ? "▼" : "▶"} #{node.step_index}
          </span>
          <span style={kindStyle(node.kind)}>{node.kind}</span>
          <strong style={{ fontSize: 14 }}>{node.name}</strong>
          {node.status === "error" ? (
            <span style={{ color: "crimson", fontSize: 12 }}>error</span>
          ) : null}
          {node.duration_ms != null ? (
            <span style={{ color: "#64748b", fontSize: 12 }}>{node.duration_ms} ms</span>
          ) : null}
        </button>
        {showPayloadBlock ? (
          <div style={{ marginTop: 6, marginBottom: 10 }}>
            {node.input_payload != null ? (
              <div style={{ marginBottom: 8 }}>
                <div style={{ fontWeight: 600, fontSize: 12, marginBottom: 4 }}>Vstup</div>
                <pre
                  style={{
                    margin: 0,
                    fontSize: 11,
                    whiteSpace: "pre-wrap",
                    background: "#f8fafc",
                    padding: 8,
                    borderRadius: 6,
                    maxHeight: 240,
                    overflow: "auto"
                  }}
                >
                  {JSON.stringify(node.input_payload, null, 2)}
                </pre>
              </div>
            ) : null}
            {node.output_payload != null ? (
              <div style={{ marginBottom: 8 }}>
                <div style={{ fontWeight: 600, fontSize: 12, marginBottom: 4 }}>Výstup</div>
                <pre
                  style={{
                    margin: 0,
                    fontSize: 11,
                    whiteSpace: "pre-wrap",
                    background: "#f8fafc",
                    padding: 8,
                    borderRadius: 6,
                    maxHeight: 280,
                    overflow: "auto"
                  }}
                >
                  {JSON.stringify(node.output_payload, null, 2)}
                </pre>
              </div>
            ) : null}
            {node.error_message ? (
              <p style={{ color: "crimson", fontSize: 13, margin: 0 }}>{node.error_message}</p>
            ) : null}
          </div>
        ) : null}
        {showChildList ? (
          <ul style={{ paddingLeft: 0, margin: 0 }}>
            {children.map((c) => (
              <TraceNode key={c.id} node={c} byParent={byParent} depth={depth + 1} structureMode={structureMode} />
            ))}
          </ul>
        ) : null}
      </div>
    </li>
  );
}

export function AgentTraceTree({
  runId,
  getAccessToken,
  variant = "standalone",
  structureMode = "flat"
}: Props) {
  const [events, setEvents] = useState<AgentTraceEventRow[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setErr(null);
    const token = await getAccessToken();
    if (!token) {
      setErr("Chybí přihlášení.");
      setLoading(false);
      return;
    }
    const res = await fetch(`/api/agent/trace?runId=${encodeURIComponent(runId)}`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    const data = (await res.json()) as { events?: AgentTraceEventRow[]; error?: string };
    setLoading(false);
    if (!res.ok) {
      setErr(data.error ?? "Nepodařilo se načíst trace.");
      return;
    }
    setEvents(data.events ?? []);
  }, [getAccessToken, runId]);

  const byParent = new Map<string | null, AgentTraceEventRow[]>();
  for (const e of events ?? []) {
    const key = e.parent_id;
    const list = byParent.get(key) ?? [];
    list.push(e);
    byParent.set(key, list);
  }
  for (const list of byParent.values()) {
    list.sort((a, b) => a.step_index - b.step_index);
  }
  const roots = byParent.get(null) ?? [];

  useEffect(() => {
    if (variant !== "embedded") return;
    void load();
  }, [variant, load]);

  const toggle = () => {
    if (!expanded) {
      setExpanded(true);
      void load();
    } else {
      setExpanded(false);
      setEvents(null);
      setErr(null);
    }
  };

  const body = (
    <>
      {loading && events == null ? (
        <Box py="xs">
          <Loader size="sm" type="dots" />
          <Text size="xs" c="dimmed" mt="xs">
            Načítám trace…
          </Text>
        </Box>
      ) : null}
      {err ? (
        <Text size="sm" c="red">
          {err}
        </Text>
      ) : null}
      {events && events.length === 0 ? (
        <Text size="sm" c="dimmed">
          Žádné záznamy trace.
        </Text>
      ) : null}
      {events && events.length > 0 ? (
        <ul style={{ paddingLeft: 0, margin: "8px 0 0" }}>
          {roots.map((r) => (
            <TraceNode key={r.id} node={r} byParent={byParent} depth={0} structureMode={structureMode} />
          ))}
        </ul>
      ) : null}
    </>
  );

  if (variant === "embedded") {
    return <div>{body}</div>;
  }

  return (
    <div style={{ marginTop: 8 }}>
      <button type="button" onClick={toggle}>
        {expanded ? "Skrýt strom agent ↔ nástroje" : "Zobrazit strom agent ↔ nástroje"}{" "}
        <span style={{ fontFamily: "monospace", fontSize: 12 }}>({runId.slice(0, 8)}…)</span>
      </button>
      {expanded ? <div style={{ marginTop: 8 }}>{body}</div> : null}
    </div>
  );
}
