"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type EstadoSesion = "verificando" | "sin-sesion" | "con-sesion";

export default function LoginPage() {
  const router = useRouter();
  const supabaseRef = useRef<ReturnType<typeof createClient> | null>(null);
  function getSupabase() {
    if (!supabaseRef.current) supabaseRef.current = createClient();
    return supabaseRef.current;
  }

  const [estadoSesion, setEstadoSesion] = useState<EstadoSesion>("verificando");
  const [usuario, setUsuario] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Única fuente de verdad para saber si ya hay sesión: igual que en el
  // layout de /admin/(protected), nos apoyamos solo en onAuthStateChange
  // (su evento inicial cubre lo mismo que getSession(), sin una promesa
  // paralela que pueda quedar sin resolver ni compitiendo por la decisión).
  useEffect(() => {
    const supabase = getSupabase();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setEstadoSesion(session ? "con-sesion" : "sin-sesion");
    });

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (estadoSesion === "con-sesion") router.replace("/admin/caja");
  }, [estadoSesion, router]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const email = `${usuario.trim()}@cantina.local`;
    const { error } = await getSupabase().auth.signInWithPassword({ email, password });

    setLoading(false);

    if (error) {
      setError("Usuario o contraseña incorrectos.");
      return;
    }

    router.push("/admin/caja");
    router.refresh();
  }

  if (estadoSesion === "verificando" || estadoSesion === "con-sesion") {
    return (
      <main className="flex-1 flex items-center justify-center px-4">
        <p className="text-sm text-ink-soft">Verificando sesión...</p>
      </main>
    );
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
            <label className="text-sm text-ink-soft block mb-1">Usuario</label>
            <input
              type="text"
              autoComplete="username"
              required
              value={usuario}
              onChange={(e) => setUsuario(e.target.value)}
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
