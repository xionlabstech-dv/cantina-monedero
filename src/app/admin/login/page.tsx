"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const router = useRouter();
  const supabase = createClient();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const { error } = await supabase.auth.signInWithPassword({ email, password });

    setLoading(false);

    if (error) {
      setError("Correo o contraseña incorrectos.");
      return;
    }

    router.push("/admin/caja");
    router.refresh();
  }

  return (
    <main className="flex-1 flex flex-col items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <header className="text-center mb-8">
          <p className="font-ticket text-xs tracking-widest text-accent uppercase mb-1">
            Cantina Escolar
          </p>
          <h1 className="text-2xl font-bold text-ink">Acceso cantinera</h1>
        </header>

        <form onSubmit={handleSubmit} className="ticket p-5 flex flex-col gap-3">
          <div>
            <label className="text-sm text-ink-soft block mb-1">Correo</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full py-2.5 px-3 rounded-lg border border-line bg-paper-raised focus:outline-none focus:ring-2 focus:ring-accent"
            />
          </div>
          <div>
            <label className="text-sm text-ink-soft block mb-1">Contraseña</label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full py-2.5 px-3 rounded-lg border border-line bg-paper-raised focus:outline-none focus:ring-2 focus:ring-accent"
            />
          </div>
          {error && <p className="text-sm text-debt">{error}</p>}
          <button
            type="submit"
            disabled={loading}
            className="mt-2 py-2.5 rounded-lg bg-accent text-white font-medium disabled:opacity-60"
          >
            {loading ? "Entrando..." : "Entrar"}
          </button>
        </form>
      </div>
    </main>
  );
}
