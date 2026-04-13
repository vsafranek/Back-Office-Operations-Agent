"use client";

import { Loader, Paper, Stack, Text, Title } from "@mantine/core";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser-client";

/**
 * CĂ­l pro emailRedirectTo po registraci / ovÄ›Ĺ™enĂ­ e-mailu (doplĹte URL v Supabase Auth â†’ Redirect URLs).
 */
export default function AuthCallbackPage() {
  const router = useRouter();
  const [message, setMessage] = useState("DokonÄŤuji pĹ™ihlĂˇĹˇenĂ­â€¦");

  useEffect(() => {
    const supabase = getSupabaseBrowserClient();
    void (async () => {
      const { data, error } = await supabase.auth.getSession();
      if (error) {
        setMessage(error.message);
        return;
      }
      if (data.session) {
        router.replace("/");
        return;
      }
      setMessage("Relace nebyla nalezena. Zkuste se pĹ™ihlĂˇsit znovu.");
      router.replace("/auth/login");
    })();
  }, [router]);

  return (
    <Paper shadow="sm" p="xl" radius="md" withBorder>
      <Stack align="center" gap="md">
        <Loader size="sm" />
        <div style={{ textAlign: "center" }}>
          <Title order={4}>OvÄ›Ĺ™enĂ­ ĂşÄŤtu</Title>
          <Text size="sm" c="dimmed" mt="xs">
            {message}
          </Text>
        </div>
      </Stack>
    </Paper>
  );
}

