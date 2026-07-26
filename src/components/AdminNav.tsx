"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

const links = [
  { href: "/admin/caja", label: "Caja" },
  { href: "/admin/inventario", label: "Inventario" },
  { href: "/admin/gestion", label: "Gestión" },
  { href: "/admin/historial", label: "Historial" },
];

export function AdminNav() {
  const pathname = usePathname();
  const router = useRouter();
  const supabase = createClient();

  async function handleLogout() {
    await supabase.auth.signOut();
    router.push("/admin/login");
    router.refresh();
  }

  return (
    <nav className="border-b border-line bg-paper-raised">
      <div className="flex items-center justify-between px-4 sm:px-6 h-14">
        <div className="flex items-center gap-1 overflow-x-auto">
          {links.map((link) => {
            const active = pathname.startsWith(link.href);
            return (
              <Link
                key={link.href}
                href={link.href}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium whitespace-nowrap ${
                  active ? "bg-accent-soft text-accent" : "text-ink-soft hover:text-ink"
                }`}
              >
                {link.label}
              </Link>
            );
          })}
        </div>
        <button
          onClick={handleLogout}
          className="text-sm text-ink-soft hover:text-debt shrink-0 ml-3"
        >
          Salir
        </button>
      </div>
    </nav>
  );
}
