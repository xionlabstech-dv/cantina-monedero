"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { AdminNav } from "@/components/AdminNav";

type EstadoSesion = "verificando" | "autorizado" | "no-autorizado";

export default function ProtectedAdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const [estado, setEstado] = useState<EstadoSesion>("verificando");

  // Única fuente de verdad: onAuthStateChange emite el estado inicial de la
  // sesión al suscribirse (evento INITIAL_SESSION) y luego cada cambio
  // posterior. Evitamos una llamada aparte a getSession() para que no haya
  // dos caminos async decidiendo lo mismo de forma independiente.
  useEffect(() => {
    const supabase = createClient();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setEstado(session ? "autorizado" : "no-autorizado");
    });

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (estado === "no-autorizado") router.replace("/admin/login");
  }, [estado, router]);

  if (estado !== "autorizado") {
    return (
      <div className="flex-1 flex items-center justify-center">
        <p className="text-sm text-ink-soft">Verificando sesión...</p>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col">
      <AdminNav />
      <div className="flex-1 px-4 py-6 sm:px-6">{children}</div>
    </div>
  );
}
