"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { formatUsd } from "@/lib/format";
import { buildWhatsAppLink } from "@/lib/whatsapp";
import { Avatar } from "@/components/Avatar";
import type { Persona, TipoPersona } from "@/types/database";

const tipos: TipoPersona[] = ["Estudiante", "Docente", "Personal"];

const formVacio = {
  id: "",
  nombre: "",
  tipo: "Estudiante" as TipoPersona,
  grado_cargo: "",
  limite_credito_usd: "0",
  representante_nombre: "",
  representante_parentesco: "",
  representante_telefono: "",
  representante_email: "",
};

export function PersonasTab() {
  const supabase = useMemo(() => createClient(), []);
  const [personas, setPersonas] = useState<Persona[]>([]);
  const [cargando, setCargando] = useState(true);
  const [busqueda, setBusqueda] = useState("");

  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [form, setForm] = useState(formVacio);
  const [foto, setFoto] = useState<File | null>(null);
  const [fotoUrlActual, setFotoUrlActual] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mostrarForm, setMostrarForm] = useState(false);

  async function cargar() {
    setCargando(true);
    const { data } = await supabase.from("personas").select("*").order("nombre");
    setPersonas((data ?? []) as Persona[]);
    setCargando(false);
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    cargar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function nuevaPersona() {
    setEditandoId(null);
    setForm(formVacio);
    setFoto(null);
    setFotoUrlActual(null);
    setError(null);
    setMostrarForm(true);
  }

  function editarPersona(p: Persona) {
    setEditandoId(p.id);
    setForm({
      id: p.id,
      nombre: p.nombre,
      tipo: p.tipo,
      grado_cargo: p.grado_cargo ?? "",
      limite_credito_usd: String(p.limite_credito_usd),
      representante_nombre: p.representante_nombre ?? "",
      representante_parentesco: p.representante_parentesco ?? "",
      representante_telefono: p.representante_telefono ?? "",
      representante_email: p.representante_email ?? "",
    });
    setFoto(null);
    setFotoUrlActual(p.foto_url);
    setError(null);
    setMostrarForm(true);
  }

  async function subirFoto(personaId: string): Promise<string | null> {
    if (!foto) return fotoUrlActual;
    const ext = foto.name.split(".").pop();
    const path = `${personaId}-${Date.now()}.${ext}`;
    const { error: uploadError } = await supabase.storage
      .from("fotos-personas")
      .upload(path, foto, { upsert: true });
    if (uploadError) {
      throw uploadError;
    }
    const { data } = supabase.storage.from("fotos-personas").getPublicUrl(path);
    return data.publicUrl;
  }

  async function guardar(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!/^\d{4}$/.test(form.id)) {
      setError("El carnet debe tener exactamente 4 dígitos.");
      return;
    }
    if (!form.nombre.trim()) {
      setError("El nombre es obligatorio.");
      return;
    }

    setGuardando(true);
    try {
      const fotoUrl = await subirFoto(form.id);

      const payload = {
        id: form.id,
        nombre: form.nombre.trim(),
        tipo: form.tipo,
        grado_cargo: form.grado_cargo.trim() || null,
        limite_credito_usd: parseFloat(form.limite_credito_usd) || 0,
        foto_url: fotoUrl,
        representante_nombre: form.tipo === "Estudiante" ? form.representante_nombre.trim() || null : null,
        representante_parentesco:
          form.tipo === "Estudiante" ? form.representante_parentesco.trim() || null : null,
        representante_telefono:
          form.tipo === "Estudiante" ? form.representante_telefono.trim() || null : null,
        representante_email: form.tipo === "Estudiante" ? form.representante_email.trim() || null : null,
      };

      if (editandoId) {
        const { error } = await supabase.from("personas").update(payload).eq("id", editandoId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("personas").insert(payload);
        if (error) throw error;
      }

      setMostrarForm(false);
      cargar();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ocurrió un error al guardar.");
    } finally {
      setGuardando(false);
    }
  }

  async function toggleActivo(p: Persona) {
    await supabase.from("personas").update({ activo: !p.activo }).eq("id", p.id);
    setPersonas((prev) => prev.map((x) => (x.id === p.id ? { ...x, activo: !x.activo } : x)));
  }

  const filtradas = personas.filter(
    (p) =>
      p.nombre.toLowerCase().includes(busqueda.toLowerCase()) || p.id.includes(busqueda)
  );

  return (
    <div className="flex flex-col gap-4">
      <div className="flex gap-2">
        <input
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          placeholder="Buscar por carnet o nombre..."
          className="flex-1 py-2.5 px-3 rounded-lg border border-line bg-paper-raised text-sm"
        />
        <button
          onClick={nuevaPersona}
          className="px-4 rounded-lg bg-accent text-white text-sm font-medium"
        >
          + Nueva persona
        </button>
      </div>

      {mostrarForm && (
        <form onSubmit={guardar} className="ticket p-4 flex flex-col gap-3">
          <div className="flex items-center gap-3">
            <Avatar fotoUrl={foto ? URL.createObjectURL(foto) : fotoUrlActual} nombre={form.nombre || "?"} size="lg" />
            <div>
              <label className="text-xs text-ink-soft block mb-1">Foto</label>
              <input
                type="file"
                accept="image/*"
                onChange={(e) => setFoto(e.target.files?.[0] ?? null)}
                className="text-xs"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-ink-soft block mb-1">Carnet (4 dígitos)</label>
              <input
                value={form.id}
                disabled={!!editandoId}
                onChange={(e) => setForm({ ...form, id: e.target.value.replace(/\D/g, "").slice(0, 4) })}
                className="w-full py-2 px-2.5 rounded-lg border border-line bg-paper text-sm font-ticket disabled:opacity-60"
              />
            </div>
            <div>
              <label className="text-xs text-ink-soft block mb-1">Tipo</label>
              <select
                value={form.tipo}
                onChange={(e) => setForm({ ...form, tipo: e.target.value as TipoPersona })}
                className="w-full py-2 px-2.5 rounded-lg border border-line bg-paper text-sm"
              >
                {tipos.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="text-xs text-ink-soft block mb-1">Nombre completo</label>
            <input
              value={form.nombre}
              onChange={(e) => setForm({ ...form, nombre: e.target.value })}
              className="w-full py-2 px-2.5 rounded-lg border border-line bg-paper text-sm"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-ink-soft block mb-1">
                {form.tipo === "Estudiante" ? "Grado/sección" : "Cargo"}
              </label>
              <input
                value={form.grado_cargo}
                onChange={(e) => setForm({ ...form, grado_cargo: e.target.value })}
                className="w-full py-2 px-2.5 rounded-lg border border-line bg-paper text-sm"
              />
            </div>
            <div>
              <label className="text-xs text-ink-soft block mb-1">Límite de crédito (USD)</label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={form.limite_credito_usd}
                onChange={(e) => setForm({ ...form, limite_credito_usd: e.target.value })}
                className="w-full py-2 px-2.5 rounded-lg border border-line bg-paper text-sm font-ticket"
              />
            </div>
          </div>

          {form.tipo === "Estudiante" && (
            <div className="ticket-dashed pt-3">
              <p className="text-xs font-medium text-ink-soft mb-2">Datos del representante</p>
              <div className="grid grid-cols-2 gap-3">
                <input
                  placeholder="Nombre del representante"
                  value={form.representante_nombre}
                  onChange={(e) => setForm({ ...form, representante_nombre: e.target.value })}
                  className="py-2 px-2.5 rounded-lg border border-line bg-paper text-sm"
                />
                <input
                  placeholder="Parentesco"
                  value={form.representante_parentesco}
                  onChange={(e) => setForm({ ...form, representante_parentesco: e.target.value })}
                  className="py-2 px-2.5 rounded-lg border border-line bg-paper text-sm"
                />
                <input
                  placeholder="Teléfono (ej: 0412-3456789)"
                  value={form.representante_telefono}
                  onChange={(e) => setForm({ ...form, representante_telefono: e.target.value })}
                  className="py-2 px-2.5 rounded-lg border border-line bg-paper text-sm font-ticket"
                />
                <input
                  placeholder="Correo (opcional)"
                  value={form.representante_email}
                  onChange={(e) => setForm({ ...form, representante_email: e.target.value })}
                  className="py-2 px-2.5 rounded-lg border border-line bg-paper text-sm"
                />
              </div>
            </div>
          )}

          {error && <p className="text-sm text-debt">{error}</p>}

          <div className="flex gap-2 mt-1">
            <button
              type="submit"
              disabled={guardando}
              className="flex-1 py-2.5 rounded-lg bg-accent text-white text-sm font-medium disabled:opacity-60"
            >
              {guardando ? "Guardando..." : "Guardar"}
            </button>
            <button
              type="button"
              onClick={() => setMostrarForm(false)}
              className="px-4 rounded-lg border border-line text-sm text-ink-soft"
            >
              Cancelar
            </button>
          </div>
        </form>
      )}

      {cargando ? (
        <p className="text-sm text-ink-soft">Cargando...</p>
      ) : (
        <ul className="ticket divide-y divide-line overflow-hidden">
          {filtradas.map((p) => {
            const whatsappLink = p.representante_telefono
              ? buildWhatsAppLink(
                  p.representante_telefono,
                  `Hola, le informamos que el saldo de ${p.nombre} en la cantina está en ${formatUsd(p.saldo_usd)}.`
                )
              : null;

            return (
              <li key={p.id} className={`p-3 flex items-center gap-3 ${!p.activo ? "opacity-50" : ""}`}>
                <Avatar fotoUrl={p.foto_url} nombre={p.nombre} size="sm" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-ink truncate">{p.nombre}</p>
                  <p className="text-xs text-ink-soft">
                    Carnet {p.id} · {p.tipo}
                    {p.grado_cargo ? ` · ${p.grado_cargo}` : ""}
                  </p>
                </div>
                <span className="font-ticket text-sm text-ink-soft shrink-0">
                  {formatUsd(p.saldo_usd)}
                </span>
                {whatsappLink && (
                  <a
                    href={whatsappLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-credit shrink-0"
                  >
                    WhatsApp
                  </a>
                )}
                <button onClick={() => editarPersona(p)} className="text-xs text-ink-soft shrink-0">
                  Editar
                </button>
                <button onClick={() => toggleActivo(p)} className="text-xs text-ink-soft shrink-0">
                  {p.activo ? "Desactivar" : "Activar"}
                </button>
              </li>
            );
          })}
          {filtradas.length === 0 && (
            <p className="p-4 text-sm text-ink-soft">No hay personas registradas.</p>
          )}
        </ul>
      )}
    </div>
  );
}
