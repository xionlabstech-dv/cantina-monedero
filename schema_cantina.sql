-- ============================================================================
-- CANTINA — Schema Supabase (Postgres)
-- Ejecutar completo en el SQL Editor del proyecto Supabase.
-- ============================================================================

-- ── EXTENSIONES ─────────────────────────────────────────────────────────────
create extension if not exists "pgcrypto";

-- ============================================================================
-- 1. TABLAS
-- ============================================================================

create table personas (
  id                text primary key check (id ~ '^[0-9]{4}$'), -- carnet de 4 dígitos
  nombre            text not null,
  tipo              text not null check (tipo in ('Estudiante', 'Docente', 'Personal')),
  grado_cargo       text,
  foto_url          text,
  saldo_usd         numeric(10,2) not null default 0,
  limite_credito_usd numeric(10,2) not null default 0 check (limite_credito_usd >= 0),
  activo            boolean not null default true,
  -- Representante (solo aplica a Estudiantes; null para Docente/Personal)
  representante_nombre     text,
  representante_parentesco text, -- Madre, Padre, Representante legal, etc.
  representante_telefono   text, -- formato local, ej: 0412-3456789
  representante_email      text,
  created_at        timestamptz not null default now()
);

create table productos (
  id            uuid primary key default gen_random_uuid(),
  nombre        text not null,
  precio_usd    numeric(10,2) not null check (precio_usd >= 0),
  stock         integer not null default 0,
  umbral_stock  integer not null default 10,
  activo        boolean not null default true,
  created_at    timestamptz not null default now()
);

create table transacciones (
  id            uuid primary key default gen_random_uuid(),
  persona_id    text not null references personas(id),
  tipo          text not null check (tipo in ('venta', 'recarga')),
  monto_usd     numeric(10,2) not null, -- negativo para venta, positivo para recarga
  detalle       text,
  metodo_pago   text, -- solo aplica a recargas: Efectivo, Transferencia, Pago móvil
  referencia    text, -- número de referencia, obligatorio en recargas por Transferencia/Pago móvil
  anulada       boolean not null default false,
  created_at    timestamptz not null default now()
);

create table configuracion (
  id                  int primary key default 1 check (id = 1), -- fila única
  tasa_bcv            numeric(10,4) not null,
  tasa_actualizada_en timestamptz not null default now()
);

insert into configuracion (id, tasa_bcv) values (1, 46.80);

-- ============================================================================
-- 2. VISTAS PÚBLICAS (para la zona /consulta sin login)
-- ============================================================================

create view personas_publico as
select
  id, nombre, tipo, grado_cargo, foto_url,
  saldo_usd, limite_credito_usd, activo
from personas
where activo = true;

create view transacciones_publico_hoy as
select id, persona_id, tipo, monto_usd, detalle, created_at
from transacciones
where anulada = false
  and created_at >= date_trunc('day', now());

-- ============================================================================
-- 3. FUNCIONES DE NEGOCIO (RPC) — únicas vías para mover saldo
-- ============================================================================

-- Procesa una venta: recibe items como jsonb [{producto_id, cantidad}]
create or replace function fn_procesar_venta(
  p_persona_id text,
  p_items jsonb
) returns table (nueva_transaccion_id uuid, nuevo_saldo numeric) as $$
declare
  v_persona     personas%rowtype;
  v_total       numeric(10,2) := 0;
  v_detalle     text := '';
  v_item        jsonb;
  v_producto    productos%rowtype;
  v_tx_id       uuid;
begin
  select * into v_persona from personas where id = p_persona_id and activo = true for update;
  if not found then
    raise exception 'Persona % no encontrada o inactiva', p_persona_id;
  end if;

  for v_item in select * from jsonb_array_elements(p_items)
  loop
    select * into v_producto from productos
      where id = (v_item->>'producto_id')::uuid and activo = true for update;
    if not found then
      raise exception 'Producto % no encontrado', v_item->>'producto_id';
    end if;

    if v_producto.stock < (v_item->>'cantidad')::int then
      raise exception 'Stock insuficiente de %', v_producto.nombre;
    end if;

    v_total := v_total + (v_producto.precio_usd * (v_item->>'cantidad')::int);
    v_detalle := v_detalle || v_producto.nombre || ' x' || (v_item->>'cantidad') || ', ';

    update productos set stock = stock - (v_item->>'cantidad')::int where id = v_producto.id;
  end loop;

  if v_persona.saldo_usd - v_total < -v_persona.limite_credito_usd then
    raise exception 'Saldo insuficiente: excede el límite de crédito de %', v_persona.limite_credito_usd;
  end if;

  update personas set saldo_usd = saldo_usd - v_total where id = p_persona_id;

  insert into transacciones (persona_id, tipo, monto_usd, detalle)
    values (p_persona_id, 'venta', -v_total, trim(trailing ', ' from v_detalle))
    returning id into v_tx_id;

  return query select v_tx_id, (v_persona.saldo_usd - v_total);
end;
$$ language plpgsql security definer;

-- Registra una recarga/abono
create or replace function fn_registrar_recarga(
  p_persona_id text,
  p_monto_usd numeric,
  p_metodo text
) returns table (nueva_transaccion_id uuid, nuevo_saldo numeric) as $$
declare
  v_tx_id uuid;
  v_saldo numeric;
begin
  if p_monto_usd <= 0 then
    raise exception 'El monto de recarga debe ser mayor a cero';
  end if;

  update personas set saldo_usd = saldo_usd + p_monto_usd
    where id = p_persona_id and activo = true
    returning saldo_usd into v_saldo;

  if not found then
    raise exception 'Persona % no encontrada o inactiva', p_persona_id;
  end if;

  insert into transacciones (persona_id, tipo, monto_usd, detalle, metodo_pago)
    values (p_persona_id, 'recarga', p_monto_usd, 'Recarga de saldo', p_metodo)
    returning id into v_tx_id;

  return query select v_tx_id, v_saldo;
end;
$$ language plpgsql security definer;

-- Deshace una transacción del día (venta o recarga)
create or replace function fn_deshacer_transaccion(
  p_transaccion_id uuid
) returns void as $$
declare
  v_tx transacciones%rowtype;
begin
  select * into v_tx from transacciones where id = p_transaccion_id for update;
  if not found then
    raise exception 'Transacción no encontrada';
  end if;
  if v_tx.anulada then
    raise exception 'Esta transacción ya fue anulada';
  end if;
  if v_tx.created_at < date_trunc('day', now()) then
    raise exception 'Solo se pueden deshacer transacciones del día actual';
  end if;

  update personas set saldo_usd = saldo_usd - v_tx.monto_usd where id = v_tx.persona_id;
  update transacciones set anulada = true where id = p_transaccion_id;
end;
$$ language plpgsql security definer;

-- ============================================================================
-- 4. ROW LEVEL SECURITY
-- ============================================================================

alter table personas enable row level security;
alter table productos enable row level security;
alter table transacciones enable row level security;
alter table configuracion enable row level security;

-- personas: nada de acceso directo público a la tabla base (se usa la vista)
create policy "personas_admin_full" on personas
  for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

-- productos: lectura pública, escritura solo admin
create policy "productos_lectura_publica" on productos
  for select using (true);
create policy "productos_admin_escritura" on productos
  for insert with check (auth.role() = 'authenticated');
create policy "productos_admin_update" on productos
  for update using (auth.role() = 'authenticated');
create policy "productos_admin_delete" on productos
  for delete using (auth.role() = 'authenticated');

-- transacciones: sin acceso directo de escritura pública (solo vía RPC con security definer)
create policy "transacciones_admin_full" on transacciones
  for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

-- configuracion: lectura pública (tasa visible en Consulta), escritura solo admin
create policy "configuracion_lectura_publica" on configuracion
  for select using (true);
create policy "configuracion_admin_update" on configuracion
  for update using (auth.role() = 'authenticated');

-- Las vistas públicas heredan RLS de las tablas base salvo que se marquen
-- security_invoker = false; para que anon pueda leerlas sin ver la tabla cruda:
alter view personas_publico set (security_invoker = off);
alter view transacciones_publico_hoy set (security_invoker = off);

grant select on personas_publico to anon;
grant select on transacciones_publico_hoy to anon;
grant select on configuracion to anon;
grant select on productos to anon;
grant execute on function fn_procesar_venta to authenticated;
grant execute on function fn_registrar_recarga to authenticated;
grant execute on function fn_deshacer_transaccion to authenticated;

-- ============================================================================
-- 5. DATOS DE EJEMPLO (borrar antes de producción)
-- ============================================================================

insert into personas (id, nombre, tipo, grado_cargo, saldo_usd, limite_credito_usd) values
  ('0001', 'Valentina Rodríguez', 'Estudiante', '4to A', 8.50, 0),
  ('2250', 'Carlos Medina',       'Estudiante', '2do B', -6.20, 10),
  ('3328', 'Sofía Torres',        'Estudiante', '6to A', 22.30, 0),
  ('0004', 'Prof. Ana Salazar',   'Docente',    'Matemáticas', -3.00, 25);

insert into productos (nombre, precio_usd, stock, umbral_stock) values
  ('Arepa con queso', 1.50, 20, 5),
  ('Jugo natural',    0.75, 30, 10),
  ('Empanada',        1.00, 25, 5),
  ('Perro caliente',  2.00, 15, 5);

-- ============================================================================
-- FIN
-- ============================================================================
