# Cantina — Monedero Escolar

Sistema de monedero prepago/crédito para la cantina de un colegio. Stack: Next.js (App Router) + Tailwind CSS + Supabase (Postgres + Auth + Storage).

## Puesta en marcha

1. **Variables de entorno**

   Copia `.env.local.example` a `.env.local` y completa con los datos de tu proyecto Supabase (Project Settings → API):

   ```
   NEXT_PUBLIC_SUPABASE_URL=https://tu-proyecto.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=tu-anon-key-completa
   ```

   ⚠️ La `ANON_KEY` es un JWT largo — verifica que la copiaste completa, sin truncar.

2. **Base de datos**

   Corre `schema_cantina.sql` (tablas, vistas, funciones RPC y RLS) en el SQL Editor de Supabase. Ya incluye datos de ejemplo que puedes borrar antes de producción.

3. **Storage**

   Corre `supabase-storage-setup.sql` en el SQL Editor para crear el bucket público `fotos-personas` usado para las fotos de personas.

4. **Usuario administrador (cantinera)**

   Crea el único usuario admin desde el Dashboard de Supabase → Authentication → Users → Add user (correo + contraseña). Es el que se usa para entrar en `/admin/login`.

5. **Instalar y correr**

   ```bash
   npm install
   npm run dev
   ```

   Abre [http://localhost:3000](http://localhost:3000).

## Rutas

| Ruta | Acceso | Contenido |
|---|---|---|
| `/consulta` | Pública | Buscar por carnet (4 dígitos), ver saldo y consumo del día |
| `/admin/login` | Pública | Inicio de sesión de la cantinera |
| `/admin/caja` | Privada | Cobro de ventas, deshacer, aviso WhatsApp |
| `/admin/inventario` | Privada | CRUD de productos, edición inline, alerta de bajo stock |
| `/admin/gestion` | Privada | Tasa BCV, Recargas, Personas (crear/editar, representantes) |
| `/admin/historial` | Privada | Movimientos del día, totales, exportar a `.xlsx` |

Toda la lógica de saldo (venta, recarga, deshacer) vive en funciones RPC de Postgres (`fn_procesar_venta`, `fn_registrar_recarga`, `fn_deshacer_transaccion`) — nunca se actualiza el saldo directamente desde el cliente.
