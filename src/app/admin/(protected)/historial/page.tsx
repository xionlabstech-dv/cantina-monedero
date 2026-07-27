"use client";

import { useEffect, useMemo, useState } from "react";
import * as XLSX from "xlsx";
import { createClient } from "@/lib/supabase/client";
import { formatDateTime, formatUsd } from "@/lib/format";

interface MovimientoRow {
  id: string;
  persona_id: string;
  tipo: "venta" | "recarga";
  monto_usd: number;
  detalle: string | null;
  metodo_pago: string | null;
  referencia: string | null;
  anulada: boolean;
  created_at: string;
  personas: { nombre: string } | null;
}

export default function HistorialPage() {
  const supabase = useMemo(() => createClient(), []);
  const [movimientos, setMovimientos] = useState<MovimientoRow[]>([]);
  const [cargando, setCargando] = useState(true);
  const [mensaje, setMensaje] = useState<string | null>(null);

  async function cargar() {
    setCargando(true);
    const inicioDelDia = new Date();
    inicioDelDia.setHours(0, 0, 0, 0);

    const { data } = await supabase
      .from("transacciones")
      .select("*, personas(nombre)")
      .gte("created_at", inicioDelDia.toISOString())
      .order("created_at", { ascending: false });

    setMovimientos((data ?? []) as unknown as MovimientoRow[]);
    setCargando(false);
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    cargar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function deshacer(id: string) {
    setMensaje(null);
    const { error } = await supabase.rpc("fn_deshacer_transaccion", { p_transaccion_id: id });
    if (error) {
      setMensaje(error.message);
      return;
    }
    cargar();
  }

  const activos = movimientos.filter((m) => !m.anulada);
  const totalVentas = activos
    .filter((m) => m.tipo === "venta")
    .reduce((acc, m) => acc + Math.abs(m.monto_usd), 0);
  const totalRecargas = activos
    .filter((m) => m.tipo === "recarga")
    .reduce((acc, m) => acc + m.monto_usd, 0);

  function exportarXlsx() {
    const filas = movimientos.map((m) => ({
      Fecha: formatDateTime(m.created_at),
      Persona: m.personas?.nombre ?? m.persona_id,
      Carnet: m.persona_id,
      Tipo: m.tipo === "venta" ? "Venta" : "Recarga",
      Detalle: m.detalle ?? (m.tipo === "recarga" ? m.metodo_pago ?? "" : ""),
      Referencia: m.referencia ?? "",
      "Monto USD": m.monto_usd,
      Anulada: m.anulada ? "Sí" : "No",
    }));

    const hoja = XLSX.utils.json_to_sheet(filas);
    hoja["!cols"] = [
      { wch: 16 },
      { wch: 24 },
      { wch: 8 },
      { wch: 10 },
      { wch: 30 },
      { wch: 16 },
      { wch: 12 },
      { wch: 10 },
    ];

    const libro = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(libro, hoja, "Historial");

    const fecha = new Date().toISOString().slice(0, 10);
    XLSX.writeFile(libro, `historial-cantina-${fecha}.xlsx`);
  }

  return (
    <div className="flex flex-col gap-6 max-w-3xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-ink">Historial de hoy</h1>
          <p className="text-sm text-ink-soft">Movimientos del día actual.</p>
        </div>
        <button
          onClick={exportarXlsx}
          disabled={movimientos.length === 0}
          className="px-4 py-2 rounded-lg bg-accent text-white text-sm font-medium disabled:opacity-50"
        >
          Exportar .xlsx
        </button>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="ticket p-4">
          <p className="text-xs text-ink-soft mb-1">Total ventas</p>
          <p className="font-ticket text-xl font-bold text-debt">{formatUsd(-totalVentas)}</p>
        </div>
        <div className="ticket p-4">
          <p className="text-xs text-ink-soft mb-1">Total recargas</p>
          <p className="font-ticket text-xl font-bold text-credit">{formatUsd(totalRecargas)}</p>
        </div>
      </div>

      {mensaje && <p className="text-sm text-debt">{mensaje}</p>}

      {cargando ? (
        <p className="text-sm text-ink-soft">Cargando...</p>
      ) : (
        <ul className="ticket divide-y divide-line overflow-hidden">
          {movimientos.map((m) => (
            <li key={m.id} className={`p-3 flex items-center gap-3 ${m.anulada ? "opacity-40" : ""}`}>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-ink truncate">
                  {m.personas?.nombre ?? m.persona_id}{" "}
                  {m.anulada && <span className="text-xs text-debt">(anulada)</span>}
                </p>
                <p className="text-xs text-ink-soft">
                  {m.tipo === "venta" ? m.detalle || "Venta" : `Recarga · ${m.metodo_pago ?? ""}`} ·{" "}
                  {formatDateTime(m.created_at)}
                  {m.referencia && ` · Ref: ${m.referencia}`}
                </p>
              </div>
              <span
                className={`font-ticket text-sm shrink-0 ${
                  m.monto_usd < 0 ? "text-debt" : "text-credit"
                }`}
              >
                {formatUsd(m.monto_usd)}
              </span>
              {!m.anulada && (
                <button
                  onClick={() => deshacer(m.id)}
                  className="text-xs text-debt shrink-0"
                >
                  Deshacer
                </button>
              )}
            </li>
          ))}
          {movimientos.length === 0 && (
            <p className="p-4 text-sm text-ink-soft">No hay movimientos hoy.</p>
          )}
        </ul>
      )}
    </div>
  );
}
