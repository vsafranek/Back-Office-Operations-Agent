"use client";

import { useState } from "react";
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

    const { error } = await supabase.auth.signUp({
      email,
      password
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
        queryParams: {
          access_type: "offline",
          prompt: "consent"
        },
        scopes: [
          "openid",
          "email",
          "profile",
          "https://www.googleapis.com/auth/calendar.readonly",
          "https://www.googleapis.com/auth/gmail.modify"
        ].join(" ")
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
          {loading ? "Registruji..." : "Registrovat"}
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
