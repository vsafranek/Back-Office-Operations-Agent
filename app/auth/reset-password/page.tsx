"use client";

import { Anchor, Button, Paper, PasswordInput, Stack, Text, Title } from "@mantine/core";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser-client";

export default function ResetPasswordPage() {
  const supabase = getSupabaseBrowserClient();
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [password2, setPassword2] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    void supabase.auth.getSession().then(({ data }) => {
      setReady(Boolean(data.session));
    });
  }, [supabase.auth]);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage(null);

    if (password.length < 8) {
      setMessage("Heslo musí mít alespoň 8 znaků.");
      return;
    }
    if (password !== password2) {
      setMessage("Hesla se neshodují.");
      return;
    }

    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password });
    setLoading(false);

    if (error) {
      setMessage(error.message);
      return;
    }

    router.replace("/dashboard");
  }

  return (
    <Paper shadow="sm" p="xl" radius="md" withBorder>
      <Title order={2}>Nové heslo</Title>
      {!ready ? (
        <Text size="sm" c="dimmed" mt="md">
          Otevřete odkaz z e-mailu v tomto prohlížeči. Pokud relace nepřijde, zkuste znovu „Zapomenuté heslo“.
        </Text>
      ) : (
        <form onSubmit={handleSubmit}>
          <Stack gap="md" mt="lg">
            <PasswordInput
              label="Nové heslo"
              value={password}
              onChange={(e) => setPassword(e.currentTarget.value)}
              required
              minLength={8}
              autoComplete="new-password"
            />
            <PasswordInput
              label="Nové heslo znovu"
              value={password2}
              onChange={(e) => setPassword2(e.currentTarget.value)}
              required
              minLength={8}
              autoComplete="new-password"
            />
            <Button type="submit" fullWidth loading={loading}>
              {loading ? "Ukládám…" : "Nastavit heslo"}
            </Button>
          </Stack>
        </form>
      )}

      <Anchor component={Link} href="/auth/login" size="sm" mt="lg" display="inline-block">
        Přihlášení
      </Anchor>

      {message ? (
        <Text role="alert" c="red" size="sm" mt="md">
          {message}
        </Text>
      ) : null}
    </Paper>
  );
}
