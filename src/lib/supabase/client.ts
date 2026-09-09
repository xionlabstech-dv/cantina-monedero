import { createBrowserClient } from "@supabase/ssr";

// postgrest-js no fija cache: 'no-store' en sus peticiones GET, así que el
// navegador podría (dependiendo de los headers de respuesta) servir una
// respuesta anterior en vez de ir a la red — por ejemplo, al volver a buscar
// el mismo carnet poco después de registrarle una recarga o venta. Forzamos
// no-store en cada request para que siempre se lea el estado más reciente.
//
// Además, reintentamos una vez las lecturas (GET) que fallan por un corte de
// conexión (fetch() rechaza con TypeError, no con un status HTTP). Esto es
// común justo después de un despliegue: el service worker (skipWaiting +
// clients.claim) puede tomar control de una pestaña ya abierta a mitad de
// una petición y cortar la conexión en curso. No reintentamos escrituras
// (insert/update/rpc): si el corte ocurrió después de que el servidor ya
// procesó la operación, reintentar podría duplicarla (ej. una venta).
function fetchSinCache(input: RequestInfo | URL, init?: RequestInit) {
  const metodo = (init?.method ?? "GET").toUpperCase();
  const esLectura = metodo === "GET" || metodo === "HEAD";

  return fetch(input, { ...init, cache: "no-store" }).catch((err) => {
    if (!esLectura || !(err instanceof TypeError)) throw err;
    return fetch(input, { ...init, cache: "no-store" });
  });
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
