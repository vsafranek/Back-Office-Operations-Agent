"use client";

import { Loader, Paper, Stack, Text, Title } from "@mantine/core";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser-client";

/**
 * Cíl pro emailRedirectTo po registraci / ověření e-mailu (doplňte URL v Supabase Auth → Redirect URLs).
 */
export default function AuthCallbackPage() {
  const router = useRouter();
  const [message, setMessage] = useState("Dokončuji přihlášení…");

  useEffect(() => {
    const supabase = getSupabaseBrowserClient();
    void (async () => {
      const { data, error } = await supabase.auth.getSession();
      if (error) {
        setMessage(error.message);
        return;
      }
      if (data.session) {
        router.replace("/dashboard");
        return;
      }
      setMessage("Relace nebyla nalezena. Zkuste se přihlásit znovu.");
      router.replace("/auth/login");
    })();
  }, [router]);

  return (
    <Paper shadow="sm" p="xl" radius="md" withBorder>
      <Stack align="center" gap="md">
        <Loader size="sm" />
        <div style={{ textAlign: "center" }}>
          <Title order={4}>Ověření účtu</Title>
          <Text size="sm" c="dimmed" mt="xs">
            {message}
          </Text>
        </div>
      </Stack>
    </Paper>
  );
}
