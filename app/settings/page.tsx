"use client";

import {
  Accordion,
  Alert,
  Anchor,
  Button,
  Card,
  Checkbox,
  Code,
  Container,
  Divider,
  Group,
  List,
  Modal,
  Select,
  Stack,
  Switch,
  Tabs,
  Text,
  Textarea,
  TextInput,
  Title
} from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import { modals } from "@mantine/modals";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useSyncLoginProviderIntegration } from "@/hooks/use-sync-login-provider-integration";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser-client";

type IntegrationState = {
  calendar_provider: "google" | "microsoft";
  calendar_account_email: string;
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
  market_listings_params?: Record<string, unknown> | null;
};

const initialIntegrationState: IntegrationState = {
  calendar_provider: "google",
  calendar_account_email: "",
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
  useSyncLoginProviderIntegration(supabase);
  const router = useRouter();
  const [integration, setIntegration] = useState<IntegrationState>(initialIntegrationState);
  const [connecting, setConnecting] = useState<"google" | "microsoft" | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [disconnecting, setDisconnecting] = useState<"google" | "microsoft" | null>(null);
  const [integrationConnectOpened, integrationConnectHandlers] = useDisclosure(false);
  const [integrationConnectProvider, setIntegrationConnectProvider] = useState<"google" | "microsoft">("google");
  const [integrationConnectConsent, setIntegrationConnectConsent] = useState(false);
  const [integrationConnectModalError, setIntegrationConnectModalError] = useState<string | null>(null);
  const [passNew, setPassNew] = useState("");
  const [passNew2, setPassNew2] = useState("");
  const [passLoading, setPassLoading] = useState(false);
  const [passMessage, setPassMessage] = useState<string | null>(null);

  const [scheduledTasks, setScheduledTasks] = useState<ScheduledTaskRow[]>([]);
  const [schedLoading, setSchedLoading] = useState(false);
  const [schedSaving, setSchedSaving] = useState(false);
  const [schedMessage, setSchedMessage] = useState<string | null>(null);
  const [presentationOpeningSlide, setPresentationOpeningSlide] = useState(true);
  const [uiPrefsSaving, setUiPrefsSaving] = useState(false);
  const [uiPrefsMessage, setUiPrefsMessage] = useState<string | null>(null);
  const [schedForm, setSchedForm] = useState({
    title: "",
    cron_expression: "0 8 * * *",
    timezone: "Europe/Prague",
    system_prompt: "",
    user_question: "Splň naplánovanou úlohu podle systémového zadání.",
    agent_id: "basic" as "basic" | "thinking-orchestrator"
  });

  const [schedEditOpened, schedEditHandlers] = useDisclosure(false);
  const [schedEditTaskId, setSchedEditTaskId] = useState<string | null>(null);
  const [schedEditSaving, setSchedEditSaving] = useState(false);
  const [schedEditForm, setSchedEditForm] = useState({
    title: "",
    cron_expression: "",
    timezone: "Europe/Prague",
    system_prompt: "",
    user_question: "",
    agent_id: "basic" as "basic" | "thinking-orchestrator",
    market_listings_json: ""
  });

  const loadIntegrations = useCallback(async () => {
    const sessionResult = await supabase.auth.getSession();
    const accessToken = sessionResult.data.session?.access_token;
    if (!accessToken) return;
    const integrationsRes = await fetch("/api/settings/integrations", {
      headers: { Authorization: `Bearer ${accessToken}` }
    });
    if (!integrationsRes.ok) return;
    const data = await integrationsRes.json();
    if (data) {
      setIntegration({
        calendar_provider: data.calendar_provider === "microsoft" ? "microsoft" : "google",
        calendar_account_email: data.calendar_account_email ?? "",
        mail_from_email: data.mail_from_email ?? "",
        has_google_tokens: Boolean(data.has_google_tokens),
        has_microsoft_tokens: Boolean(data.has_microsoft_tokens)
      });
    }
  }, [supabase.auth]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const oauth = params.get("oauth");
    const provider = params.get("provider");
    const reason = params.get("reason");
    if (oauth === "ok" && provider) {
      setMessage(`Účet ${provider === "google" ? "Google" : "Microsoft 365"} byl připojen.`);
      void loadIntegrations();
      router.replace("/settings", { scroll: false });
    } else if (oauth === "error") {
      setMessage(`Propojení selhalo${reason ? `: ${decodeURIComponent(reason)}` : ""}.`);
      router.replace("/settings", { scroll: false });
    }
  }, [router, loadIntegrations]);

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

      await loadIntegrations();

      const uiPrefsRes = await fetch("/api/settings/ui-preferences", {
        headers: { Authorization: `Bearer ${accessToken}` }
      });
      if (uiPrefsRes.ok) {
        const up = (await uiPrefsRes.json()) as { presentation_opening_slide?: boolean };
        if (typeof up.presentation_opening_slide === "boolean") {
          setPresentationOpeningSlide(up.presentation_opening_slide);
        }
      }

      const tasksRes = await fetch("/api/settings/scheduled-tasks", {
        headers: { Authorization: `Bearer ${accessToken}` }
      });

      if (tasksRes.ok) {
        const payload = (await tasksRes.json()) as { tasks?: ScheduledTaskRow[] };
        setScheduledTasks(payload.tasks ?? []);
      }
    })();
  }, [router, supabase.auth, loadIntegrations]);

  function openIntegrationConnectModal(provider: "google" | "microsoft") {
    setIntegrationConnectProvider(provider);
    setIntegrationConnectConsent(false);
    setIntegrationConnectModalError(null);
    integrationConnectHandlers.open();
  }

  async function executeIntegrationOAuth(provider: "google" | "microsoft") {
    setConnecting(provider);
    setMessage(null);
    try {
      const sessionResult = await supabase.auth.getSession();
      const accessToken = sessionResult.data.session?.access_token;
      if (!accessToken) {
        setConnecting(null);
        router.push("/auth/login");
        return;
      }
      const path =
        provider === "google"
          ? "/api/integrations/oauth/google/authorize"
          : "/api/integrations/oauth/microsoft/authorize";
      const url = await fetchOAuthUrl(path, accessToken);
      window.location.href = url;
    } catch (e) {
      const msg = e instanceof Error ? e.message : "OAuth selhalo.";
      setMessage(msg);
      setConnecting(null);
      throw e;
    }
  }

  async function submitIntegrationConnectFromModal() {
    if (!integrationConnectConsent) return;
    setIntegrationConnectModalError(null);
    try {
      await executeIntegrationOAuth(integrationConnectProvider);
    } catch (e) {
      setIntegrationConnectModalError(e instanceof Error ? e.message : "Propojení selhalo.");
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
    await loadIntegrations();
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

  function openScheduledTaskEdit(task: ScheduledTaskRow) {
    setSchedEditTaskId(task.id);
    setSchedEditForm({
      title: task.title,
      cron_expression: task.cron_expression,
      timezone: task.timezone,
      system_prompt: task.system_prompt,
      user_question: task.user_question,
      agent_id: (task.agent_id === "thinking-orchestrator" ? "thinking-orchestrator" : "basic") as
        | "basic"
        | "thinking-orchestrator",
      market_listings_json:
        task.market_listings_params != null && typeof task.market_listings_params === "object"
          ? JSON.stringify(task.market_listings_params, null, 2)
          : ""
    });
    setSchedMessage(null);
    schedEditHandlers.open();
  }

  async function saveScheduledTaskEdit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!schedEditTaskId) return;
    setSchedMessage(null);
    if (!schedEditForm.title.trim() || !schedEditForm.system_prompt.trim()) {
      setSchedMessage("Vyplňte název a systémové zadání.");
      return;
    }
    let market_listings_params: Record<string, unknown> | null | undefined;
    const rawJson = schedEditForm.market_listings_json.trim();
    if (rawJson.length > 0) {
      try {
        const parsed = JSON.parse(rawJson) as unknown;
        if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) {
          setSchedMessage("Filtry nabídek musí být JSON objekt (ne pole).");
          return;
        }
        market_listings_params = parsed as Record<string, unknown>;
      } catch {
        setSchedMessage("Neplatný JSON u filtrů nabídek.");
        return;
      }
    } else {
      market_listings_params = null;
    }
    setSchedEditSaving(true);
    const sessionResult = await supabase.auth.getSession();
    const accessToken = sessionResult.data.session?.access_token;
    if (!accessToken) {
      router.push("/auth/login");
      setSchedEditSaving(false);
      return;
    }
    const res = await fetch(`/api/settings/scheduled-tasks/${schedEditTaskId}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`
      },
      body: JSON.stringify({
        title: schedEditForm.title.trim(),
        cron_expression: schedEditForm.cron_expression.trim(),
        timezone: schedEditForm.timezone.trim(),
        system_prompt: schedEditForm.system_prompt.trim(),
        user_question:
          schedEditForm.user_question.trim() ||
          "Splň naplánovanou úlohu podle systémového zadání.",
        agent_id: schedEditForm.agent_id,
        market_listings_params
      })
    });
    const payload = (await res.json()) as { error?: string };
    setSchedEditSaving(false);
    if (!res.ok) {
      setSchedMessage(payload.error ?? "Uložení změn selhalo.");
      return;
    }
    setSchedMessage("Úloha byla upravena.");
    schedEditHandlers.close();
    setSchedEditTaskId(null);
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

  async function persistPresentationOpeningSlide(next: boolean) {
    setUiPrefsMessage(null);
    setUiPrefsSaving(true);
    try {
      const sessionResult = await supabase.auth.getSession();
      const accessToken = sessionResult.data.session?.access_token;
      if (!accessToken) {
        router.push("/auth/login");
        return;
      }
      const res = await fetch("/api/settings/ui-preferences", {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ presentation_opening_slide: next })
      });
      const payload = (await res.json()) as { error?: string };
      if (!res.ok) {
        setUiPrefsMessage(payload.error ?? "Uložení preference selhalo.");
        return;
      }
      setPresentationOpeningSlide(next);
      setUiPrefsMessage("Nastavení prezentací bylo uloženo.");
    } finally {
      setUiPrefsSaving(false);
    }
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
    <Container size="xl" py={{ base: "lg", md: "xl" }} px={{ base: "sm", sm: "md", lg: "xl" }}>
      <Stack gap="xl">
        <Stack gap="sm">
          <Group justify="space-between" align="flex-start" wrap="wrap" gap="md">
            <div>
              <Title order={1} size="h2">
                Nastavení
              </Title>
              <Text c="dimmed" maw={640} mt="xs" size="sm" lh={1.6}>
                Přihlášení do aplikace je nezávislé na poště a kalendáři. Kalendář a e-mail používáte po připojení účtu v
                záložce Integrace.
              </Text>
            </div>
            <Anchor component={Link} href="/dashboard" size="sm" fw={500}>
              ← Zpět na dashboard
            </Anchor>
          </Group>
        </Stack>

        <Tabs
          defaultValue="integrace"
          keepMounted={false}
          variant="outline"
          radius="md"
          styles={{
            list: {
              flexWrap: "wrap",
              gap: 4
            },
            panel: {
              paddingTop: "var(--mantine-spacing-md)"
            }
          }}
        >
          <Tabs.List grow>
            <Tabs.Tab value="integrace">Integrace</Tabs.Tab>
            <Tabs.Tab value="automatizace">Naplánované úlohy</Tabs.Tab>
            <Tabs.Tab value="agent">Agent</Tabs.Tab>
            <Tabs.Tab value="ucet">Účet a bezpečnost</Tabs.Tab>
          </Tabs.List>

          <Tabs.Panel value="integrace">
            <Stack gap="lg">
              {message ? (
                <Alert color="blue" title="Stav" variant="light">
                  {message}
                </Alert>
              ) : null}

              <Alert color="gray" variant="light" title="Jak to funguje">
                <Text size="sm">
                  Pokud se přihlásíte přes <strong>Google</strong> nebo <strong>Microsoft 365</strong> na přihlašovací stránce, stejný účet se
                  automaticky použije pro Gmail/Kalendář resp. Outlook (tokeny z přihlášení uložíme do integrací). Přihlášení e-mailem a
                  heslem integraci samo nepřipojí — doplníte ji tlačítkem <strong>Připojit …</strong> (OAuth v modálu). U obou poskytovatelů můžete
                  mít účty připojené najednou — aktivní pro agenta je ten, u něhož jste naposledy dokončili připojení nebo OAuth přihlášení;
                  konkrétní výběr a odpojení řešíte zde.
                </Text>
              </Alert>

              <Card withBorder padding="xl" radius="md" shadow="xs">
                <Title order={3} mb="md">
                  Připojené účty
                </Title>
                <Stack gap="md">
                  <Alert variant="light" color="indigo" title="Aktivní pro agenta">
                    <Text size="sm">
                      {integration.calendar_provider === "microsoft"
                        ? "Microsoft 365 — Outlook a kalendář"
                        : "Google — Gmail a Kalendář"}
                      {(integration.calendar_account_email || integration.mail_from_email) && (
                        <>
                          {" "}
                          <Text span c="dimmed">
                            (
                            {integration.calendar_account_email || integration.mail_from_email})
                          </Text>
                        </>
                      )}
                    </Text>
                  </Alert>

                  <Group justify="space-between" align="flex-start" wrap="wrap" gap="sm">
                    <Text size="sm" maw={520}>
                      Google (kalendář + Gmail):{" "}
                      <Text span fw={700}>
                        {integration.has_google_tokens ? "připojeno" : "nepřipojeno"}
                      </Text>
                    </Text>
                    <Group gap="xs">
                      <Button
                        size="sm"
                        onClick={() => openIntegrationConnectModal("google")}
                        disabled={connecting !== null}
                      >
                        Připojit Google
                      </Button>
                      <Button
                        size="sm"
                        variant="light"
                        color="red"
                        onClick={() => void disconnect("google")}
                        disabled={disconnecting !== null || !integration.has_google_tokens}
                      >
                        {disconnecting === "google" ? "Odpojuji…" : "Odpojit Google"}
                      </Button>
                    </Group>
                  </Group>
                  <Divider />
                  <Group justify="space-between" align="flex-start" wrap="wrap" gap="sm">
                    <Text size="sm" maw={520}>
                      Microsoft 365 (Outlook + kalendář):{" "}
                      <Text span fw={700}>
                        {integration.has_microsoft_tokens ? "připojeno" : "nepřipojeno"}
                      </Text>
                    </Text>
                    <Group gap="xs">
                      <Button
                        size="sm"
                        onClick={() => openIntegrationConnectModal("microsoft")}
                        disabled={connecting !== null}
                      >
                        Připojit Microsoft 365
                      </Button>
                      <Button
                        size="sm"
                        variant="light"
                        color="red"
                        onClick={() => void disconnect("microsoft")}
                        disabled={disconnecting !== null || !integration.has_microsoft_tokens}
                      >
                        {disconnecting === "microsoft" ? "Odpojuji…" : "Odpojit Microsoft"}
                      </Button>
                    </Group>
                  </Group>
                </Stack>
              </Card>
            </Stack>
          </Tabs.Panel>

          <Tabs.Panel value="automatizace">
            <Card withBorder padding="xl" radius="md" shadow="xs" bg="violet.0">
        <Title order={3} c="violet.9" mb="xs">
          Naplánované úlohy agenta (cron)
        </Title>
        <Text size="sm" c="violet.9" mb="sm">
          Zde nastavíte opakované spouštění agenta: cron výraz ve formátu <strong>pg_cron</strong> (5 polí: minuta, hodina, den v
          měsíci, měsíc, den v týdnu), časová zóna, systémové zadání pro každý běh a text dotazu při každém běhu. Úlohu lze také
          navrhnout v chatu s agentem — po zobrazení návrhu ji potvrdíte v sekci Data a grafy nebo v Nástroje → Úlohy (cron).
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
              <Card key={t.id} withBorder padding="sm" radius="sm">
                <Text size="sm" fw={600}>
                  {t.title}
                </Text>
                <Text size="xs" c="dimmed" mt={4}>
                  <Code>{t.cron_expression}</Code> ({t.timezone}) · profil {t.agent_id}
                  {t.last_run_at ? ` · poslední běh ${new Date(t.last_run_at).toLocaleString("cs-CZ")}` : ""}
                </Text>
                <Group mt="sm" gap="md" wrap="wrap">
                  <Checkbox
                    label="Zapnuto"
                    checked={t.enabled}
                    disabled={schedLoading}
                    onChange={(e) => void toggleScheduledTask(t, e.currentTarget.checked)}
                  />
                  <Button
                    size="xs"
                    variant="light"
                    disabled={schedLoading}
                    onClick={() => openScheduledTaskEdit(t)}
                  >
                    Upravit
                  </Button>
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
        <form onSubmit={(e) => void saveScheduledTask(e)}>
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
            description="Jen obsah jednoho běhu (role, styl, co zahrnout). Neuvádějte zde cron ani opakování — to řeší pole Cron a časová zóna výše."
            minRows={6}
            value={schedForm.system_prompt}
            onChange={(e) => setSchedForm({ ...schedForm, system_prompt: e.currentTarget.value })}
            placeholder="Např. shrň nové relevantní nabídky stručně v odrážkách; nezakládej další plánované úlohy."
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
              { value: "basic", label: "Základní Agent" },
              { value: "thinking-orchestrator", label: "Thinking Agent" }
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
          </Tabs.Panel>

          <Tabs.Panel value="agent">
            <Card withBorder padding="xl" radius="md" shadow="xs">
              <Title order={3} mb="xs">
                Prezentace (PPTX / PDF)
              </Title>
              <Text size="sm" c="dimmed" mb="md" maw={560}>
                Určuje, zda agent při generování decku zahrne titulní úvodní slide s krátkým názvem tématu. Počet „obsahových“
                slidů zůstává stejný; při zapnutém titulku přibyde jedna strana navíc.
              </Text>
              <Switch
                label="Generovat prezentace s úvodním titulním slidem"
                description="Vypnuto = všechny slidy jsou rovnou obsahové (KPI, tabulky, grafy…)."
                checked={presentationOpeningSlide}
                disabled={uiPrefsSaving}
                onChange={(e) => void persistPresentationOpeningSlide(e.currentTarget.checked)}
              />
              {uiPrefsMessage ? (
                <Text role="status" mt="md" size="sm" fw={500}>
                  {uiPrefsMessage}
                </Text>
              ) : null}
            </Card>
          </Tabs.Panel>

          <Tabs.Panel value="ucet">
            <Card withBorder padding="xl" radius="md" shadow="xs">
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
          <Stack gap="md" maw={480}>
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
          </Tabs.Panel>
        </Tabs>
      </Stack>

      <Modal
        opened={schedEditOpened}
        onClose={() => {
          schedEditHandlers.close();
          setSchedEditTaskId(null);
        }}
        title="Upravit naplánovanou úlohu"
        size="lg"
        radius="md"
      >
        <form onSubmit={(e) => void saveScheduledTaskEdit(e)}>
          <Stack gap="md">
            <TextInput
              label="Název"
              value={schedEditForm.title}
              onChange={(e) => setSchedEditForm({ ...schedEditForm, title: e.currentTarget.value })}
            />
            <TextInput
              label="Cron (5 polí, jako v pg_cron)"
              value={schedEditForm.cron_expression}
              onChange={(e) => setSchedEditForm({ ...schedEditForm, cron_expression: e.currentTarget.value })}
            />
            <TextInput
              label="Časová zóna (IANA)"
              value={schedEditForm.timezone}
              onChange={(e) => setSchedEditForm({ ...schedEditForm, timezone: e.currentTarget.value })}
            />
            <Textarea
              label="Systémové zadání (prompt pro každý běh)"
              description="Jen obsah jednoho běhu. Bez cronu a bez pokynů k zakládání dalších naplánovaných úloh."
              minRows={6}
              value={schedEditForm.system_prompt}
              onChange={(e) => setSchedEditForm({ ...schedEditForm, system_prompt: e.currentTarget.value })}
            />
            <Textarea
              label="Dotaz při každém běhu"
              minRows={3}
              value={schedEditForm.user_question}
              onChange={(e) => setSchedEditForm({ ...schedEditForm, user_question: e.currentTarget.value })}
            />
            <Select
              label="Profil agenta"
              value={schedEditForm.agent_id}
              onChange={(v) =>
                setSchedEditForm({
                  ...schedEditForm,
                  agent_id: (v as "basic" | "thinking-orchestrator") ?? "basic"
                })
              }
              data={[
                { value: "basic", label: "Základní Agent" },
                { value: "thinking-orchestrator", label: "Thinking Agent" }
              ]}
            />
            <Textarea
              label="Filtry nabídek (volitelné JSON)"
              description="Prázdné = odstranit uložené filtry. Stejný tvar jako při návrhu z chatu (location, sources, …)."
              minRows={4}
              value={schedEditForm.market_listings_json}
              onChange={(e) => setSchedEditForm({ ...schedEditForm, market_listings_json: e.currentTarget.value })}
              styles={{ input: { fontFamily: "monospace", fontSize: 12 } }}
            />
            <Group justify="flex-end" mt="sm">
              <Button
                type="button"
                variant="default"
                onClick={() => {
                  schedEditHandlers.close();
                  setSchedEditTaskId(null);
                }}
              >
                Zrušit
              </Button>
              <Button type="submit" loading={schedEditSaving}>
                {schedEditSaving ? "Ukládám…" : "Uložit změny"}
              </Button>
            </Group>
          </Stack>
        </form>
      </Modal>

      <Modal
        opened={integrationConnectOpened}
        onClose={() => {
          setIntegrationConnectModalError(null);
          integrationConnectHandlers.close();
        }}
        title={
          integrationConnectProvider === "google" ? "Připojit Google" : "Připojit Microsoft 365"
        }
        size="lg"
        radius="md"
      >
        <Stack gap="md">
          <Text size="sm" c="dimmed">
            {integrationConnectProvider === "google"
              ? "Po potvrzení vás přesměrujeme na Google. Po návratu bude účet zobrazen výše v integracích."
              : "Po potvrzení vás přesměrujeme na Microsoft. Po návratu bude účet zobrazen výše v integracích."}
          </Text>

          <div>
            <Text size="sm" fw={600} mb={6}>
              Informace o oprávněních
            </Text>
            {integrationConnectProvider === "google" ? (
              <List size="sm" spacing="xs" c="dimmed">
                <List.Item>
                  <strong>Google Calendar</strong> — přístup k vašim kalendářům: prohlížení i úpravy událostí (stejné rozhraní API jako
                  plný přístup k Calendaru dle zvoleného scope v Google účtu).
                </List.Item>
                <List.Item>
                  <strong>Gmail</strong> — čtení a úpravy schránky včetně konceptů; odeslání zásilek dál probíhá v aplikaci podle vašeho
                  schválení.
                </List.Item>
              </List>
            ) : (
              <List size="sm" spacing="xs" c="dimmed">
                <List.Item>
                  <strong>Outlook / kalendář</strong> — čtení i zápis kalendáře (Microsoft Graph, Calendars.ReadWrite).
                </List.Item>
                <List.Item>
                  <strong>Pošta</strong> — čtení a zápis Outlooku (Mail.ReadWrite).
                </List.Item>
                <List.Item>
                  <strong>Obnovení relace</strong> — offline_access a základní profil (openid, email).
                </List.Item>
              </List>
            )}
          </div>

          <Checkbox
            label="Rozumím výše uvedeným oprávněním a chci pokračovat na přihlášení u poskytovatele."
            checked={integrationConnectConsent}
            onChange={(e) => {
              const c = e.currentTarget.checked;
              setIntegrationConnectConsent(c);
            }}
          />

          {integrationConnectModalError ? (
            <Alert color="red" variant="light" title="Chyba">
              {integrationConnectModalError}
            </Alert>
          ) : null}

          <Group justify="flex-end" mt="md">
            <Button
              variant="default"
              onClick={() => {
                setIntegrationConnectModalError(null);
                integrationConnectHandlers.close();
              }}
            >
              Zrušit
            </Button>
            <Button
              onClick={() => void submitIntegrationConnectFromModal()}
              loading={connecting === integrationConnectProvider}
              disabled={!integrationConnectConsent || connecting !== null}
            >
              {connecting === integrationConnectProvider
                ? "Přesměrovávám…"
                : integrationConnectProvider === "google"
                  ? "Pokračovat na Google"
                  : "Pokračovat na Microsoft"}
            </Button>
          </Group>
        </Stack>
      </Modal>
    </Container>
  );
}
