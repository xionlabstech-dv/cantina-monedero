"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Producto } from "@/types/database";

export default function InventarioPage() {
  const supabase = useMemo(() => createClient(), []);
  const [productos, setProductos] = useState<Producto[]>([]);
  const [cargando, setCargando] = useState(true);
  const [nuevo, setNuevo] = useState({ nombre: "", precio_usd: "", stock: "", umbral_stock: "5" });
  const [error, setError] = useState<string | null>(null);

  async function cargar() {
    setCargando(true);
    const { data } = await supabase
      .from("productos")
      .select("*")
      .order("activo", { ascending: false })
      .order("nombre");
    setProductos((data ?? []) as Producto[]);
    setCargando(false);
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    cargar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function crearProducto(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const precio = parseFloat(nuevo.precio_usd);
    const stock = parseInt(nuevo.stock, 10);
    const umbral = parseInt(nuevo.umbral_stock, 10);

    if (!nuevo.nombre.trim() || isNaN(precio) || isNaN(stock)) {
      setError("Completa nombre, precio y stock.");
      return;
    }

    const { error } = await supabase.from("productos").insert({
      nombre: nuevo.nombre.trim(),
      precio_usd: precio,
      stock,
      umbral_stock: isNaN(umbral) ? 5 : umbral,
    });

    if (error) {
      setError(error.message);
      return;
    }

    setNuevo({ nombre: "", precio_usd: "", stock: "", umbral_stock: "5" });
    cargar();
  }

  async function actualizarCampo(id: string, campo: keyof Producto, valor: string | number | boolean) {
    setProductos((prev) => prev.map((p) => (p.id === id ? { ...p, [campo]: valor } : p)));
    await supabase.from("productos").update({ [campo]: valor }).eq("id", id);
  }

  async function eliminar(id: string) {
    if (!confirm("¿Eliminar este producto? Esta acción no se puede deshacer.")) return;
    await supabase.from("productos").delete().eq("id", id);
    setProductos((prev) => prev.filter((p) => p.id !== id));
  }

  return (
    <div className="flex flex-col gap-6 max-w-3xl">
      <div>
        <h1 className="text-xl font-bold text-ink mb-1">Inventario</h1>
        <p className="text-sm text-ink-soft">Precios en USD. El bolívar se calcula con la tasa BCV vigente.</p>
      </div>

      <form onSubmit={crearProducto} className="ticket p-4 grid grid-cols-2 sm:grid-cols-5 gap-2 items-end">
        <div className="col-span-2 sm:col-span-1">
          <label className="text-xs text-ink-soft block mb-1">Nombre</label>
          <input
            value={nuevo.nombre}
            onChange={(e) => setNuevo({ ...nuevo, nombre: e.target.value })}
            className="w-full py-2 px-2.5 rounded-lg border border-line bg-paper-raised text-sm"
          />
        </div>
        <div>
          <label className="text-xs text-ink-soft block mb-1">Precio USD</label>
          <input
            type="number"
            step="0.01"
            min="0"
            value={nuevo.precio_usd}
            onChange={(e) => setNuevo({ ...nuevo, precio_usd: e.target.value })}
            className="w-full py-2 px-2.5 rounded-lg border border-line bg-paper-raised text-sm"
          />
        </div>
        <div>
          <label className="text-xs text-ink-soft block mb-1">Stock</label>
          <input
            type="number"
            min="0"
            value={nuevo.stock}
            onChange={(e) => setNuevo({ ...nuevo, stock: e.target.value })}
            className="w-full py-2 px-2.5 rounded-lg border border-line bg-paper-raised text-sm"
          />
        </div>
        <div>
          <label className="text-xs text-ink-soft block mb-1">Umbral bajo</label>
          <input
            type="number"
            min="0"
            value={nuevo.umbral_stock}
            onChange={(e) => setNuevo({ ...nuevo, umbral_stock: e.target.value })}
            className="w-full py-2 px-2.5 rounded-lg border border-line bg-paper-raised text-sm"
          />
        </div>
        <button
          type="submit"
          className="py-2 rounded-lg bg-accent text-white text-sm font-medium"
        >
          Agregar
        </button>
      </form>
      {error && <p className="text-sm text-debt -mt-4">{error}</p>}

      {cargando ? (
        <p className="text-sm text-ink-soft">Cargando...</p>
      ) : (
        <div className="ticket divide-y divide-line overflow-hidden">
          {productos.map((p) => {
            const bajoStock = p.stock <= p.umbral_stock;
            return (
              <div
                key={p.id}
                className={`p-3 flex flex-wrap items-center gap-3 ${!p.activo ? "opacity-50" : ""}`}
              >
                <input
                  defaultValue={p.nombre}
                  onBlur={(e) => e.target.value !== p.nombre && actualizarCampo(p.id, "nombre", e.target.value)}
                  className="flex-1 min-w-[120px] py-1.5 px-2 rounded-md border border-transparent hover:border-line focus:border-line bg-transparent text-sm font-medium text-ink"
                />
                <div className="flex items-center gap-1">
                  <span className="text-xs text-ink-soft">$</span>
                  <input
                    type="number"
                    step="0.01"
                    defaultValue={p.precio_usd}
                    onBlur={(e) => {
                      const v = parseFloat(e.target.value);
                      if (!isNaN(v) && v !== p.precio_usd) actualizarCampo(p.id, "precio_usd", v);
                    }}
                    className="w-20 py-1.5 px-2 rounded-md border border-transparent hover:border-line focus:border-line bg-transparent text-sm font-ticket"
                  />
                </div>
                <div className="flex items-center gap-1">
                  <span className={`text-xs ${bajoStock ? "text-debt" : "text-ink-soft"}`}>Stock</span>
                  <input
                    type="number"
                    defaultValue={p.stock}
                    onBlur={(e) => {
                      const v = parseInt(e.target.value, 10);
                      if (!isNaN(v) && v !== p.stock) actualizarCampo(p.id, "stock", v);
                    }}
                    className={`w-16 py-1.5 px-2 rounded-md border ${
                      bajoStock ? "border-debt/40 text-debt" : "border-transparent hover:border-line"
                    } focus:border-line bg-transparent text-sm font-ticket`}
                  />
                  {bajoStock && (
                    <span className="text-xs px-1.5 py-0.5 rounded-full bg-debt-soft text-debt">
                      bajo
                    </span>
                  )}
                </div>
                <button
                  onClick={() => actualizarCampo(p.id, "activo", !p.activo)}
                  className="text-xs text-ink-soft hover:text-ink"
                >
                  {p.activo ? "Desactivar" : "Activar"}
                </button>
                <button
                  onClick={() => eliminar(p.id)}
                  className="text-xs text-debt"
                >
                  Eliminar
                </button>
              </div>
            );
          })}
          {productos.length === 0 && (
            <p className="p-4 text-sm text-ink-soft">No hay productos todavía.</p>
          )}
        </div>
      )}
    </div>
  );
}
