"use client";

import { useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { formatBs, formatTime, formatUsd } from "@/lib/format";
import { CreditBar } from "@/components/CreditBar";
import { Avatar } from "@/components/Avatar";
import type { PersonaPublico, Transaccion } from "@/types/database";

type Estado = "idle" | "buscando" | "no-encontrado" | "encontrado" | "error";

const SEGUNDOS_AUTO_OCULTAR = 20;

export default function ConsultaPage() {
  const supabaseRef = useRef<ReturnType<typeof createClient> | null>(null);
  function getSupabase() {
    if (!supabaseRef.current) supabaseRef.current = createClient();
    return supabaseRef.current;
  }

  const [carnet, setCarnet] = useState("");
  const [estado, setEstado] = useState<Estado>("idle");
  const [persona, setPersona] = useState<PersonaPublico | null>(null);
  const [movimientosHoy, setMovimientosHoy] = useState<Transaccion[]>([]);
  const [tasaBcv, setTasaBcv] = useState<number>(0);
  const [segundosRestantes, setSegundosRestantes] = useState(SEGUNDOS_AUTO_OCULTAR);

  useEffect(() => {
    if (estado !== "encontrado") return;

    const interval = setInterval(() => {
      setSegundosRestantes((s) => {
        if (s <= 1) {
          clearInterval(interval);
          setPersona(null);
          setMovimientosHoy([]);
          setEstado("idle");
          setCarnet("");
          return SEGUNDOS_AUTO_OCULTAR;
        }
        return s - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [estado]);

  function reiniciarAutoOcultar() {
    if (estado === "encontrado") setSegundosRestantes(SEGUNDOS_AUTO_OCULTAR);
  }

  async function buscar(e: React.FormEvent) {
    e.preventDefault();
    const id = carnet.trim();
    if (!/^\d{4}$/.test(id)) {
      setEstado("error");
      return;
    }

    setEstado("buscando");

    const supabase = getSupabase();
    const [{ data: personaData, error: personaError }, { data: configData }] =
      await Promise.all([
        supabase.from("personas_publico").select("*").eq("id", id).maybeSingle(),
        supabase.from("configuracion").select("tasa_bcv").eq("id", 1).maybeSingle(),
      ]);

    if (personaError || !personaData) {
      setEstado("no-encontrado");
      setPersona(null);
      return;
    }

    setTasaBcv(configData?.tasa_bcv ?? 0);
    setPersona(personaData as PersonaPublico);

    const { data: movs } = await supabase
      .from("transacciones_publico_hoy")
      .select("*")
      .eq("persona_id", id)
      .order("created_at", { ascending: false });

    setMovimientosHoy((movs ?? []) as Transaccion[]);
    setSegundosRestantes(SEGUNDOS_AUTO_OCULTAR);
    setEstado("encontrado");
  }

  const consumoHoy = movimientosHoy
    .filter((m) => m.tipo === "venta")
    .reduce((acc, m) => acc + Math.abs(m.monto_usd), 0);

  return (
    <main className="flex-1 flex flex-col items-center px-4 py-10 sm:py-16">
      <div className="w-full max-w-sm">
        <header className="text-center mb-8">
          <p className="font-ticket text-xs tracking-widest text-accent uppercase mb-1">
            Cantina Escolar
          </p>
          <h1 className="text-2xl font-bold text-ink">Consulta tu saldo</h1>
          <p className="text-sm text-ink-soft mt-1">
            Ingresa tu número de carnet (4 dígitos)
          </p>
        </header>

        <form onSubmit={buscar} className="flex gap-2 mb-6">
          <input
            value={carnet}
            onChange={(e) => {
              setCarnet(e.target.value.replace(/\D/g, "").slice(0, 4));
              reiniciarAutoOcultar();
            }}
            placeholder="0000"
            inputMode="numeric"
            maxLength={4}
            className="font-ticket flex-1 text-center text-xl tracking-[0.3em] py-3 rounded-xl border border-line bg-paper-raised focus:outline-none focus:ring-2 focus:ring-accent"
          />
          <button
            type="submit"
            disabled={estado === "buscando"}
            className="px-5 rounded-xl bg-accent text-white font-medium disabled:opacity-60"
          >
            Buscar
          </button>
        </form>

        {estado === "error" && (
          <p className="text-center text-sm text-debt mb-4">
            El carnet debe tener 4 dígitos.
          </p>
        )}
        {estado === "no-encontrado" && (
          <p className="text-center text-sm text-debt mb-4">
            No encontramos ese carnet. Verifica el número.
          </p>
        )}

        {estado === "encontrado" && persona && (
          <div
            className="ticket overflow-hidden"
            onScroll={reiniciarAutoOcultar}
            onClick={reiniciarAutoOcultar}
            onTouchStart={reiniciarAutoOcultar}
          >
            <div className="h-1 bg-line">
              <div
                className="h-full bg-accent transition-[width] duration-1000 ease-linear"
                style={{ width: `${(segundosRestantes / SEGUNDOS_AUTO_OCULTAR) * 100}%` }}
              />
            </div>

            <div className="p-5">
              <div className="flex items-center gap-3 mb-5">
                <Avatar fotoUrl={persona.foto_url} nombre={persona.nombre} size="lg" />
                <div>
                  <h2 className="font-semibold text-ink leading-tight">{persona.nombre}</h2>
                  <p className="text-xs text-ink-soft">
                    {persona.tipo}
                    {persona.grado_cargo ? ` · ${persona.grado_cargo}` : ""}
                  </p>
                  <p className="font-ticket text-xs text-ink-soft mt-0.5">
                    Carnet {persona.id}
                  </p>
                </div>
              </div>

              <CreditBar saldoUsd={persona.saldo_usd} limiteCreditoUsd={persona.limite_credito_usd} />

              {tasaBcv > 0 && (
                <p className="text-xs text-ink-soft mt-3">
                  Equivale a {formatBs(Math.abs(persona.saldo_usd), tasaBcv)} · Tasa BCV:{" "}
                  {tasaBcv.toFixed(2)}
                </p>
              )}

              <div className="ticket-dashed mt-5 pt-4">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-sm font-medium text-ink">Consumo de hoy</h3>
                  {consumoHoy > 0 && (
                    <span className="font-ticket text-sm text-ink-soft">
                      {formatUsd(-consumoHoy)}
                    </span>
                  )}
                </div>

                {movimientosHoy.length === 0 ? (
                  <p className="text-sm text-ink-soft">Sin movimientos hoy.</p>
                ) : (
                  <ul className="space-y-2">
                    {movimientosHoy.map((m) => (
                      <li key={m.id} className="flex items-center justify-between text-sm">
                        <div>
                          <p className="text-ink">
                            {m.tipo === "venta" ? m.detalle || "Compra" : "Recarga"}
                          </p>
                          <p className="text-xs text-ink-soft">{formatTime(m.created_at)}</p>
                        </div>
                        <span
                          className={`font-ticket ${
                            m.monto_usd < 0 ? "text-debt" : "text-credit"
                          }`}
                        >
                          {formatUsd(m.monto_usd)}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <p className="text-center text-xs text-ink-soft mt-5">
                Por privacidad, este resultado se oculta en {segundosRestantes}s
              </p>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
