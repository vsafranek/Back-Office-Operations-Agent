"use client";

import { useState } from "react";
import Link from "next/link";
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
    <main style={{ maxWidth: 420 }}>
      <h1>Zapomenuté heslo</h1>
      <p style={{ fontSize: 14, color: "#64748b" }}>
        Zadejte e-mail účtu. Odkaz v e-mailu vás přesměruje na stránku pro nastavení nového hesla.
      </p>
      <form onSubmit={handleSubmit} style={{ display: "grid", gap: 12 }}>
        <input
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="E-mail"
          type="email"
          required
          autoComplete="email"
        />
        <button type="submit" disabled={loading}>
          {loading ? "Odesílám…" : "Poslat odkaz"}
        </button>
      </form>
      <p style={{ marginTop: 16 }}>
        <Link href="/auth/login">Zpět na přihlášení</Link>
      </p>
      {message ? <p role="status">{message}</p> : null}
    </main>
  );
}
