"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { formatBs, formatUsd } from "@/lib/format";
import { buildWhatsAppLink } from "@/lib/whatsapp";
import { CreditBar } from "@/components/CreditBar";
import { Avatar } from "@/components/Avatar";
import { PhotoLightbox } from "@/components/PhotoLightbox";
import type { Persona, Producto } from "@/types/database";

interface CartItem {
  producto: Producto;
  cantidad: number;
}

export default function CajaPage() {
  const supabase = useMemo(() => createClient(), []);

  const [productos, setProductos] = useState<Producto[]>([]);
  const [tasaBcv, setTasaBcv] = useState(0);

  const [query, setQuery] = useState("");
  const [resultados, setResultados] = useState<Persona[]>([]);
  const [buscando, setBuscando] = useState(false);
  const [persona, setPersona] = useState<Persona | null>(null);

  const [cart, setCart] = useState<CartItem[]>([]);
  const [cobrando, setCobrando] = useState(false);
  const [mensaje, setMensaje] = useState<{ tipo: "ok" | "error"; texto: string } | null>(
    null
  );
  const [ultimaTxId, setUltimaTxId] = useState<string | null>(null);
  const [fotoAmpliada, setFotoAmpliada] = useState<string | null>(null);

  useEffect(() => {
    async function cargar() {
      const [{ data: prods }, { data: config }] = await Promise.all([
        supabase.from("productos").select("*").eq("activo", true).order("nombre"),
        supabase.from("configuracion").select("tasa_bcv").eq("id", 1).maybeSingle(),
      ]);
      setProductos((prods ?? []) as Producto[]);
      setTasaBcv(config?.tasa_bcv ?? 0);
    }
    cargar();
  }, [supabase]);

  async function buscar(e: React.FormEvent) {
    e.preventDefault();
    const q = query.trim();
    if (!q) return;
    setBuscando(true);
    setMensaje(null);

    const isCarnet = /^\d{1,4}$/.test(q);
    const request = isCarnet
      ? supabase.from("personas").select("*").eq("id", q.padStart(4, "0")).limit(1)
      : supabase.from("personas").select("*").ilike("nombre", `%${q}%`).limit(8);

    const { data } = await request;
    setResultados((data ?? []) as Persona[]);
    setBuscando(false);
  }

  function seleccionar(p: Persona) {
    setPersona(p);
    setResultados([]);
    setQuery("");
    setCart([]);
    setMensaje(null);
    setUltimaTxId(null);
  }

  function agregarProducto(prod: Producto) {
    setCart((prev) => {
      const existe = prev.find((i) => i.producto.id === prod.id);
      if (existe) {
        return prev.map((i) =>
          i.producto.id === prod.id ? { ...i, cantidad: i.cantidad + 1 } : i
        );
      }
      return [...prev, { producto: prod, cantidad: 1 }];
    });
  }

  function cambiarCantidad(prodId: string, delta: number) {
    setCart((prev) =>
      prev
        .map((i) =>
          i.producto.id === prodId ? { ...i, cantidad: i.cantidad + delta } : i
        )
        .filter((i) => i.cantidad > 0)
    );
  }

  const totalUsd = cart.reduce((acc, i) => acc + i.producto.precio_usd * i.cantidad, 0);

  async function cobrar() {
    if (!persona || cart.length === 0) return;
    setCobrando(true);
    setMensaje(null);

    const { data, error } = await supabase.rpc("fn_procesar_venta", {
      p_persona_id: persona.id,
      p_items: cart.map((i) => ({ producto_id: i.producto.id, cantidad: i.cantidad })),
    });

    setCobrando(false);

    if (error) {
      setMensaje({ tipo: "error", texto: error.message });
      return;
    }

    const resultado = Array.isArray(data) ? data[0] : data;
    setPersona({ ...persona, saldo_usd: resultado.nuevo_saldo });
    setProductos((prev) =>
      prev.map((p) => {
        const item = cart.find((i) => i.producto.id === p.id);
        return item ? { ...p, stock: p.stock - item.cantidad } : p;
      })
    );
    setUltimaTxId(resultado.nueva_transaccion_id);
    setCart([]);
    setMensaje({ tipo: "ok", texto: "Venta cobrada correctamente." });
  }

  async function deshacer() {
    if (!ultimaTxId || !persona) return;
    const { error } = await supabase.rpc("fn_deshacer_transaccion", {
      p_transaccion_id: ultimaTxId,
    });

    if (error) {
      setMensaje({ tipo: "error", texto: error.message });
      return;
    }

    const { data: personaActualizada } = await supabase
      .from("personas")
      .select("*")
      .eq("id", persona.id)
      .maybeSingle();

    if (personaActualizada) setPersona(personaActualizada as Persona);
    setUltimaTxId(null);
    setMensaje({ tipo: "ok", texto: "Venta deshecha." });
  }

  const mostrarWhatsapp =
    persona?.tipo === "Estudiante" &&
    !!persona.representante_telefono &&
    (persona.saldo_usd <= 0 ||
      persona.saldo_usd <= -persona.limite_credito_usd * 0.8);

  const whatsappLink =
    mostrarWhatsapp && persona?.representante_telefono
      ? buildWhatsAppLink(
          persona.representante_telefono,
          `Hola, le informamos que el saldo de ${persona.nombre} en la cantina está en ${formatBs(
            Math.abs(persona.saldo_usd),
            tasaBcv
          )}${persona.saldo_usd < 0 ? " (en deuda)" : ""}.`
        )
      : null;

  return (
    <>
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
      <div className="flex flex-col gap-6">
        <form onSubmit={buscar} className="flex gap-2">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar por carnet o nombre..."
            className="flex-1 py-2.5 px-3 rounded-lg border border-line bg-paper-raised focus:outline-none focus:ring-2 focus:ring-accent"
          />
          <button
            type="submit"
            disabled={buscando}
            className="px-4 rounded-lg bg-accent text-white font-medium disabled:opacity-60"
          >
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
                    <p className="text-xs text-ink-soft">
                      Carnet {p.id} · {p.tipo}
                    </p>
                  </div>
                </button>
              </li>
            ))}
          </ul>
        )}

        {productos.length > 0 && (
          <div>
            <h2 className="text-sm font-medium text-ink-soft mb-2">Menú</h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {productos.map((prod) => (
                <button
                  key={prod.id}
                  onClick={() => agregarProducto(prod)}
                  disabled={!persona || prod.stock <= 0}
                  className="ticket p-3 text-left disabled:opacity-40"
                >
                  <p className="text-sm font-medium text-ink">{prod.nombre}</p>
                  <p className="font-ticket text-sm text-accent">
                    {formatUsd(prod.precio_usd)}
                  </p>
                  <p className="text-xs text-ink-soft mt-0.5">
                    {tasaBcv > 0 ? formatBs(prod.precio_usd, tasaBcv) : ""}
                  </p>
                  <p className="text-xs text-ink-soft mt-1">Stock: {prod.stock}</p>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      <aside className="flex flex-col gap-4">
        {persona ? (
          <div className="ticket p-4">
            <div className="flex items-center gap-3 mb-4">
              <Avatar
                fotoUrl={persona.foto_url}
                nombre={persona.nombre}
                size="md"
                onClick={persona.foto_url ? () => setFotoAmpliada(persona.foto_url) : undefined}
              />
              <div>
                <p className="font-medium text-ink leading-tight">{persona.nombre}</p>
                <p className="text-xs text-ink-soft">
                  {persona.tipo}
                  {persona.grado_cargo ? ` · ${persona.grado_cargo}` : ""}
                </p>
              </div>
            </div>

            <CreditBar saldoUsd={persona.saldo_usd} limiteCreditoUsd={persona.limite_credito_usd} />

            {whatsappLink && (
              <a
                href={whatsappLink}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-4 block text-center text-sm py-2 rounded-lg bg-credit-soft text-credit font-medium"
              >
                Avisar por WhatsApp
              </a>
            )}
          </div>
        ) : (
          <div className="ticket p-4 text-sm text-ink-soft text-center">
            Busca una persona para iniciar una venta.
          </div>
        )}

        {cart.length > 0 && (
          <div className="ticket p-4">
            <h3 className="text-sm font-medium text-ink-soft mb-3">Carrito</h3>
            <ul className="flex flex-col gap-2 mb-4">
              {cart.map((item) => (
                <li key={item.producto.id} className="flex items-center justify-between text-sm">
                  <span className="text-ink">{item.producto.nombre}</span>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => cambiarCantidad(item.producto.id, -1)}
                      className="h-6 w-6 rounded-full border border-line text-ink-soft"
                    >
                      −
                    </button>
                    <span className="font-ticket w-4 text-center">{item.cantidad}</span>
                    <button
                      onClick={() => cambiarCantidad(item.producto.id, 1)}
                      className="h-6 w-6 rounded-full border border-line text-ink-soft"
                    >
                      +
                    </button>
                  </div>
                </li>
              ))}
            </ul>
            <div className="ticket-dashed pt-3 flex items-center justify-between mb-4">
              <span className="text-sm text-ink-soft">Total</span>
              <div className="text-right">
                <p className="font-ticket text-lg font-bold text-ink">
                  {formatUsd(totalUsd)}
                </p>
                {tasaBcv > 0 && (
                  <p className="text-xs text-ink-soft">{formatBs(totalUsd, tasaBcv)}</p>
                )}
              </div>
            </div>
            <button
              onClick={cobrar}
              disabled={cobrando}
              className="w-full py-2.5 rounded-lg bg-accent text-white font-medium disabled:opacity-60"
            >
              {cobrando ? "Cobrando..." : "Cobrar"}
            </button>
          </div>
        )}

        {ultimaTxId && (
          <button
            onClick={deshacer}
            className="text-sm text-debt text-center py-2 rounded-lg border border-debt/30"
          >
            Deshacer última venta
          </button>
        )}

        {mensaje && (
          <p
            className={`text-sm text-center ${
              mensaje.tipo === "ok" ? "text-credit" : "text-debt"
            }`}
          >
            {mensaje.texto}
          </p>
        )}
      </aside>
    </div>

    {fotoAmpliada && (
      <PhotoLightbox
        src={fotoAmpliada}
        alt={persona?.nombre ?? "Foto"}
        onClose={() => setFotoAmpliada(null)}
      />
    )}
    </>
  );
}
