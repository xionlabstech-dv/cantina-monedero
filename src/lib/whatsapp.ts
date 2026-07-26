/**
 * Normaliza un teléfono venezolano en formato local (ej: 0412-3456789)
 * a formato internacional E.164 sin símbolos (ej: 584123456789) para wa.me.
 */
export function normalizePhoneVe(phone: string): string | null {
  const digits = phone.replace(/\D/g, "");
  if (!digits) return null;

  // Ya viene con código de país
  if (digits.startsWith("58") && digits.length === 12) {
    return digits;
  }

  // Formato local: 0412-3456789 → 11 dígitos empezando en 0
  const withoutLeadingZero = digits.startsWith("0") ? digits.slice(1) : digits;
  if (withoutLeadingZero.length !== 10) return null;

  return `58${withoutLeadingZero}`;
}

export function buildWhatsAppLink(phone: string, message: string): string | null {
  const normalized = normalizePhoneVe(phone);
  if (!normalized) return null;
  return `https://wa.me/${normalized}?text=${encodeURIComponent(message)}`;
}
