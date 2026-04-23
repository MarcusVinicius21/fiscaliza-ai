"use client";

type Tone = "default" | "warning" | "danger";

export interface FactSummaryItem {
  label: string;
  value: string | number;
  tone?: Tone;
}

function formatValue(label: string, value: string | number): string {
  if (typeof value === "number") {
    if (/R\$/i.test(label) || /valor|pago|contrat|gap/i.test(label)) {
      return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
    }
    return value.toLocaleString("pt-BR");
  }
  return value;
}

function toneColor(tone?: Tone): string {
  if (tone === "danger") return "var(--invest-danger)";
  if (tone === "warning") return "var(--invest-warning, #b45309)";
  return "var(--invest-heading)";
}

export function FactSummaryGrid({ items }: { items: FactSummaryItem[] }) {
  if (!items || items.length === 0) return null;
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {items.map((item, index) => (
        <div
          key={`${item.label}-${index}`}
          className="invest-card-highlight p-4"
        >
          <p className="text-xs font-black uppercase tracking-[0.12em] text-[var(--invest-faint)]">
            {item.label}
          </p>
          <p
            className="mt-2 text-lg font-black"
            style={{ color: toneColor(item.tone) }}
          >
            {formatValue(item.label, item.value)}
          </p>
        </div>
      ))}
    </div>
  );
}
