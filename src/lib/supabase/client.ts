import { createBrowserClient } from "@supabase/ssr";

// postgrest-js no fija cache: 'no-store' en sus peticiones GET, así que el
// navegador podría (dependiendo de los headers de respuesta) servir una
// respuesta anterior en vez de ir a la red — por ejemplo, al volver a buscar
// el mismo carnet poco después de registrarle una recarga o venta. Forzamos
// no-store en cada request para que siempre se lea el estado más reciente.
function fetchSinCache(input: RequestInfo | URL, init?: RequestInit) {
  return fetch(input, { ...init, cache: "no-store" });
}

export function createClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (typeof window === "undefined") {
    // Se está evaluando fuera del navegador (pre-render de build en
    // output: 'export'). Esta instancia nunca se usa de verdad — evita
    // que falte el build completo si las variables no llegan a ese paso.
    return createBrowserClient(
      url || "https://placeholder.supabase.co",
      anonKey || "placeholder-anon-key",
      { global: { fetch: fetchSinCache } }
    );
  }

  if (!url || !anonKey) {
    throw new Error(
      "Faltan las variables NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY en este entorno."
    );
  }

  return createBrowserClient(url, anonKey, { global: { fetch: fetchSinCache } });
}
