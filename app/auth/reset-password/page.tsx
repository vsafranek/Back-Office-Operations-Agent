"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
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
    <main style={{ maxWidth: 420 }}>
      <h1>Nové heslo</h1>
      {!ready ? (
        <p style={{ fontSize: 14, color: "#64748b" }}>
          Otevřete odkaz z e-mailu v tomto prohlížeči. Pokud relace nepřijde, zkuste znovu „Zapomenuté heslo“.
        </p>
      ) : (
        <form onSubmit={handleSubmit} style={{ display: "grid", gap: 12 }}>
          <input
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Nové heslo"
            type="password"
            required
            minLength={8}
            autoComplete="new-password"
          />
          <input
            value={password2}
            onChange={(e) => setPassword2(e.target.value)}
            placeholder="Nové heslo znovu"
            type="password"
            required
            minLength={8}
            autoComplete="new-password"
          />
          <button type="submit" disabled={loading}>
            {loading ? "Ukládám…" : "Nastavit heslo"}
          </button>
        </form>
      )}
      <p style={{ marginTop: 16 }}>
        <Link href="/auth/login">Přihlášení</Link>
      </p>
      {message ? <p role="alert">{message}</p> : null}
    </main>
  );
}
