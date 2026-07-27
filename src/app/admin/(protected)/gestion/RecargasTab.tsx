"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { formatUsd } from "@/lib/format";
import { Avatar } from "@/components/Avatar";
import type { MetodoPago, Persona } from "@/types/database";

const metodos: MetodoPago[] = ["Efectivo", "Transferencia", "Pago móvil"];

export function RecargasTab() {
  const supabase = useMemo(() => createClient(), []);
  const [tasaBcv, setTasaBcv] = useState(0);
  const [query, setQuery] = useState("");
  const [resultados, setResultados] = useState<Persona[]>([]);
  const [persona, setPersona] = useState<Persona | null>(null);
  const [montoBs, setMontoBs] = useState("");
  const [metodo, setMetodo] = useState<MetodoPago>("Efectivo");
  const [referencia, setReferencia] = useState("");
  const [procesando, setProcesando] = useState(false);
  const [mensaje, setMensaje] = useState<{ tipo: "ok" | "error"; texto: string } | null>(null);

  useEffect(() => {
    async function cargarTasa() {
      const { data } = await supabase
        .from("configuracion")
        .select("tasa_bcv")
        .eq("id", 1)
        .maybeSingle();
      setTasaBcv(data?.tasa_bcv ?? 0);
    }
    cargarTasa();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const requiereReferencia = metodo !== "Efectivo";
  const montoUsdEquivalente =
    tasaBcv > 0 && montoBs.trim() ? parseFloat(montoBs) / tasaBcv : null;

  async function buscar(e: React.FormEvent) {
    e.preventDefault();
    const q = query.trim();
    if (!q) return;

    const isCarnet = /^\d{1,4}$/.test(q);
    const request = isCarnet
      ? supabase.from("personas").select("*").eq("id", q.padStart(4, "0")).limit(1)
      : supabase.from("personas").select("*").ilike("nombre", `%${q}%`).limit(8);

    const { data } = await request;
    setResultados((data ?? []) as Persona[]);
  }

  function seleccionar(p: Persona) {
    setPersona(p);
    setResultados([]);
    setQuery("");
    setMensaje(null);
  }

  async function recargar(e: React.FormEvent) {
    e.preventDefault();
    if (!persona) return;

    const valorBs = parseFloat(montoBs);
    if (isNaN(valorBs) || valorBs <= 0) {
      setMensaje({ tipo: "error", texto: "Ingresa un monto válido." });
      return;
    }
    if (!tasaBcv || tasaBcv <= 0) {
      setMensaje({ tipo: "error", texto: "No se pudo cargar la tasa BCV. Intenta de nuevo." });
      return;
    }
    if (requiereReferencia && !referencia.trim()) {
      setMensaje({ tipo: "error", texto: "El número de referencia es obligatorio para Transferencia o Pago móvil." });
      return;
    }

    const valorUsd = Math.round((valorBs / tasaBcv) * 100) / 100;

    setProcesando(true);
    const { data, error } = await supabase.rpc("fn_registrar_recarga", {
      p_persona_id: persona.id,
      p_monto_usd: valorUsd,
      p_metodo: metodo,
    });

    if (error) {
      setProcesando(false);
      setMensaje({ tipo: "error", texto: error.message });
      return;
    }

    const resultado = Array.isArray(data) ? data[0] : data;

    if (requiereReferencia) {
      const { error: refError } = await supabase
        .from("transacciones")
        .update({ referencia: referencia.trim() })
        .eq("id", resultado.nueva_transaccion_id);

      if (refError) {
        setProcesando(false);
        setMensaje({ tipo: "error", texto: `Recarga registrada, pero no se pudo guardar la referencia: ${refError.message}` });
        return;
      }
    }

    setProcesando(false);
    setPersona({ ...persona, saldo_usd: resultado.nuevo_saldo });
    setMontoBs("");
    setReferencia("");
    setMensaje({ tipo: "ok", texto: `Recarga registrada. Nuevo saldo: ${formatUsd(resultado.nuevo_saldo)}` });
  }

  return (
    <div className="flex flex-col gap-4 max-w-sm">
      <form onSubmit={buscar} className="flex gap-2">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Buscar por carnet o nombre..."
          className="flex-1 py-2.5 px-3 rounded-lg border border-line bg-paper-raised text-sm"
        />
        <button type="submit" className="px-4 rounded-lg bg-accent text-white text-sm font-medium">
          Buscar
        </button>
      </form>

      {resultados.length > 0 && (
        <ul className="ticket divide-y divide-line overflow-hidden">
          {resultados.map((p) => (
            <li key={p.id}>
              <button
                onClick={() => seleccionar(p)}
                className="w-full flex items-center gap-3 p-3 text-left hover:bg-paper"
              >
                <Avatar fotoUrl={p.foto_url} nombre={p.nombre} size="sm" />
                <div>
                  <p className="text-sm font-medium text-ink">{p.nombre}</p>
                  <p className="text-xs text-ink-soft">Carnet {p.id}</p>
                </div>
              </button>
            </li>
          ))}
        </ul>
      )}

      {persona && (
        <div className="ticket p-4">
          <div className="flex items-center gap-3 mb-4">
            <Avatar fotoUrl={persona.foto_url} nombre={persona.nombre} size="md" />
            <div>
              <p className="font-medium text-ink">{persona.nombre}</p>
              <p className="text-xs text-ink-soft">Saldo actual: {formatUsd(persona.saldo_usd)}</p>
            </div>
          </div>

          <form onSubmit={recargar} className="flex flex-col gap-3">
            <div>
              <label className="text-xs text-ink-soft block mb-1">Monto a recargar (Bs)</label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={montoBs}
                onChange={(e) => setMontoBs(e.target.value)}
                className="w-full py-2.5 px-3 rounded-lg border border-line bg-paper text-sm font-ticket"
              />
              {montoUsdEquivalente !== null && !isNaN(montoUsdEquivalente) && (
                <p className="text-xs text-ink-soft mt-1">
                  Equivale a {formatUsd(montoUsdEquivalente)}
                </p>
              )}
            </div>
            <div>
              <label className="text-xs text-ink-soft block mb-1">Método de pago</label>
              <select
                value={metodo}
                onChange={(e) => setMetodo(e.target.value as MetodoPago)}
                className="w-full py-2.5 px-3 rounded-lg border border-line bg-paper text-sm"
              >
                {metodos.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
            </div>
            {requiereReferencia && (
              <div>
                <label className="text-xs text-ink-soft block mb-1">Número de referencia</label>
                <input
                  value={referencia}
                  onChange={(e) => setReferencia(e.target.value)}
                  className="w-full py-2.5 px-3 rounded-lg border border-line bg-paper text-sm font-ticket"
                />
              </div>
            )}
            <button
              type="submit"
              disabled={procesando}
              className="py-2.5 rounded-lg bg-accent text-white text-sm font-medium disabled:opacity-60"
            >
              {procesando ? "Procesando..." : "Registrar recarga"}
            </button>
          </form>
        </div>
      )}

      {mensaje && (
        <p className={`text-sm ${mensaje.tipo === "ok" ? "text-credit" : "text-debt"}`}>
          {mensaje.texto}
        </p>
      )}
    </div>
  );
}
