import { formatUsd } from "@/lib/format";

export function CreditBar({
  saldoUsd,
  limiteCreditoUsd,
}: {
  saldoUsd: number;
  limiteCreditoUsd: number;
}) {
  const isDeuda = saldoUsd < 0;
  const rango = limiteCreditoUsd > 0 ? limiteCreditoUsd : Math.max(1, Math.abs(saldoUsd));
  const usado = Math.min(Math.abs(Math.min(saldoUsd, 0)), rango);
  const pct = rango > 0 ? (usado / rango) * 100 : 0;

  return (
    <div>
      <div className="flex items-baseline justify-between mb-1.5">
        <span
          className={`font-ticket text-2xl font-bold ${
            isDeuda ? "text-debt" : "text-credit"
          }`}
        >
          {formatUsd(saldoUsd)}
        </span>
        <span className="text-xs text-ink-soft">
          {isDeuda ? "debe" : "a favor"}
        </span>
      </div>
      {limiteCreditoUsd > 0 && (
        <>
          <div className="h-2 w-full rounded-full bg-line overflow-hidden">
            <div
              className={`h-full rounded-full ${isDeuda ? "bg-debt" : "bg-credit"}`}
              style={{ width: `${pct}%` }}
            />
          </div>
          <p className="text-xs text-ink-soft mt-1">
            Límite de crédito: {formatUsd(limiteCreditoUsd)}
          </p>
        </>
      )}
    </div>
  );
}
