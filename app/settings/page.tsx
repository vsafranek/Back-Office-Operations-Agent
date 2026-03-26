"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser-client";

type IntegrationSettings = {
  calendar_provider: string;
  calendar_account_email: string;
  calendar_id: string;
  mail_provider: string;
  mail_from_email: string;
  google_refresh_token: string;
  google_access_token: string;
  has_google_tokens?: boolean;
};

const initialState: IntegrationSettings = {
  calendar_provider: "google",
  calendar_account_email: "",
  calendar_id: "primary",
  mail_provider: "gmail",
  mail_from_email: "",
  google_refresh_token: "",
  google_access_token: ""
};

export default function SettingsPage() {
  const supabase = useMemo(() => getSupabaseBrowserClient(), []);
  const router = useRouter();
  const [form, setForm] = useState<IntegrationSettings>(initialState);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [disconnecting, setDisconnecting] = useState(false);

  useEffect(() => {
    void (async () => {
      const sessionResult = await supabase.auth.getSession();
      const accessToken = sessionResult.data.session?.access_token;
      if (!accessToken) {
        router.replace("/auth/login");
        return;
      }

      const response = await fetch("/api/settings/integrations", {
        headers: {
          Authorization: `Bearer ${accessToken}`
        }
      });
      if (!response.ok) return;
      const data = await response.json();
      if (data) {
        setForm({
          calendar_provider: data.calendar_provider ?? "google",
          calendar_account_email: data.calendar_account_email ?? "",
          calendar_id: data.calendar_id ?? "",
          mail_provider: data.mail_provider ?? "gmail",
          mail_from_email: data.mail_from_email ?? "",
          google_refresh_token: data.google_refresh_token ?? "",
          google_access_token: data.google_access_token ?? "",
          has_google_tokens: Boolean(data.has_google_tokens)
        });
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
      body: JSON.stringify(form)
    });
    const payload = await response.json();
    setLoading(false);
    setMessage(response.ok ? "Nastavení uloženo." : payload.error ?? "Uložení selhalo.");
  }

  async function disconnectGoogle() {
    setDisconnecting(true);
    setMessage(null);
    const sessionResult = await supabase.auth.getSession();
    const accessToken = sessionResult.data.session?.access_token;
    if (!accessToken) {
      router.push("/auth/login");
      return;
    }

    const response = await fetch("/api/settings/integrations", {
      method: "DELETE",
      headers: {
        Authorization: `Bearer ${accessToken}`
      }
    });
    const payload = await response.json();
    setDisconnecting(false);
    if (!response.ok) {
      setMessage(payload.error ?? "Odpojení Google selhalo.");
      return;
    }
    setForm({ ...form, google_access_token: "", google_refresh_token: "", has_google_tokens: false });
    setMessage("Google účet byl odpojen.");
  }

  return (
    <main style={{ maxWidth: 760 }}>
      <h1>Nastavení integrací</h1>
      <p>
        <a href="/dashboard">Zpět na dashboard</a>
      </p>
      <form onSubmit={saveSettings} style={{ display: "grid", gap: 10 }}>
        <label>
          Calendar provider
          <input value={form.calendar_provider} onChange={(e) => setForm({ ...form, calendar_provider: e.target.value })} />
        </label>
        <label>
          Calendar account e-mail
          <input
            value={form.calendar_account_email}
            onChange={(e) => setForm({ ...form, calendar_account_email: e.target.value })}
            type="email"
          />
        </label>
        <label>
          Calendar ID
          <input value={form.calendar_id} onChange={(e) => setForm({ ...form, calendar_id: e.target.value })} />
        </label>
        <label>
          Mail provider
          <input value={form.mail_provider} onChange={(e) => setForm({ ...form, mail_provider: e.target.value })} />
        </label>
        <label>
          Mail from e-mail
          <input value={form.mail_from_email} onChange={(e) => setForm({ ...form, mail_from_email: e.target.value })} type="email" />
        </label>
        <p>Google tokeny: {form.has_google_tokens ? "Připojeno" : "Nepřipojeno"}</p>
        <button type="submit" disabled={loading}>
          {loading ? "Ukládám..." : "Uložit"}
        </button>
        <button type="button" onClick={disconnectGoogle} disabled={disconnecting || !form.has_google_tokens}>
          {disconnecting ? "Odpojuji..." : "Odpojit Google účet"}
        </button>
      </form>
      {message ? <p>{message}</p> : null}
    </main>
  );
}
