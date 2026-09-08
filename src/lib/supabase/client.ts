import { createBrowserClient } from "@supabase/ssr";

export function createClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (typeof window === "undefined") {
    // Se está evaluando fuera del navegador (pre-render de build en
    // output: 'export'). Esta instancia nunca se usa de verdad — evita
    // que falte el build completo si las variables no llegan a ese paso.
    return createBrowserClient(
      url || "https://placeholder.supabase.co",
      anonKey || "placeholder-anon-key"
    );
  }

  if (!url || !anonKey) {
    throw new Error(
      "Faltan las variables NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY en este entorno."
    );
  }

  return createBrowserClient(url, anonKey);
}
