"use client";

export type GapKind = "no_bid" | "no_contract" | "over_paid" | "object_repeat";

const MESSAGES: Record<GapKind, { title: string; body: string }> = {
  no_bid: {
    title: "Sem licitação vinculada",
    body: "Este contrato não possui licitação vinculada. Pode ser dispensa/inexigibilidade ou lacuna de dados — confirme a modalidade e o número do processo.",
  },
  no_contract: {
    title: "Sem contrato vinculado",
    body: "Não foi possível vincular este item a um contrato no acervo atual. Pode ser falta de dado ou pagamento sem cobertura contratual — confirme com a fonte.",
  },
  over_paid: {
    title: "Pagamentos acima do contratado",
    body: "A soma dos pagamentos vinculados supera o valor do contrato. Antes de concluir, verifique aditivos, reequilíbrio e lançamentos duplicados.",
  },
  object_repeat: {
    title: "Objeto repetido em múltiplos contratos",
    body: "O mesmo objeto aparece em mais de um contrato para o mesmo fornecedor. Pode indicar fracionamento — cheque datas, modalidade e limites legais.",
  },
};

export function GapCallout({
  kind,
  detail,
}: {
  kind: GapKind;
  detail?: string;
}) {
  const entry = MESSAGES[kind];
  return (
    <div
      className="rounded-lg border p-4"
      style={{
        borderColor: "var(--invest-border)",
        background: "var(--invest-surface-soft)",
      }}
    >
      <p className="text-sm font-black text-[var(--invest-heading)]">
        {entry.title}
      </p>
      <p className="mt-2 text-sm leading-6 text-[var(--invest-muted)]">
        {entry.body}
      </p>
      {detail ? (
        <p className="mt-2 text-xs text-[var(--invest-faint)]">{detail}</p>
      ) : null}
    </div>
  );
}
