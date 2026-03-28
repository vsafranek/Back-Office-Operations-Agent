"use client";

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
    <main style={{ maxWidth: 420 }}>
      <p>{message}</p>
    </main>
  );
}
