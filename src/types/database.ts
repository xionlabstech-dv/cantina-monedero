export type TipoPersona = "Estudiante" | "Docente" | "Personal";
export type TipoTransaccion = "venta" | "recarga";
export type MetodoPago = "Efectivo" | "Transferencia" | "Pago móvil";

export interface Persona {
  id: string; // carnet de 4 dígitos
  nombre: string;
  tipo: TipoPersona;
  grado_cargo: string | null;
  foto_url: string | null;
  saldo_usd: number;
  limite_credito_usd: number;
  activo: boolean;
  representante_nombre: string | null;
  representante_parentesco: string | null;
  representante_telefono: string | null;
  representante_email: string | null;
  created_at: string;
}

export type PersonaPublico = Omit<
  Persona,
  | "representante_nombre"
  | "representante_parentesco"
  | "representante_telefono"
  | "representante_email"
>;

export interface Producto {
  id: string;
  nombre: string;
  precio_usd: number;
  stock: number;
  umbral_stock: number;
  activo: boolean;
  created_at: string;
}

export interface Transaccion {
  id: string;
  persona_id: string;
  tipo: TipoTransaccion;
  monto_usd: number;
  detalle: string | null;
  metodo_pago: MetodoPago | string | null;
  anulada: boolean;
  created_at: string;
}

export interface Configuracion {
  id: number;
  tasa_bcv: number;
  tasa_actualizada_en: string;
}

export interface ItemVenta {
  producto_id: string;
  cantidad: number;
}

export interface ProcesarVentaResult {
  nueva_transaccion_id: string;
  nuevo_saldo: number;
}

export interface RegistrarRecargaResult {
  nueva_transaccion_id: string;
  nuevo_saldo: number;
}
