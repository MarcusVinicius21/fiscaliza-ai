"use client";

import { ChainStatusBadge, ChainStatus } from "./chain-status-badge";

interface ChainNode {
  title: string;
  rawNumber?: string | null;
  value?: number | null;
  date?: string | null;
  status?: ChainStatus | null;
  extra?: string | null;
}

function money(value: number): string {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function Node({ node }: { node: ChainNode | null | undefined }) {
  if (!node) {
    return (
      <div className="invest-card-highlight p-4">
        <p className="invest-section-title">Sem dado</p>
        <p className="mt-2 text-sm text-[var(--invest-muted)]">
          Elo ausente na cadeia factual.
        </p>
      </div>
    );
  }
  return (
    <div className="invest-card-highlight p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="invest-section-title">{node.title}</p>
          {node.rawNumber ? (
            <p className="mt-1 font-mono text-sm text-[var(--invest-muted)]">
              {node.rawNumber}
            </p>
          ) : null}
        </div>
        {node.status ? <ChainStatusBadge status={node.status} /> : null}
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        {typeof node.value === "number" ? (
          <span className="app-chip">{money(node.value)}</span>
        ) : null}
        {node.date ? <span className="app-chip">{node.date}</span> : null}
        {node.extra ? <span className="app-chip">{node.extra}</span> : null}
      </div>
    </div>
  );
}

interface ChainInput {
  number?: string | null;
  raw_number?: string | null;
  value?: number | null;
  amount?: number | null;
  total_value?: number | null;
  date?: string | null;
  paid_at?: string | null;
  signed_at?: string | null;
  published_at?: string | null;
  bid_link_status?: ChainStatus | null;
  contract_link_status?: ChainStatus | null;
  status?: ChainStatus | null;
}

function contractValue(c: ChainInput): number | null {
  if (typeof c.value === "number") return c.value;
  if (typeof c.total_value === "number") return c.total_value;
  return null;
}

export function ChainView({
  bid,
  contract,
  payments,
}: {
  bid?: ChainInput | null;
  contract?: ChainInput | null;
  payments?: ChainInput[];
}) {
  const paymentsTotal = (payments || []).reduce(
    (acc, p) => acc + (typeof p.amount === "number" ? p.amount : 0),
    0,
  );
  const paymentsCount = (payments || []).length;

  const bidNode: ChainNode | null = bid
    ? {
        title: "Licitação",
        rawNumber: bid.raw_number || bid.number || null,
        value: contractValue(bid),
        date: bid.published_at || bid.date || null,
        status: bid.status,
      }
    : null;

  const contractNode: ChainNode | null = contract
    ? {
        title: "Contrato",
        rawNumber: contract.raw_number || contract.number || null,
        value: contractValue(contract),
        date: contract.signed_at || contract.date || null,
        status: contract.bid_link_status || contract.status,
      }
    : null;

  const paymentsNode: ChainNode = {
    title: `Pagamentos (${paymentsCount})`,
    value: paymentsTotal,
    extra: paymentsCount === 0 ? "Nenhum pagamento vinculado" : undefined,
  };

  return (
    <div className="grid gap-3 lg:grid-cols-[1fr_auto_1fr_auto_1fr] lg:items-stretch">
      <Node node={bidNode} />
      <div className="hidden items-center justify-center text-[var(--invest-faint)] lg:flex">
        →
      </div>
      <Node node={contractNode} />
      <div className="hidden items-center justify-center text-[var(--invest-faint)] lg:flex">
        →
      </div>
      <Node node={paymentsNode} />
    </div>
  );
}
