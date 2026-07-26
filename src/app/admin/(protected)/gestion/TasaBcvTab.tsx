"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { formatDateTime } from "@/lib/format";

export function TasaBcvTab() {
  const supabase = useMemo(() => createClient(), []);
  const [tasaActual, setTasaActual] = useState<number | null>(null);
  const [actualizadaEn, setActualizadaEn] = useState<string | null>(null);
  const [nuevaTasa, setNuevaTasa] = useState("");
  const [guardando, setGuardando] = useState(false);
  const [mensaje, setMensaje] = useState<string | null>(null);

  async function cargar() {
    const { data } = await supabase
      .from("configuracion")
      .select("tasa_bcv, tasa_actualizada_en")
      .eq("id", 1)
      .maybeSingle();
    if (data) {
      setTasaActual(data.tasa_bcv);
      setActualizadaEn(data.tasa_actualizada_en);
    }
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    cargar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function guardar(e: React.FormEvent) {
    e.preventDefault();
    const valor = parseFloat(nuevaTasa);
    if (isNaN(valor) || valor <= 0) {
      setMensaje("Ingresa una tasa válida.");
      return;
    }
    setGuardando(true);
    const { error } = await supabase
      .from("configuracion")
      .update({ tasa_bcv: valor, tasa_actualizada_en: new Date().toISOString() })
      .eq("id", 1);
    setGuardando(false);

    if (error) {
      setMensaje(error.message);
      return;
    }
    setNuevaTasa("");
    setMensaje("Tasa actualizada.");
    cargar();
  }

  return (
    <div className="ticket p-5 max-w-sm">
      <p className="text-sm text-ink-soft mb-1">Tasa BCV vigente</p>
      <p className="font-ticket text-3xl font-bold text-ink mb-1">
        {tasaActual !== null ? tasaActual.toFixed(2) : "—"}
      </p>
      {actualizadaEn && (
        <p className="text-xs text-ink-soft mb-5">
          Actualizada el {formatDateTime(actualizadaEn)}
        </p>
      )}

      <form onSubmit={guardar} className="flex gap-2">
        <input
          type="number"
          step="0.0001"
          min="0"
          value={nuevaTasa}
          onChange={(e) => setNuevaTasa(e.target.value)}
          placeholder="Nueva tasa"
          className="flex-1 py-2.5 px-3 rounded-lg border border-line bg-paper text-sm"
        />
        <button
          type="submit"
          disabled={guardando}
          className="px-4 rounded-lg bg-accent text-white text-sm font-medium disabled:opacity-60"
        >
          Guardar
        </button>
      </form>
      {mensaje && <p className="text-sm text-ink-soft mt-2">{mensaje}</p>}
    </div>
  );
}
