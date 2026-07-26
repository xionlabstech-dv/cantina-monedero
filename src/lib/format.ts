export function formatUsd(amount: number): string {
  const sign = amount < 0 ? "-" : "";
  return `${sign}$${Math.abs(amount).toFixed(2)}`;
}

export function formatBs(usdAmount: number, tasaBcv: number): string {
  const bs = usdAmount * tasaBcv;
  return `Bs. ${bs.toLocaleString("es-VE", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export function usdToBs(usdAmount: number, tasaBcv: number): number {
  return usdAmount * tasaBcv;
}

export function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString("es-VE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function formatTime(iso: string): string {
  return new Date(iso).toLocaleString("es-VE", {
    hour: "2-digit",
    minute: "2-digit",
  });
}
