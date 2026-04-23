"use client";

export interface ProvenanceRow {
  standardized_record_id: string;
  link_role: string;
  dedupe_reason?: string | null;
  source_upload_id?: string | null;
  file_name?: string | null;
  category?: string | null;
  report_type?: string | null;
  report_label?: string | null;
  date?: string | null;
  summary?: string | null;
  document?: string | null;
  amount?: number | null;
}

const ROLE_LABELS: Record<string, string> = {
  primary: "Primaria",
  supporting: "Apoio",
  merged_duplicate: "Duplicata fundida",
};

function roleLabel(role: string): string {
  return ROLE_LABELS[role] || role;
}

function money(value?: number | null): string {
  if (typeof value !== "number") return "-";
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export function ProvenanceTable({ rows }: { rows: ProvenanceRow[] }) {
  if (!rows || rows.length === 0) {
    return (
      <p className="text-sm text-[var(--invest-muted)]">
        Sem linhas de origem registradas para este fato.
      </p>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="text-left text-xs font-black uppercase tracking-[0.12em] text-[var(--invest-faint)]">
            <th className="border-b border-[var(--invest-border)] py-2 pr-3">Linha</th>
            <th className="border-b border-[var(--invest-border)] py-2 pr-3">Papel</th>
            <th className="border-b border-[var(--invest-border)] py-2 pr-3">Resumo</th>
            <th className="border-b border-[var(--invest-border)] py-2 pr-3">Data</th>
            <th className="border-b border-[var(--invest-border)] py-2 pr-3">Valor</th>
            <th className="border-b border-[var(--invest-border)] py-2 pr-3">Arquivo</th>
            <th className="border-b border-[var(--invest-border)] py-2">Motivo</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={`${row.standardized_record_id}-${row.link_role}`} className="align-top">
              <td className="border-b border-[var(--invest-border)] py-2 pr-3 font-mono text-xs text-[var(--invest-muted)]">
                {row.standardized_record_id}
              </td>
              <td className="border-b border-[var(--invest-border)] py-2 pr-3 text-[var(--invest-heading)]">
                {roleLabel(row.link_role)}
              </td>
              <td className="border-b border-[var(--invest-border)] py-2 pr-3 text-[var(--invest-muted)]">
                {row.summary || "-"}
              </td>
              <td className="border-b border-[var(--invest-border)] py-2 pr-3 text-[var(--invest-muted)]">
                {row.date || "-"}
              </td>
              <td className="border-b border-[var(--invest-border)] py-2 pr-3 text-[var(--invest-heading)]">
                {money(row.amount)}
              </td>
              <td className="border-b border-[var(--invest-border)] py-2 pr-3 text-[var(--invest-muted)]">
                {row.file_name || row.source_upload_id || "-"}
              </td>
              <td className="border-b border-[var(--invest-border)] py-2 text-[var(--invest-muted)]">
                {row.dedupe_reason || "-"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
