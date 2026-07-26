# Blueprint — Cantina (Monedero Escolar)

## 1. Resumen del producto

Sistema de monedero prepago/crédito para la cantina de un colegio venezolano. Reemplaza el control manual en libreta. Una cantinera opera caja e inventario desde su teléfono; representantes y docentes consultan saldo desde un enlace público sin necesidad de cuenta.

**Regla de negocio central:** cada persona tiene un único saldo (`saldo_usd`) que puede ser positivo (a favor) o negativo (debe). Cada persona tiene además un `limite_credito_usd` configurable:

- `limite_credito_usd = 0` → prepago estricto, no puede comprar sin saldo.
- `limite_credito_usd = 100` → puede consumir en negativo hasta -$100, luego se bloquea.

Una compra se permite solo si `saldo_usd - total_compra >= -limite_credito_usd`. No hay excepciones a esta regla — se aplica siempre en la base de datos, nunca solo en el frontend.

## 2. Arquitectura

**Stack:** Next.js 14 (App Router) + Tailwind CSS + Supabase (Postgres + Auth + Storage) + Vercel.

**Zonas de acceso:**

| Ruta | Acceso | Contenido |
|---|---|---|
| `/consulta` | Pública, sin login | Buscar por carnet (4 dígitos), ver saldo y consumo del día |
| `/admin/*` | Privada, Supabase Auth | Caja, Inventario, Gestión, Historial |

`/admin/*` debe redirigir a `/admin/login` si no hay sesión activa. Un solo usuario administrador basta (la cantinera); no se requiere multiusuario en esta fase.

**Precios:** todo producto guarda su precio en USD (`precio_usd`). El bolívar se calcula siempre como `precio_usd * tasa_bcv_vigente` en el momento de mostrar o de cobrar — nunca se guarda un precio fijo en bolívares.

## 3. Modelo de datos (resumen)

- **personas** — estudiantes, docentes y personal. Carnet de 4 dígitos como identificador visible, tipo (Estudiante/Docente/Personal), saldo, límite de crédito, foto, estado activo/inactivo.
- **productos** — nombre, precio en USD, stock, umbral de bajo stock.
- **transacciones** — historial inmutable de ventas y recargas, siempre ligado a una persona.
- **configuracion** — fila única con la tasa BCV vigente.

Ver `schema_cantina.sql` para el DDL completo, incluyendo las funciones que procesan venta, recarga y deshacer.

## 4. Funciones de negocio (Postgres RPC)

Claude Code debe llamar estas funciones desde el cliente Supabase en vez de hacer `UPDATE`/`INSERT` manuales sobre saldo:

- `fn_procesar_venta(p_persona_id, p_items jsonb)` — valida contra el límite de crédito, descuenta stock, registra la transacción y actualiza el saldo, todo en una sola transacción atómica. Lanza error si no alcanza el cupo.
- `fn_registrar_recarga(p_persona_id, p_monto_usd, p_metodo)` — suma al saldo y registra la transacción.
- `fn_deshacer_transaccion(p_transaccion_id)` — revierte saldo y stock, y marca la transacción como anulada (no se borra, para no perder rastro). Debe restringirse a transacciones del día actual.

## 5. Reglas de acceso (RLS)

- **`personas`**: lectura pública solo de las columnas necesarias para consulta (vía vista `personas_publico`), sin exponer nada administrativo. Escritura solo con sesión autenticada.
- **`productos`**: lectura pública (necesaria para mostrar el menú en Caja si se desea, aunque Caja vive en `/admin`). Escritura solo autenticado.
- **`transacciones`**: lectura pública limitada a las transacciones del día de una persona específica (vía vista `transacciones_publico_hoy`), para que Consulta muestre "consumo de hoy". Escritura únicamente a través de las funciones RPC (nunca INSERT directo desde el cliente).
- **`configuracion`**: lectura pública (la tasa debe ser visible en Consulta), escritura solo autenticada.

Nota realista: como el carnet es de solo 4 dígitos, alguien podría "adivinar" un ID ajeno y ver su saldo. Es el mismo nivel de exposición que preguntarle a la cantinera de viva voz — aceptable para este caso de uso, pero queda documentado por si en el futuro quieres subir la seguridad (ej. pedir también la cédula).

## 6. Pantallas (ya validadas en el prototipo de Claude Design)

1. **Consulta** — buscar por carnet, ver nombre, tipo, saldo/deuda, barra de crédito, consumo de hoy.
2. **Caja** — buscar por carnet o nombre, ver persona + foto, agregar productos (menú en $ mostrado en Bs), cobrar, deshacer venta.
3. **Inventario** — CRUD de productos, precio en USD, edición inline, control de stock con alerta de bajo stock.
4. **Gestión** — pestañas internas: Tasa BCV, Recargas (buscador por nombre/carnet), Personas (crear con foto, editar, activar/desactivar, límite de crédito, datos de representante para estudiantes con botón de WhatsApp — ver sección 8).
5. **Historial** — movimientos del día, totales de venta/recarga, exportar a **`.xlsx` real** (usar librería `xlsx`/SheetJS, no CSV).

## 7. Fase de desarrollo sugerida

1. Conectar proyecto Next.js a Supabase con las credenciales ya generadas.
2. Correr `schema_cantina.sql` en el SQL Editor de Supabase.
3. Crear bucket de Storage `fotos-personas` (público de lectura).
4. Implementar Auth simple para `/admin` (un solo usuario cantinera).
5. Construir las 5 pantallas siguiendo el diseño de Claude Design como referencia visual exacta (estética ticket/recibo, paleta y tipografías ya definidas).
6. Conectar cada pantalla a las funciones RPC y vistas correspondientes.
7. Probar el flujo completo: crear persona → recargar → cobrar hasta tocar el límite → deshacer → exportar historial.

## 8. Contacto por WhatsApp al representante (click-to-chat, manual)

Cada persona de tipo **Estudiante** puede tener guardados los datos de su representante: nombre, parentesco, teléfono y correo (campos `representante_*` en `personas`). Estos campos son opcionales y no aplican a Docente/Personal.

**No es un envío automático.** Es el mismo patrón que ya usa Skuela: un botón "Avisar por WhatsApp" que abre un enlace `https://wa.me/<telefono>?text=<mensaje>` en una pestaña nueva, con el número y un mensaje pre-armado (ej. "Hola, le informamos que el saldo de [nombre] en la cantina está en Bs. X"). La cantinera revisa el mensaje y decide si lo envía — cero costo, cero integración con proveedores externos, cero automatización de fondo.

**Dónde debe vivir:**
- En **Gestión → Personas**, junto a cada estudiante con representante registrado.
- En **Caja**, cuando el saldo de un estudiante llega a $0 o está muy cerca del límite de crédito, mostrar el mismo botón como acceso rápido.

El teléfono debe normalizarse a formato internacional en el enlace (`+58` + número sin el `0` inicial) para que `wa.me` lo reconozca correctamente — Claude Code debe implementar esa conversión al construir el link, no solo concatenar el número tal cual está guardado.

**Datos sensibles:** los campos `representante_*` NO se exponen en la vista pública `personas_publico` — son visibles únicamente en el panel `/admin`, autenticado.

## 9. Fuera de alcance por ahora

- Envío automático de WhatsApp o notificaciones push (esto seguirá siendo siempre una acción manual de la cantinera, por decisión explícita).
- Multiusuario/roles distintos para varias cantineras.
- Reportes mensuales o por rango de fechas (Consulta pública solo muestra el día actual, según lo acordado).
