"use client";

function money(value: number): string {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export function ValueCompareCard({
  contractValue,
  totalPaid,
}: {
  contractValue: number;
  totalPaid: number;
}) {
  const gap = totalPaid - contractValue;
  const overPaid = gap > 0 && contractValue > 0;
  const pct =
    contractValue > 0 ? (gap / contractValue) * 100 : totalPaid > 0 ? 100 : 0;

  return (
    <div className="invest-card-highlight p-5">
      <p className="invest-section-title">Valor contratado × total pago</p>
      <div className="mt-4 grid gap-4 sm:grid-cols-3">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.12em] text-[var(--invest-faint)]">
            Valor contratado
          </p>
          <p className="mt-2 text-lg font-black text-[var(--invest-heading)]">
            {money(contractValue)}
          </p>
        </div>
        <div>
          <p className="text-xs font-black uppercase tracking-[0.12em] text-[var(--invest-faint)]">
            Total pago
          </p>
          <p className="mt-2 text-lg font-black text-[var(--invest-heading)]">
            {money(totalPaid)}
          </p>
        </div>
        <div>
          <p className="text-xs font-black uppercase tracking-[0.12em] text-[var(--invest-faint)]">
            Diferença
          </p>
          <p
            className="mt-2 text-lg font-black"
            style={{
              color: overPaid ? "var(--invest-danger)" : "var(--invest-heading)",
            }}
          >
            {money(gap)}
          </p>
        </div>
      </div>
      {overPaid ? (
        <p className="mt-4 text-sm font-bold text-[var(--invest-danger)]">
          Pagamentos acima do contratado em {money(gap)} ({pct.toFixed(1)}%).
        </p>
      ) : null}
    </div>
  );
}
