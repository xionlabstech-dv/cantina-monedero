"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { AdminNav } from "@/components/AdminNav";

export default function ProtectedAdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const [autorizado, setAutorizado] = useState(false);

  useEffect(() => {
    const supabase = createClient();
    let activo = true;

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!activo) return;
      if (!session) {
        router.replace("/admin/login");
        return;
      }
      setAutorizado(true);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session) router.replace("/admin/login");
    });

    return () => {
      activo = false;
      subscription.unsubscribe();
    };
  }, [router]);

  if (!autorizado) {
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
