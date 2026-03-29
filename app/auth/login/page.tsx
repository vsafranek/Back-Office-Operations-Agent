"use client";

import { Anchor, Button, Divider, Paper, PasswordInput, Stack, Text, TextInput, Title } from "@mantine/core";
import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { googleSupabaseSignInScopeString } from "@/lib/integrations/google-integration-scopes";
import { MICROSOFT_GRAPH_INTEGRATION_SCOPES } from "@/lib/integrations/microsoft-graph-oauth-scopes";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser-client";

export default function LoginPage() {
  const supabase = getSupabaseBrowserClient();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [microsoftLoading, setMicrosoftLoading] = useState(false);

  async function handleLogin(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setMessage(null);

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password
    });

    setLoading(false);

    if (error) {
      setMessage(error.message);
      return;
    }

    router.push("/dashboard");
  }

  async function handleGoogleLogin() {
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

  async function handleMicrosoftLogin() {
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
      <Title order={2}>Přihlášení</Title>
      <Text size="sm" c="dimmed" mt="xs">
        E-mail a heslo, nebo přihlášení přes <strong>Google</strong> / <strong>Microsoft</strong>. Účty se stejným e-mailem v aplikaci po
        přihlášení sloučíme.
      </Text>

      <form onSubmit={handleLogin}>
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
            autoComplete="current-password"
          />
          <Button type="submit" fullWidth loading={loading}>
            {loading ? "Přihlašuji..." : "Přihlásit se e-mailem"}
          </Button>
        </Stack>
      </form>

      <Anchor component={Link} href="/auth/forgot-password" size="sm" mt="md" display="inline-block">
        Zapomenuté heslo
      </Anchor>

      <Divider label="nebo" labelPosition="center" my="lg" />

      <Stack gap="sm">
        <Button variant="light" fullWidth onClick={() => void handleGoogleLogin()} loading={googleLoading}>
          {googleLoading ? "Přesměrovávám…" : "Přihlásit přes Google"}
        </Button>
        <Button variant="light" fullWidth onClick={() => void handleMicrosoftLogin()} loading={microsoftLoading}>
          {microsoftLoading ? "Přesměrovávám…" : "Přihlásit přes Microsoft"}
        </Button>
      </Stack>

      <Text size="sm" mt="lg">
        Nemáš účet?{" "}
        <Anchor component={Link} href="/auth/register" size="sm">
          Registrovat
        </Anchor>
      </Text>

      {message ? (
        <Text c="red" size="sm" mt="md">
          {message}
        </Text>
      ) : null}
    </Paper>
  );
}
