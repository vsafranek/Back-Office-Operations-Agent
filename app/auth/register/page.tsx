"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser-client";

export default function RegisterPage() {
  const supabase = getSupabaseBrowserClient();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);

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
      <h1>Registrace</h1>
      <p style={{ fontSize: 14, color: "#64748b", marginTop: 0 }}>
        Založte účet e-mailem (ověření e-mailu podle nastavení Supabase) nebo přes Google. Kalendář a poštu
        připojíte později v <Link href="/settings">Nastavení integrací</Link>.
      </p>
      <form onSubmit={handleRegister} style={{ display: "grid", gap: 12 }}>
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
          {loading ? "Registruji..." : "Registrovat e-mailem"}
        </button>
      </form>
      <div style={{ marginTop: 12 }}>
        <button type="button" onClick={handleGoogleRegister} disabled={googleLoading}>
          {googleLoading ? "Přesměrovávám na Google..." : "Registrovat / Přihlásit přes Google"}
        </button>
      </div>
      <p style={{ marginTop: 12 }}>
        Už máš účet? <a href="/auth/login">Přihlásit se</a>
      </p>
      {message ? <p>{message}</p> : null}
    </main>
  );
}
