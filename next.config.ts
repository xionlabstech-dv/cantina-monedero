import type { NextConfig } from "next";

// Diagnóstico de variables de entorno en build time (aparece en el log de
// Cloudflare Pages en cada build). Nunca imprime la anon key completa, solo
// si está presente, y de la URL solo los primeros 8 caracteres.
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

console.log("[diagnóstico build] NEXT_PUBLIC_SUPABASE_URL presente:", Boolean(supabaseUrl));
console.log(
  "[diagnóstico build] NEXT_PUBLIC_SUPABASE_ANON_KEY presente:",
  Boolean(supabaseAnonKey)
);
if (supabaseUrl) {
  // Se quita el protocolo antes de recortar: los primeros 8 caracteres de
  // "https://..." son siempre "https://" (no distinguen de qué proyecto se
  // trata). Recortando después del protocolo se ve el inicio del project
  // ref, que es lo que realmente sirve para confirmar el proyecto.
  const sinProtocolo = supabaseUrl.replace(/^https?:\/\//, "");
  console.log(
    "[diagnóstico build] NEXT_PUBLIC_SUPABASE_URL (primeros 8 caracteres tras el protocolo):",
    sinProtocolo.slice(0, 8)
  );
}

const nextConfig: NextConfig = {
  output: "export",
  trailingSlash: true,
};

export default nextConfig;
