import Link from "next/link";

export default function Home() {
  return (
    <main className="flex-1 flex flex-col items-center justify-center px-4 text-center">
      <p className="font-ticket text-xs tracking-widest text-accent uppercase mb-2">
        Cantina Escolar
      </p>
      <h1 className="text-3xl font-bold text-ink mb-8">Monedero Escolar</h1>
      <div className="flex flex-col gap-3 w-full max-w-xs">
        <Link
          href="/consulta"
          className="px-5 py-3 rounded-xl bg-accent text-white font-medium"
        >
          Consultar saldo
        </Link>
        <Link
          href="/admin/login"
          className="px-5 py-3 rounded-xl border border-line text-ink font-medium"
        >
          Acceso cantinera
        </Link>
      </div>
    </main>
  );
}
