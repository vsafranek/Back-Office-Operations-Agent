"use client";

import {
  Accordion,
  Alert,
  Anchor,
  Button,
  Card,
  Checkbox,
  Code,
  Divider,
  Group,
  Select,
  Stack,
  Text,
  Textarea,
  TextInput,
  Title
} from "@mantine/core";
import { modals } from "@mantine/modals";
import Link from "next/link";
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

  function deleteScheduledTask(id: string) {
    modals.openConfirmModal({
      title: "Smazat naplánovanou úlohu?",
      children: <Text size="sm">Tuto akci nelze vrátit zpět.</Text>,
      labels: { confirm: "Smazat", cancel: "Zrušit" },
      confirmProps: { color: "red" },
      onConfirm: async () => {
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
    });
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

  const cronExample = `-- Nahraďte URL a tajemství (v Vault / secrets, ne v repu).
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
);`;

  return (
    <Stack gap="xl" maw={800}>
      <div>
        <Title order={1}>Nastavení integrací</Title>
        <Text c="dimmed" mt="xs">
          Přihlášení do aplikace je nezávislé na poště a kalendáři. Kalendář a e-mail používáte až po připojení účtu níže
          (jako v n8n).
        </Text>
        <Anchor component={Link} href="/dashboard" size="sm" mt="sm" display="inline-block">
          Zpět na dashboard
        </Anchor>
      </div>

      {message ? (
        <Alert color="blue" title="Stav">
          {message}
        </Alert>
      ) : null}

      <Card withBorder padding="lg" radius="md">
        <Title order={3} mb="md">
          Připojené účty
        </Title>
        <Stack gap="md">
          <Group justify="space-between" align="flex-start" wrap="wrap" gap="sm">
            <Text size="sm">
              Google (kalendář + Gmail):{" "}
              <Text span fw={700}>
                {form.has_google_tokens ? "připojeno" : "nepřipojeno"}
              </Text>
            </Text>
            <Group gap="xs">
              <Button size="sm" onClick={() => void startGoogleConnect()} disabled={connecting !== null}>
                {connecting === "google" ? "Přesměrovávám…" : "Připojit Google"}
              </Button>
              <Button
                size="sm"
                variant="light"
                color="red"
                onClick={() => void disconnect("google")}
                disabled={disconnecting !== null || !form.has_google_tokens}
              >
                {disconnecting === "google" ? "Odpojuji…" : "Odpojit Google"}
              </Button>
            </Group>
          </Group>
          <Divider />
          <Group justify="space-between" align="flex-start" wrap="wrap" gap="sm">
            <Text size="sm">
              Microsoft 365 (Outlook + kalendář):{" "}
              <Text span fw={700}>
                {form.has_microsoft_tokens ? "připojeno" : "nepřipojeno"}
              </Text>
            </Text>
            <Group gap="xs">
              <Button size="sm" onClick={() => void startMicrosoftConnect()} disabled={connecting !== null}>
                {connecting === "microsoft" ? "Přesměrovávám…" : "Připojit Microsoft 365"}
              </Button>
              <Button
                size="sm"
                variant="light"
                color="red"
                onClick={() => void disconnect("microsoft")}
                disabled={disconnecting !== null || !form.has_microsoft_tokens}
              >
                {disconnecting === "microsoft" ? "Odpojuji…" : "Odpojit Microsoft"}
              </Button>
            </Group>
          </Group>
        </Stack>
      </Card>

      <Card withBorder padding="lg" radius="md">
        <Title order={3} mb="xs">
          Který účet použít
        </Title>
        <Text size="sm" c="dimmed" mb="md">
          Vyberte poskytovatele pro nástroje agenta. Musíte mít připojené tokeny pro danou volbu.
        </Text>
        <form onSubmit={saveSettings}>
          <Stack gap="md">
          <Select
            label="Kalendář (free/busy)"
            value={form.calendar_provider}
            onChange={(v) =>
              setForm({ ...form, calendar_provider: (v as "google" | "microsoft") ?? "google" })
            }
            data={[
              { value: "google", label: "Google Calendar" },
              { value: "microsoft", label: "Microsoft (Outlook kalendář)" }
            ]}
          />
          <TextInput
            label="Účet kalendáře (e-mail / SMTP adresa)"
            type="email"
            value={form.calendar_account_email}
            onChange={(e) => setForm({ ...form, calendar_account_email: e.currentTarget.value })}
            placeholder="např. jmeno@firma.cz"
          />
          <TextInput
            label="Calendar ID (Google: často primary)"
            value={form.calendar_id}
            onChange={(e) => setForm({ ...form, calendar_id: e.currentTarget.value })}
          />
          <Select
            label="Pošta (draft / odeslání / inbox)"
            value={form.mail_provider}
            onChange={(v) => setForm({ ...form, mail_provider: (v as "gmail" | "outlook") ?? "gmail" })}
            data={[
              { value: "gmail", label: "Gmail" },
              { value: "outlook", label: "Outlook (Microsoft 365)" }
            ]}
          />
          <TextInput
            label="Odesílatel (zobrazovaný / výchozí mailbox)"
            type="email"
            value={form.mail_from_email}
            onChange={(e) => setForm({ ...form, mail_from_email: e.currentTarget.value })}
            placeholder="Volitelné"
          />
          <Button type="submit" loading={loading}>
            {loading ? "Ukládám…" : "Uložit volby"}
          </Button>
          </Stack>
        </form>
      </Card>

      <Card withBorder padding="lg" radius="md" bg="violet.0">
        <Title order={3} c="violet.9" mb="xs">
          Naplánované úlohy agenta (cron)
        </Title>
        <Text size="sm" c="violet.9" mb="sm">
          Zde nastavíte opakované spouštění agenta: cron výraz ve formátu <strong>pg_cron</strong> (5 polí: minuta, hodina, den v
          měsíci, měsíc, den v týdnu), časová zóna, systémové zadání pro každý běh a text dotazu při každém běhu. Úlohu lze také
          navrhnout v chatu s agentem — po zobrazení panelu vpravo ji potvrdíte.
        </Text>
        <Text size="xs" c="violet.8" mb="lg">
          Na Supabase zapněte rozšíření <Code>pg_cron</Code> a (pro HTTP volání) <Code>pg_net</Code>. Aplikace sama cron nezakládá —
          musíte zavolat <Code>POST /api/cron/scheduled-agent-tasks</Code> s hlavičkou <Code>x-cron-secret</Code> (hodnota env{" "}
          <Code>CRON_SECRET</Code>), stejně jako u ostatních cron tras v projektu.
        </Text>

        <Title order={4} mb="sm">
          Vaše úlohy
        </Title>
        {scheduledTasks.length === 0 ? (
          <Text size="sm" c="dimmed" mb="md">
            Zatím žádná uložená úloha.
          </Text>
        ) : (
          <Stack gap="md" mb="lg">
            {scheduledTasks.map((t) => (
              <Card key={t.id} withBorder padding="sm" radius="sm" bg="white">
                <Text size="sm" fw={600}>
                  {t.title}
                </Text>
                <Text size="xs" c="dimmed" mt={4}>
                  <Code>{t.cron_expression}</Code> ({t.timezone}) · profil {t.agent_id}
                  {t.last_run_at ? ` · poslední běh ${new Date(t.last_run_at).toLocaleString("cs-CZ")}` : ""}
                </Text>
                <Group mt="sm" gap="md">
                  <Checkbox
                    label="Zapnuto"
                    checked={t.enabled}
                    disabled={schedLoading}
                    onChange={(e) => void toggleScheduledTask(t, e.currentTarget.checked)}
                  />
                  <Button size="xs" variant="light" color="red" disabled={schedLoading} onClick={() => deleteScheduledTask(t.id)}>
                    Smazat
                  </Button>
                </Group>
              </Card>
            ))}
          </Stack>
        )}

        <Title order={4} mb="sm">
          Nová úloha
        </Title>
        <form
          onSubmit={(e) => void saveScheduledTask(e)}
          style={{ maxWidth: 640 }}
        >
          <Stack gap="md">
          <TextInput
            label="Název"
            value={schedForm.title}
            onChange={(e) => setSchedForm({ ...schedForm, title: e.currentTarget.value })}
            placeholder="např. Ranní monitoring nabídek"
          />
          <TextInput
            label="Cron (5 polí, jako v pg_cron)"
            value={schedForm.cron_expression}
            onChange={(e) => setSchedForm({ ...schedForm, cron_expression: e.currentTarget.value })}
            placeholder="0 8 * * *"
          />
          <TextInput
            label="Časová zóna (IANA)"
            value={schedForm.timezone}
            onChange={(e) => setSchedForm({ ...schedForm, timezone: e.currentTarget.value })}
          />
          <Textarea
            label="Systémové zadání (prompt pro každý běh)"
            minRows={6}
            value={schedForm.system_prompt}
            onChange={(e) => setSchedForm({ ...schedForm, system_prompt: e.currentTarget.value })}
            placeholder="Instrukce pro agenta: role, co má hlídat, formát výstupu…"
          />
          <Textarea
            label="Dotaz při každém běhu"
            minRows={3}
            value={schedForm.user_question}
            onChange={(e) => setSchedForm({ ...schedForm, user_question: e.currentTarget.value })}
          />
          <Select
            label="Profil agenta"
            value={schedForm.agent_id}
            onChange={(v) =>
              setSchedForm({
                ...schedForm,
                agent_id: (v as "basic" | "thinking-orchestrator") ?? "basic"
              })
            }
            data={[
              { value: "basic", label: "basic" },
              { value: "thinking-orchestrator", label: "thinking-orchestrator" }
            ]}
          />
          <Button type="submit" loading={schedSaving}>
            {schedSaving ? "Ukládám…" : "Vytvořit úlohu"}
          </Button>
          </Stack>
        </form>

        {schedMessage ? (
          <Text role="status" mt="md" size="sm" fw={500}>
            {schedMessage}
          </Text>
        ) : null}

        <Accordion mt="xl" variant="contained">
          <Accordion.Item value="sql">
            <Accordion.Control>Příklad: pg_cron + pg_net (Supabase SQL)</Accordion.Control>
            <Accordion.Panel>
              <Code block fz="xs" style={{ whiteSpace: "pre-wrap" }}>
                {cronExample}
              </Code>
            </Accordion.Panel>
          </Accordion.Item>
        </Accordion>
      </Card>

      <Card withBorder padding="lg" radius="md">
        <Title order={3} mb="xs">
          Heslo pro přihlášení e-mailem
        </Title>
        <Text size="sm" c="dimmed" mb="md">
          Doplní nebo změní heslo k tomuto účtu (včetně účtů založených přes Google). Zapomenuté heslo:{" "}
          <Anchor component={Link} href="/auth/forgot-password" size="sm">
            obnova e-mailem
          </Anchor>
          .
        </Text>
        <form onSubmit={handleSetPassword}>
          <Stack gap="md" maw={400}>
            <TextInput
              type="password"
              value={passNew}
              onChange={(e) => setPassNew(e.currentTarget.value)}
              placeholder="Nové heslo (min. 8 znaků)"
              minLength={8}
              autoComplete="new-password"
            />
            <TextInput
              type="password"
              value={passNew2}
              onChange={(e) => setPassNew2(e.currentTarget.value)}
              placeholder="Nové heslo znovu"
              minLength={8}
              autoComplete="new-password"
            />
            <Button type="submit" loading={passLoading}>
              {passLoading ? "Ukládám…" : "Nastavit / změnit heslo"}
            </Button>
          </Stack>
        </form>
        {passMessage ? (
          <Text role="status" mt="md" size="sm">
            {passMessage}
          </Text>
        ) : null}
      </Card>
    </Stack>
  );
}
