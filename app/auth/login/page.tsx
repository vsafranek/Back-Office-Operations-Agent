"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser-client";

export default function LoginPage() {
  const supabase = getSupabaseBrowserClient();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);

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
        scopes: ["openid", "email", "profile"].join(" ")
      }
    });

    setGoogleLoading(false);
    if (error) {
      setMessage(error.message);
    }
  }

  return (
    <main style={{ maxWidth: 420 }}>
      <h1>Přihlášení</h1>
      <p style={{ fontSize: 14, color: "#64748b", marginTop: 0 }}>
        E-mail a heslo, nebo Google. Účty se stejným e-mailem sloučíme v aplikaci (integrace a konverzace) po
        přihlášení.
      </p>
      <form onSubmit={handleLogin} style={{ display: "grid", gap: 12 }}>
        <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="E-mail" type="email" required />
        <input
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Heslo"
          type="password"
          required
          minLength={8}
        />
        <button type="submit" disabled={loading}>
          {loading ? "Přihlašuji..." : "Přihlásit se e-mailem"}
        </button>
      </form>
      <p style={{ marginTop: 8, fontSize: 14 }}>
        <Link href="/auth/forgot-password">Zapomenuté heslo</Link>
      </p>
      <div style={{ marginTop: 12 }}>
        <button type="button" onClick={handleGoogleLogin} disabled={googleLoading}>
          {googleLoading ? "Přesměrovávám na Google..." : "Přihlásit přes Google"}
        </button>
      </div>
      <p style={{ marginTop: 12 }}>
        Nemáš účet? <a href="/auth/register">Registrovat</a>
      </p>
      {message ? <p>{message}</p> : null}
    </main>
  );
}
