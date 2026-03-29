"use client";

import { Anchor, Button, Divider, Paper, PasswordInput, Stack, Text, TextInput, Title } from "@mantine/core";
import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { googleSupabaseSignInScopeString } from "@/lib/integrations/google-integration-scopes";
import { MICROSOFT_GRAPH_INTEGRATION_SCOPES } from "@/lib/integrations/microsoft-graph-oauth-scopes";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser-client";

export default function RegisterPage() {
  const supabase = getSupabaseBrowserClient();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [microsoftLoading, setMicrosoftLoading] = useState(false);

  async function handleRegister(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setMessage(null);

    const emailRedirectTo = `${window.location.origin}/auth/callback`;
    const { error } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: {
        emailRedirectTo
      }
    });

    setLoading(false);

    if (error) {
      setMessage(error.message);
      return;
    }

    setMessage("Registrace proběhla. Pokud máš zapnuté email potvrzení, potvrď email a pak se přihlas.");
    router.push("/auth/login");
  }

  async function handleGoogleRegister() {
    setGoogleLoading(true);
    setMessage(null);

    const redirectTo = `${window.location.origin}/dashboard`;
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo,
        scopes: googleSupabaseSignInScopeString(),
        queryParams: {
          access_type: "offline",
          prompt: "consent"
        }
      }
    });

    setGoogleLoading(false);
    if (error) {
      setMessage(error.message);
    }
  }

  async function handleMicrosoftRegister() {
    setMicrosoftLoading(true);
    setMessage(null);

    const redirectTo = `${window.location.origin}/dashboard`;
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "azure",
      options: {
        redirectTo,
        scopes: MICROSOFT_GRAPH_INTEGRATION_SCOPES
      }
    });

    setMicrosoftLoading(false);
    if (error) {
      setMessage(error.message);
    }
  }

  return (
    <Paper shadow="sm" p="xl" radius="md" withBorder>
      <Title order={2}>Registrace</Title>
      <Text size="sm" c="dimmed" mt="xs">
        Založte účet e-mailem (ověření dle Supabase) nebo přes <strong>Google</strong> / <strong>Microsoft</strong>. Doplňky v{" "}
        <Anchor component={Link} href="/settings" size="sm">
          Nastavení
        </Anchor>
        .
      </Text>

      <form onSubmit={handleRegister}>
        <Stack gap="md" mt="lg">
          <TextInput
            label="E-mail"
            value={email}
            onChange={(e) => setEmail(e.currentTarget.value)}
            type="email"
            required
            autoComplete="email"
          />
          <PasswordInput
            label="Heslo"
            value={password}
            onChange={(e) => setPassword(e.currentTarget.value)}
            required
            minLength={8}
            autoComplete="new-password"
          />
          <Button type="submit" fullWidth loading={loading}>
            {loading ? "Registruji..." : "Registrovat e-mailem"}
          </Button>
        </Stack>
      </form>

      <Divider label="nebo" labelPosition="center" my="lg" />

      <Stack gap="sm">
        <Button variant="light" fullWidth onClick={() => void handleGoogleRegister()} loading={googleLoading}>
          {googleLoading ? "Přesměrovávám…" : "Pokračovat s Google"}
        </Button>
        <Button variant="light" fullWidth onClick={() => void handleMicrosoftRegister()} loading={microsoftLoading}>
          {microsoftLoading ? "Přesměrovávám…" : "Pokračovat s Microsoftem"}
        </Button>
      </Stack>

      <Text size="sm" mt="lg">
        Už máš účet?{" "}
        <Anchor component={Link} href="/auth/login" size="sm">
          Přihlásit se
        </Anchor>
      </Text>

      {message ? (
        <Text c={message.includes("proběhla") ? "dimmed" : "red"} size="sm" mt="md">
          {message}
        </Text>
      ) : null}
    </Paper>
  );
}
