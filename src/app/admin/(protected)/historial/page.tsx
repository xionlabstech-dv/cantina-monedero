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

type FiltroTipo = "todo" | "venta" | "recarga";
type RangoTipo = "hoy" | "semana" | "mes" | "personalizado";

const rangoLabels: Record<RangoTipo, string> = {
  hoy: "Hoy",
  semana: "Esta semana",
  mes: "Este mes",
  personalizado: "Rango personalizado",
};

function fechaISOLocal(d: Date): string {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

export default function HistorialPage() {
  const supabase = useMemo(() => createClient(), []);
  const [movimientos, setMovimientos] = useState<MovimientoRow[]>([]);
  const [cargando, setCargando] = useState(true);
  const [mensaje, setMensaje] = useState<string | null>(null);

  const [filtroTipo, setFiltroTipo] = useState<FiltroTipo>("todo");
  const [rangoTipo, setRangoTipo] = useState<RangoTipo>("hoy");
  const [fechaInicioPersonalizada, setFechaInicioPersonalizada] = useState(() =>
    fechaISOLocal(new Date())
  );
  const [fechaFinPersonalizada, setFechaFinPersonalizada] = useState(() =>
    fechaISOLocal(new Date())
  );
  const [busqueda, setBusqueda] = useState("");

  function rangoActual(): { inicio: Date; fin: Date | null } | null {
    if (rangoTipo === "hoy") {
      const inicio = new Date();
      inicio.setHours(0, 0, 0, 0);
      return { inicio, fin: null };
    }
    if (rangoTipo === "semana") {
      const inicio = new Date();
      const dia = inicio.getDay();
      const diasDesdeElLunes = dia === 0 ? 6 : dia - 1;
      inicio.setDate(inicio.getDate() - diasDesdeElLunes);
      inicio.setHours(0, 0, 0, 0);
      return { inicio, fin: null };
    }
    if (rangoTipo === "mes") {
      const ahora = new Date();
      const inicio = new Date(ahora.getFullYear(), ahora.getMonth(), 1, 0, 0, 0, 0);
      return { inicio, fin: null };
    }
    if (!fechaInicioPersonalizada || !fechaFinPersonalizada) return null;
    const inicio = new Date(`${fechaInicioPersonalizada}T00:00:00`);
    const fin = new Date(`${fechaFinPersonalizada}T23:59:59.999`);
    if (Number.isNaN(inicio.getTime()) || Number.isNaN(fin.getTime())) return null;
    return { inicio, fin };
  }

  async function cargar() {
    const rango = rangoActual();
    if (!rango) {
      setMovimientos([]);
      setCargando(false);
      return;
    }

    setCargando(true);
    let consulta = supabase
      .from("transacciones")
      .select("*, personas(nombre)")
      .gte("created_at", rango.inicio.toISOString())
      .order("created_at", { ascending: false });

    if (rango.fin) {
      consulta = consulta.lte("created_at", rango.fin.toISOString());
    }

    const { data } = await consulta;
    setMovimientos((data ?? []) as unknown as MovimientoRow[]);
    setCargando(false);
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    cargar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rangoTipo, fechaInicioPersonalizada, fechaFinPersonalizada]);

  async function deshacer(id: string) {
    setMensaje(null);
    const { error } = await supabase.rpc("fn_deshacer_transaccion", { p_transaccion_id: id });
    if (error) {
      setMensaje(error.message);
      return;
    }
    cargar();
  }

  const busquedaNormalizada = busqueda.trim().toLowerCase();
  const movimientosEnRango = movimientos.filter((m) => {
    if (!busquedaNormalizada) return true;
    const nombre = m.personas?.nombre?.toLowerCase() ?? "";
    const detalle = m.detalle?.toLowerCase() ?? "";
    return (
      nombre.includes(busquedaNormalizada) ||
      m.persona_id.includes(busquedaNormalizada) ||
      detalle.includes(busquedaNormalizada)
    );
  });

  const activos = movimientosEnRango.filter((m) => !m.anulada);
  const totalVentas = activos
    .filter((m) => m.tipo === "venta")
    .reduce((acc, m) => acc + Math.abs(m.monto_usd), 0);
  const totalRecargas = activos
    .filter((m) => m.tipo === "recarga")
    .reduce((acc, m) => acc + m.monto_usd, 0);

  const movimientosFiltrados = movimientosEnRango.filter(
    (m) => filtroTipo === "todo" || m.tipo === filtroTipo
  );

  function exportarXlsx() {
    const filas = movimientosFiltrados.map((m) => ({
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
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-xl font-bold text-ink">Historial</h1>
          <p className="text-sm text-ink-soft">{rangoLabels[rangoTipo]} · movimientos filtrados.</p>
        </div>
        <button
          onClick={exportarXlsx}
          disabled={movimientosFiltrados.length === 0}
          className="px-4 py-2 rounded-lg bg-accent text-white text-sm font-medium disabled:opacity-50 shrink-0 whitespace-nowrap"
        >
          Exportar .xlsx
        </button>
      </div>

      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap gap-2">
          {(["hoy", "semana", "mes", "personalizado"] as const).map((r) => (
            <button
              key={r}
              onClick={() => setRangoTipo(r)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium border ${
                rangoTipo === r
                  ? "bg-accent text-white border-accent"
                  : "border-line text-ink-soft hover:bg-paper"
              }`}
            >
              {rangoLabels[r]}
            </button>
          ))}
        </div>

        {rangoTipo === "personalizado" && (
          <div className="flex flex-wrap items-center gap-2">
            <input
              type="date"
              value={fechaInicioPersonalizada}
              onChange={(e) => setFechaInicioPersonalizada(e.target.value)}
              className="py-2 px-2.5 rounded-lg border border-line bg-paper-raised text-sm"
            />
            <span className="text-xs text-ink-soft">a</span>
            <input
              type="date"
              value={fechaFinPersonalizada}
              onChange={(e) => setFechaFinPersonalizada(e.target.value)}
              className="py-2 px-2.5 rounded-lg border border-line bg-paper-raised text-sm"
            />
          </div>
        )}

        <div className="flex gap-2">
          {(["todo", "venta", "recarga"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setFiltroTipo(t)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium border ${
                filtroTipo === t
                  ? "bg-accent text-white border-accent"
                  : "border-line text-ink-soft hover:bg-paper"
              }`}
            >
              {t === "todo" ? "Todo" : t === "venta" ? "Ventas" : "Recargas"}
            </button>
          ))}
        </div>

        <input
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          placeholder="Buscar por carnet, nombre o producto..."
          className="py-2.5 px-3 rounded-lg border border-line bg-paper-raised text-sm"
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className={`ticket p-4 ${filtroTipo === "recarga" ? "opacity-40" : ""}`}>
          <p className="text-xs text-ink-soft mb-1">Total ventas</p>
          <p className="font-ticket text-xl font-bold text-debt">{formatUsd(totalVentas)}</p>
        </div>
        <div className={`ticket p-4 ${filtroTipo === "venta" ? "opacity-40" : ""}`}>
          <p className="text-xs text-ink-soft mb-1">Total recargas</p>
          <p className="font-ticket text-xl font-bold text-credit">{formatUsd(totalRecargas)}</p>
        </div>
      </div>

      {mensaje && <p className="text-sm text-debt">{mensaje}</p>}

      {cargando ? (
        <p className="text-sm text-ink-soft">Cargando...</p>
      ) : (
        <ul className="ticket divide-y divide-line overflow-hidden">
          {movimientosFiltrados.map((m) => (
            <li
              key={m.id}
              className={`p-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3 ${
                m.anulada ? "opacity-40" : ""
              }`}
            >
              <div className="flex items-center gap-3 flex-1 min-w-0">
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
                  className={`font-ticket text-base font-bold shrink-0 ${
                    m.monto_usd < 0 ? "text-debt" : "text-credit"
                  }`}
                >
                  {formatUsd(Math.abs(m.monto_usd))}
                </span>
              </div>
              {!m.anulada && (
                <div className="flex items-center gap-2 sm:shrink-0">
                  <button
                    onClick={() => deshacer(m.id)}
                    className="px-3 py-1.5 rounded-lg border border-line text-xs font-medium text-ink-soft hover:bg-paper shrink-0"
                  >
                    Deshacer
                  </button>
                </div>
              )}
            </li>
          ))}
          {movimientosFiltrados.length === 0 && (
            <p className="p-4 text-sm text-ink-soft">No hay movimientos que coincidan con el filtro.</p>
          )}
        </ul>
      )}
    </div>
  );
}
