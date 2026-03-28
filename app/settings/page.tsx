"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser-client";

type FormState = {
  calendar_provider: "google" | "microsoft";
  calendar_account_email: string;
  calendar_id: string;
  mail_provider: "gmail" | "outlook";
  mail_from_email: string;
  has_google_tokens: boolean;
  has_microsoft_tokens: boolean;
};

type ScheduledTaskRow = {
  id: string;
  title: string;
  cron_expression: string;
  timezone: string;
  system_prompt: string;
  user_question: string;
  agent_id: string;
  enabled: boolean;
  last_run_at: string | null;
  created_at: string;
  updated_at: string;
};

const initialState: FormState = {
  calendar_provider: "google",
  calendar_account_email: "",
  calendar_id: "primary",
  mail_provider: "gmail",
  mail_from_email: "",
  has_google_tokens: false,
  has_microsoft_tokens: false
};

async function fetchOAuthUrl(path: string, bearer: string): Promise<string> {
  const res = await fetch(path, { headers: { Authorization: `Bearer ${bearer}` } });
  const data = (await res.json()) as { url?: string; error?: string };
  if (!res.ok) {
    throw new Error(data.error ?? `Chyba ${res.status}`);
  }
  if (!data.url) {
    throw new Error("Server nevrátil OAuth URL.");
  }
  return data.url;
}

export default function SettingsPage() {
  const supabase = useMemo(() => getSupabaseBrowserClient(), []);
  const router = useRouter();
  const [form, setForm] = useState<FormState>(initialState);
  const [loading, setLoading] = useState(false);
  const [connecting, setConnecting] = useState<"google" | "microsoft" | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [disconnecting, setDisconnecting] = useState<"google" | "microsoft" | null>(null);
  const [passNew, setPassNew] = useState("");
  const [passNew2, setPassNew2] = useState("");
  const [passLoading, setPassLoading] = useState(false);
  const [passMessage, setPassMessage] = useState<string | null>(null);

  const [scheduledTasks, setScheduledTasks] = useState<ScheduledTaskRow[]>([]);
  const [schedLoading, setSchedLoading] = useState(false);
  const [schedSaving, setSchedSaving] = useState(false);
  const [schedMessage, setSchedMessage] = useState<string | null>(null);
  const [schedForm, setSchedForm] = useState({
    title: "",
    cron_expression: "0 8 * * *",
    timezone: "Europe/Prague",
    system_prompt: "",
    user_question: "Splň naplánovanou úlohu podle systémového zadání.",
    agent_id: "basic" as "basic" | "thinking-orchestrator"
  });

  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const oauth = params.get("oauth");
    const provider = params.get("provider");
    const reason = params.get("reason");
    if (oauth === "ok" && provider) {
      setMessage(`Účet ${provider === "google" ? "Google" : "Microsoft 365"} byl připojen.`);
      router.replace("/settings", { scroll: false });
    } else if (oauth === "error") {
      setMessage(`Propojení selhalo${reason ? `: ${decodeURIComponent(reason)}` : ""}.`);
      router.replace("/settings", { scroll: false });
    }
  }, [router]);

  useEffect(() => {
    void (async () => {
      const sessionResult = await supabase.auth.getSession();
      const accessToken = sessionResult.data.session?.access_token;
      if (!accessToken) {
        router.replace("/auth/login");
        return;
      }

      void fetch("/api/auth/sync-account", {
        method: "POST",
        headers: { Authorization: `Bearer ${accessToken}` }
      }).catch(() => {});

      const [integrationsRes, tasksRes] = await Promise.all([
        fetch("/api/settings/integrations", {
          headers: { Authorization: `Bearer ${accessToken}` }
        }),
        fetch("/api/settings/scheduled-tasks", {
          headers: { Authorization: `Bearer ${accessToken}` }
        })
      ]);

      if (integrationsRes.ok) {
        const data = await integrationsRes.json();
        if (data) {
          setForm({
            calendar_provider: data.calendar_provider === "microsoft" ? "microsoft" : "google",
            calendar_account_email: data.calendar_account_email ?? "",
            calendar_id: data.calendar_id ?? "primary",
            mail_provider: data.mail_provider === "outlook" ? "outlook" : "gmail",
            mail_from_email: data.mail_from_email ?? "",
            has_google_tokens: Boolean(data.has_google_tokens),
            has_microsoft_tokens: Boolean(data.has_microsoft_tokens)
          });
        }
      }

      if (tasksRes.ok) {
        const payload = (await tasksRes.json()) as { tasks?: ScheduledTaskRow[] };
        setScheduledTasks(payload.tasks ?? []);
      }
    })();
  }, [router, supabase.auth]);

  async function saveSettings(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setMessage(null);
    const sessionResult = await supabase.auth.getSession();
    const accessToken = sessionResult.data.session?.access_token;
    if (!accessToken) {
      router.push("/auth/login");
      return;
    }

    const response = await fetch("/api/settings/integrations", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`
      },
      body: JSON.stringify({
        calendar_provider: form.calendar_provider,
        calendar_account_email: form.calendar_account_email,
        calendar_id: form.calendar_id,
        mail_provider: form.mail_provider,
        mail_from_email: form.mail_from_email
      })
    });
    const payload = await response.json();
    setLoading(false);
    setMessage(response.ok ? "Nastavení uloženo." : payload.error ?? "Uložení selhalo.");
  }

  async function startGoogleConnect() {
    setConnecting("google");
    setMessage(null);
    try {
      const sessionResult = await supabase.auth.getSession();
      const accessToken = sessionResult.data.session?.access_token;
      if (!accessToken) {
        router.push("/auth/login");
        return;
      }
      const url = await fetchOAuthUrl("/api/integrations/oauth/google/authorize", accessToken);
      window.location.href = url;
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Google OAuth selhalo.");
      setConnecting(null);
    }
  }

  async function startMicrosoftConnect() {
    setConnecting("microsoft");
    setMessage(null);
    try {
      const sessionResult = await supabase.auth.getSession();
      const accessToken = sessionResult.data.session?.access_token;
      if (!accessToken) {
        router.push("/auth/login");
        return;
      }
      const url = await fetchOAuthUrl("/api/integrations/oauth/microsoft/authorize", accessToken);
      window.location.href = url;
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Microsoft OAuth selhalo.");
      setConnecting(null);
    }
  }

  async function disconnect(provider: "google" | "microsoft") {
    setDisconnecting(provider);
    setMessage(null);
    const sessionResult = await supabase.auth.getSession();
    const accessToken = sessionResult.data.session?.access_token;
    if (!accessToken) {
      router.push("/auth/login");
      return;
    }

    const response = await fetch(`/api/settings/integrations?provider=${provider}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${accessToken}` }
    });
    const payload = await response.json();
    setDisconnecting(null);
    if (!response.ok) {
      setMessage(payload.error ?? "Odpojení selhalo.");
      return;
    }
    if (provider === "google") {
      setForm((f) => ({ ...f, has_google_tokens: false }));
    } else {
      setForm((f) => ({ ...f, has_microsoft_tokens: false }));
    }
    setMessage(provider === "google" ? "Google účet odpojen." : "Microsoft 365 odpojeno.");
  }

  async function refreshScheduledTasks(accessToken: string) {
    const res = await fetch("/api/settings/scheduled-tasks", {
      headers: { Authorization: `Bearer ${accessToken}` }
    });
    if (!res.ok) return;
    const payload = (await res.json()) as { tasks?: ScheduledTaskRow[] };
    setScheduledTasks(payload.tasks ?? []);
  }

  async function saveScheduledTask(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSchedMessage(null);
    if (!schedForm.title.trim() || !schedForm.system_prompt.trim()) {
      setSchedMessage("Vyplňte název a systémové zadání.");
      return;
    }
    setSchedSaving(true);
    const sessionResult = await supabase.auth.getSession();
    const accessToken = sessionResult.data.session?.access_token;
    if (!accessToken) {
      router.push("/auth/login");
      setSchedSaving(false);
      return;
    }
    const res = await fetch("/api/settings/scheduled-tasks", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`
      },
      body: JSON.stringify({
        title: schedForm.title.trim(),
        cron_expression: schedForm.cron_expression.trim(),
        timezone: schedForm.timezone.trim(),
        system_prompt: schedForm.system_prompt.trim(),
        user_question: schedForm.user_question.trim(),
        agent_id: schedForm.agent_id,
        enabled: true
      })
    });
    const payload = (await res.json()) as { error?: string };
    setSchedSaving(false);
    if (!res.ok) {
      setSchedMessage(payload.error ?? "Uložení úlohy selhalo.");
      return;
    }
    setSchedMessage("Naplánovaná úloha byla vytvořena.");
    setSchedForm((f) => ({
      ...f,
      title: "",
      system_prompt: "",
      cron_expression: "0 8 * * *",
      user_question: "Splň naplánovanou úlohu podle systémového zadání."
    }));
    await refreshScheduledTasks(accessToken);
  }

  async function toggleScheduledTask(task: ScheduledTaskRow, enabled: boolean) {
    const sessionResult = await supabase.auth.getSession();
    const accessToken = sessionResult.data.session?.access_token;
    if (!accessToken) return;
    setSchedLoading(true);
    setSchedMessage(null);
    const res = await fetch(`/api/settings/scheduled-tasks/${task.id}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`
      },
      body: JSON.stringify({ enabled })
    });
    setSchedLoading(false);
    const payload = (await res.json()) as { error?: string };
    if (!res.ok) {
      setSchedMessage(payload.error ?? "Úprava selhala.");
      return;
    }
    await refreshScheduledTasks(accessToken);
  }

  async function deleteScheduledTask(id: string) {
    if (!confirm("Opravdu smazat tuto naplánovanou úlohu?")) return;
    const sessionResult = await supabase.auth.getSession();
    const accessToken = sessionResult.data.session?.access_token;
    if (!accessToken) return;
    setSchedLoading(true);
    setSchedMessage(null);
    const res = await fetch(`/api/settings/scheduled-tasks/${id}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${accessToken}` }
    });
    setSchedLoading(false);
    const payload = (await res.json()) as { error?: string };
    if (!res.ok) {
      setSchedMessage(payload.error ?? "Smazání selhalo.");
      return;
    }
    setSchedMessage("Úloha byla smazána.");
    await refreshScheduledTasks(accessToken);
  }

  async function handleSetPassword(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPassMessage(null);
    if (passNew.length < 8) {
      setPassMessage("Heslo musí mít alespoň 8 znaků.");
      return;
    }
    if (passNew !== passNew2) {
      setPassMessage("Hesla se neshodují.");
      return;
    }
    setPassLoading(true);
    const { error } = await supabase.auth.updateUser({ password: passNew });
    setPassLoading(false);
    if (error) {
      setPassMessage(error.message);
      return;
    }
    setPassNew("");
    setPassNew2("");
    setPassMessage("Heslo bylo nastaveno. Můžete se přihlásit e-mailem na /auth/login.");
  }

  return (
    <main style={{ maxWidth: 760 }}>
      <h1>Nastavení integrací</h1>
      <p>
        Přihlášení do aplikace je nezávislé na poště a kalendáři. Kalendář a e-mail používáte až po připojení účtu níže
        (jako v n8n).
      </p>
      <p>
        <a href="/dashboard">Zpět na dashboard</a>
      </p>

      <section style={{ marginBottom: 28, padding: 16, border: "1px solid #e2e8f0", borderRadius: 10 }}>
        <h2 style={{ marginTop: 0, fontSize: 18 }}>Připojené účty</h2>
        <div style={{ display: "grid", gap: 12 }}>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 10, alignItems: "center" }}>
            <span>
              Google (kalendář + Gmail): <strong>{form.has_google_tokens ? "připojeno" : "nepřipojeno"}</strong>
            </span>
            <button type="button" onClick={() => void startGoogleConnect()} disabled={connecting !== null}>
              {connecting === "google" ? "Přesměrovávám…" : "Připojit Google"}
            </button>
            <button
              type="button"
              onClick={() => void disconnect("google")}
              disabled={disconnecting !== null || !form.has_google_tokens}
            >
              {disconnecting === "google" ? "Odpojuji…" : "Odpojit Google"}
            </button>
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 10, alignItems: "center" }}>
            <span>
              Microsoft 365 (Outlook + kalendář):{" "}
              <strong>{form.has_microsoft_tokens ? "připojeno" : "nepřipojeno"}</strong>
            </span>
            <button type="button" onClick={() => void startMicrosoftConnect()} disabled={connecting !== null}>
              {connecting === "microsoft" ? "Přesměrovávám…" : "Připojit Microsoft 365"}
            </button>
            <button
              type="button"
              onClick={() => void disconnect("microsoft")}
              disabled={disconnecting !== null || !form.has_microsoft_tokens}
            >
              {disconnecting === "microsoft" ? "Odpojuji…" : "Odpojit Microsoft"}
            </button>
          </div>
        </div>
      </section>

      <form onSubmit={saveSettings} style={{ display: "grid", gap: 12 }}>
        <h2 style={{ margin: 0, fontSize: 18 }}>Který účet použít</h2>
        <p style={{ margin: 0, fontSize: 14, color: "#64748b" }}>
          Vyberte poskytovatele pro nástroje agenta. Musíte mít připojené tokeny pro danou volbu.
        </p>
        <label style={{ display: "grid", gap: 6 }}>
          <span>Kalendář (free/busy)</span>
          <select
            value={form.calendar_provider}
            onChange={(e) =>
              setForm({ ...form, calendar_provider: e.target.value as "google" | "microsoft" })
            }
          >
            <option value="google">Google Calendar</option>
            <option value="microsoft">Microsoft (Outlook kalendář)</option>
          </select>
        </label>
        <label style={{ display: "grid", gap: 6 }}>
          <span>Účet kalendáře (e-mail / SMTP adresa)</span>
          <input
            type="email"
            value={form.calendar_account_email}
            onChange={(e) => setForm({ ...form, calendar_account_email: e.target.value })}
            placeholder="např. jmeno@firma.cz"
          />
        </label>
        <label style={{ display: "grid", gap: 6 }}>
          <span>Calendar ID (Google: často primary)</span>
          <input
            value={form.calendar_id}
            onChange={(e) => setForm({ ...form, calendar_id: e.target.value })}
          />
        </label>
        <label style={{ display: "grid", gap: 6 }}>
          <span>Pošta (draft / odeslání / inbox)</span>
          <select
            value={form.mail_provider}
            onChange={(e) => setForm({ ...form, mail_provider: e.target.value as "gmail" | "outlook" })}
          >
            <option value="gmail">Gmail</option>
            <option value="outlook">Outlook (Microsoft 365)</option>
          </select>
        </label>
        <label style={{ display: "grid", gap: 6 }}>
          <span>Odesílatel (zobrazovaný / výchozí mailbox)</span>
          <input
            type="email"
            value={form.mail_from_email}
            onChange={(e) => setForm({ ...form, mail_from_email: e.target.value })}
            placeholder="Volitelné"
          />
        </label>
        <button type="submit" disabled={loading}>
          {loading ? "Ukládám…" : "Uložit volby"}
        </button>
      </form>

      <section style={{ marginTop: 28, padding: 16, border: "1px solid #ddd6fe", borderRadius: 10, background: "#faf5ff" }}>
        <h2 style={{ marginTop: 0, fontSize: 18, color: "#5b21b6" }}>Naplánované úlohy agenta (cron)</h2>
        <p style={{ margin: "0 0 12px", fontSize: 14, color: "#5b21b6" }}>
          Zde nastavíte opakované spouštění agenta: cron výraz ve formátu <strong>pg_cron</strong> (5 polí: minuta, hodina, den v
          měsíci, měsíc, den v týdnu), časová zóna, systémové zadání pro každý běh a text dotazu při každém běhu. Úlohu lze také
          navrhnout v chatu s agentem — po zobrazení panelu vpravo ji potvrdíte.
        </p>
        <p style={{ margin: "0 0 16px", fontSize: 13, color: "#6b21a8" }}>
          Na Supabase zapněte rozšíření <code>pg_cron</code> a (pro HTTP volání) <code>pg_net</code>. Aplikace sama cron nezakládá —
          musíte zavolat <code>POST /api/cron/scheduled-agent-tasks</code> s hlavičkou <code>x-cron-secret</code> (hodnota env{" "}
          <code>CRON_SECRET</code>), stejně jako u ostatních cron tras v projektu.
        </p>

        <h3 style={{ fontSize: 16, margin: "16px 0 8px" }}>Vaše úlohy</h3>
        {scheduledTasks.length === 0 ? (
          <p style={{ margin: "0 0 12px", fontSize: 14, color: "#64748b" }}>Zatím žádná uložená úloha.</p>
        ) : (
          <ul style={{ margin: "0 0 16px", paddingLeft: 20, fontSize: 14 }}>
            {scheduledTasks.map((t) => (
              <li key={t.id} style={{ marginBottom: 10 }}>
                <strong>{t.title}</strong> — <code>{t.cron_expression}</code> ({t.timezone}) · profil {t.agent_id}
                {t.last_run_at ? (
                  <span style={{ color: "#64748b" }}>
                    {" "}
                    · poslední běh {new Date(t.last_run_at).toLocaleString("cs-CZ")}
                  </span>
                ) : null}
                <div style={{ marginTop: 6, display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
                  <label style={{ display: "inline-flex", gap: 6, alignItems: "center", fontSize: 13 }}>
                    <input
                      type="checkbox"
                      checked={t.enabled}
                      disabled={schedLoading}
                      onChange={(e) => void toggleScheduledTask(t, e.target.checked)}
                    />
                    Zapnuto
                  </label>
                  <button type="button" disabled={schedLoading} onClick={() => void deleteScheduledTask(t.id)}>
                    Smazat
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}

        <h3 style={{ fontSize: 16, margin: "16px 0 8px" }}>Nová úloha</h3>
        <form onSubmit={(e) => void saveScheduledTask(e)} style={{ display: "grid", gap: 10, maxWidth: 640 }}>
          <label style={{ display: "grid", gap: 4 }}>
            <span>Název</span>
            <input
              value={schedForm.title}
              onChange={(e) => setSchedForm({ ...schedForm, title: e.target.value })}
              placeholder="např. Ranní monitoring nabídek"
            />
          </label>
          <label style={{ display: "grid", gap: 4 }}>
            <span>Cron (5 polí, jako v pg_cron)</span>
            <input
              value={schedForm.cron_expression}
              onChange={(e) => setSchedForm({ ...schedForm, cron_expression: e.target.value })}
              placeholder="0 8 * * *"
            />
          </label>
          <label style={{ display: "grid", gap: 4 }}>
            <span>Časová zóna (IANA)</span>
            <input
              value={schedForm.timezone}
              onChange={(e) => setSchedForm({ ...schedForm, timezone: e.target.value })}
            />
          </label>
          <label style={{ display: "grid", gap: 4 }}>
            <span>Systémové zadání (prompt pro každý běh)</span>
            <textarea
              rows={6}
              value={schedForm.system_prompt}
              onChange={(e) => setSchedForm({ ...schedForm, system_prompt: e.target.value })}
              placeholder="Instrukce pro agenta: role, co má hlídat, formát výstupu…"
            />
          </label>
          <label style={{ display: "grid", gap: 4 }}>
            <span>Dotaz při každém běhu</span>
            <textarea
              rows={3}
              value={schedForm.user_question}
              onChange={(e) => setSchedForm({ ...schedForm, user_question: e.target.value })}
            />
          </label>
          <label style={{ display: "grid", gap: 4 }}>
            <span>Profil agenta</span>
            <select
              value={schedForm.agent_id}
              onChange={(e) =>
                setSchedForm({
                  ...schedForm,
                  agent_id: e.target.value as "basic" | "thinking-orchestrator"
                })
              }
            >
              <option value="basic">basic</option>
              <option value="thinking-orchestrator">thinking-orchestrator</option>
            </select>
          </label>
          <button type="submit" disabled={schedSaving}>
            {schedSaving ? "Ukládám…" : "Vytvořit úlohu"}
          </button>
        </form>

        {schedMessage ? (
          <p role="status" style={{ marginTop: 12 }}>
            {schedMessage}
          </p>
        ) : null}

        <details style={{ marginTop: 20 }}>
          <summary style={{ cursor: "pointer", fontWeight: 600 }}>Příklad: pg_cron + pg_net (Supabase SQL)</summary>
          <pre
            style={{
              marginTop: 10,
              padding: 12,
              background: "#1e1b4b",
              color: "#e9d5ff",
              borderRadius: 8,
              fontSize: 12,
              overflow: "auto",
              maxWidth: "100%"
            }}
          >
            {`-- Nahraďte URL a tajemství (v Vault / secrets, ne v repu).
select cron.schedule(
  'backoffice_scheduled_agent_tasks',
  '*/10 * * * *',
  $$
  select net.http_post(
    url := 'https://VASE_DOMENA/api/cron/scheduled-agent-tasks',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', 'VASE_CRON_SECRET'
    ),
    body := '{}'::jsonb
  );
  $$
);`}
          </pre>
        </details>
      </section>

      <section style={{ marginTop: 28, padding: 16, border: "1px solid #e2e8f0", borderRadius: 10 }}>
        <h2 style={{ marginTop: 0, fontSize: 18 }}>Heslo pro přihlášení e-mailem</h2>
        <p style={{ margin: "0 0 12px", fontSize: 14, color: "#64748b" }}>
          Doplní nebo změní heslo k tomuto účtu (včetně účtů založených přes Google). Zapomenuté heslo:{" "}
          <a href="/auth/forgot-password">obnova e-mailem</a>.
        </p>
        <form onSubmit={handleSetPassword} style={{ display: "grid", gap: 10, maxWidth: 400 }}>
          <input
            type="password"
            value={passNew}
            onChange={(e) => setPassNew(e.target.value)}
            placeholder="Nové heslo (min. 8 znaků)"
            minLength={8}
            autoComplete="new-password"
          />
          <input
            type="password"
            value={passNew2}
            onChange={(e) => setPassNew2(e.target.value)}
            placeholder="Nové heslo znovu"
            minLength={8}
            autoComplete="new-password"
          />
          <button type="submit" disabled={passLoading}>
            {passLoading ? "Ukládám…" : "Nastavit / změnit heslo"}
          </button>
        </form>
        {passMessage ? <p role="status">{passMessage}</p> : null}
      </section>

      {message ? <p role="status">{message}</p> : null}
    </main>
  );
}
