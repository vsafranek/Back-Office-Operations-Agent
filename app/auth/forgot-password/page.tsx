"use client";

import { Anchor, Button, Paper, Stack, Text, TextInput, Title } from "@mantine/core";
import Link from "next/link";
import { useState } from "react";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser-client";

export default function ForgotPasswordPage() {
  const supabase = getSupabaseBrowserClient();
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setMessage(null);

    const redirectTo = `${window.location.origin}/auth/reset-password`;
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo
    });

    setLoading(false);

    if (error) {
      setMessage(error.message);
      return;
    }

    setMessage("Pokud účet existuje, poslali jsme odkaz pro obnovu hesla na zadaný e-mail.");
  }

  return (
    <Paper shadow="sm" p="xl" radius="md" withBorder>
      <Title order={2}>Zapomenuté heslo</Title>
      <Text size="sm" c="dimmed" mt="xs">
        Zadejte e-mail účtu. Odkaz v e-mailu vás přesměruje na stránku pro nastavení nového hesla.
      </Text>

      <form onSubmit={handleSubmit}>
        <Stack gap="md" mt="lg">
          <TextInput
            label="E-mail"
            value={email}
            onChange={(e) => setEmail(e.currentTarget.value)}
            type="email"
            required
            autoComplete="email"
          />
          <Button type="submit" fullWidth loading={loading}>
            {loading ? "Odesílám…" : "Poslat odkaz"}
          </Button>
        </Stack>
      </form>

      <Anchor component={Link} href="/auth/login" size="sm" mt="lg" display="inline-block">
        Zpět na přihlášení
      </Anchor>

      {message ? (
        <Text role="status" size="sm" mt="md" c={message.includes("Pokud") ? "dimmed" : "red"}>
          {message}
        </Text>
      ) : null}
    </Paper>
  );
}
