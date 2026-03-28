"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { AgentTraceTree } from "@/components/agent/AgentTraceTree";
import { ConfigurableAgentPanel } from "@/components/agent/ConfigurableAgentPanel";
import { DEFAULT_AGENT_ID, listAgentUiOptions } from "@/lib/agent/config/agent-definitions";
import { readAgentNdjsonStream } from "@/lib/agent/stream-client";
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

export default function DashboardPage() {
  const supabase = useMemo(() => getSupabaseBrowserClient(), []);
  const router = useRouter();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ConversationMessage[]>([]);
  const [renaming, setRenaming] = useState(false);
  const [deleting, setDeleting] = useState(false);

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
        if (convs.length > 0) {
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

  async function renameActiveConversation() {
    if (!activeConversationId) return;
    const active = conversations.find((c) => c.id === activeConversationId);
    const currentTitle = active?.title ?? "Nova konverzace";
    const nextTitle = window.prompt("Novy nazev konverzace:", currentTitle);
    if (!nextTitle || nextTitle.trim() === "" || nextTitle.trim() === currentTitle) return;

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
      body: JSON.stringify({ title: nextTitle.trim() })
    });
    setRenaming(false);
    if (!response.ok) return;

    const updated = (await response.json()) as Conversation;
    setConversations((prev) => prev.map((c) => (c.id === updated.id ? updated : c)));
  }

  async function deleteActiveConversation() {
    if (!activeConversationId) return;
    const approved = window.confirm("Opravdu chces smazat tuto konverzaci?");
    if (!approved) return;

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

  async function logout() {
    await supabase.auth.signOut();
    router.push("/auth/login");
  }

  const activeConversationTitle = conversations.find((c) => c.id === activeConversationId)?.title;

  return (
    <main style={{ maxWidth: 1480, display: "grid", gridTemplateColumns: "280px 1fr", gap: 20 }}>
      <aside id="conversation-sidebar" aria-label="Seznam konverzací">
        <h2 id="conversation-sidebar-heading">Konverzace</h2>
        <button type="button" onClick={createConversation}>
          Nova konverzace
        </button>
        <div style={{ marginTop: 8, display: "grid", gap: 6 }}>
          <button type="button" onClick={renameActiveConversation} disabled={!activeConversationId || renaming}>
            {renaming ? "Přejmenovávám..." : "Přejmenovat aktivní"}
          </button>
          <button type="button" onClick={deleteActiveConversation} disabled={!activeConversationId || deleting}>
            {deleting ? "Mažu..." : "Smazat aktivní"}
          </button>
        </div>
        <ul style={{ paddingLeft: 18 }} aria-labelledby="conversation-sidebar-heading">
          {conversations.map((conv) => (
            <li key={conv.id}>
              <button
                type="button"
                id={`conversation-nav--${conv.id}`}
                style={{ fontWeight: activeConversationId === conv.id ? 700 : 400 }}
                aria-current={activeConversationId === conv.id ? "true" : undefined}
                data-conversation-id={conv.id}
                data-conversation-title={conv.title}
                onClick={() => setActiveConversationId(conv.id)}
              >
                {conv.title}
              </button>
            </li>
          ))}
        </ul>
      </aside>
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
      >
      <h1>Back Office Dashboard</h1>
      <p>
        <a href="/settings">Nastavení integrací</a>
      </p>
      <p>
        <a href="/storage">Storage browser</a>
      </p>
      <button onClick={logout} type="button">
        Odhlásit se
      </button>
      <ConfigurableAgentPanel
        key={activeConversationId ?? "new"}
        agents={listAgentUiOptions()}
        defaultAgentId={DEFAULT_AGENT_ID}
        conversationContext={{
          id: activeConversationId,
          title: activeConversationTitle
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
      <section
        id={
          activeConversationId
            ? `conversation-history--conv--${activeConversationId}`
            : "conversation-history--empty"
        }
        style={{ marginTop: 16 }}
        aria-label={
          activeConversationTitle
            ? `Historie zpráv konverzace: ${activeConversationTitle}`
            : "Historie zpráv"
        }
        data-conversation-id={activeConversationId ?? undefined}
        data-conversation-title={activeConversationTitle}
      >
        <h2 id={activeConversationId ? `history-heading--${activeConversationId}` : "history-heading-empty"}>
          Historie
        </h2>
        {messages.length === 0 ? <p>Zatim bez zpráv v této konverzaci.</p> : null}
        <ul
          style={{ paddingLeft: 18, listStyle: "none" }}
          aria-labelledby={
            activeConversationId ? `history-heading--${activeConversationId}` : "history-heading-empty"
          }
        >
          {messages.map((msg) => {
            const meta = msg.metadata as { runId?: string };
            const traceRunId = typeof meta?.runId === "string" ? meta.runId : undefined;
            return (
              <li
                key={msg.id}
                id={`chat-message--conv--${activeConversationId ?? "none"}--msg--${msg.id}`}
                style={{ marginBottom: 12 }}
                data-message-id={msg.id}
                data-conversation-id={activeConversationId ?? undefined}
                data-role={msg.role}
              >
                <div>
                  <strong>{msg.role}:</strong> {msg.content}
                </div>
                {msg.role === "assistant" && traceRunId ? (
                  <AgentTraceTree
                    key={`${msg.id}-${traceRunId}`}
                    runId={traceRunId}
                    getAccessToken={async () => {
                      const sessionResult = await supabase.auth.getSession();
                      return sessionResult.data.session?.access_token ?? null;
                    }}
                  />
                ) : null}
              </li>
            );
          })}
        </ul>
      </section>
      </section>
    </main>
  );
}
