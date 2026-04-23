"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { SkeletonBlock } from "@/components/app/skeleton-block";
import { ChainView } from "@/components/facts/chain-view";
import { FactSummaryGrid, FactSummaryItem } from "@/components/facts/fact-summary-grid";
import { GapCallout } from "@/components/facts/gap-callout";
import { ProvenanceRow, ProvenanceTable } from "@/components/facts/provenance-table";
import { safeDetail, safeNetworkMessage } from "@/lib/http-errors";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8000";

interface BidDetail {
  id: string;
  number?: string | null;
  raw_number?: string | null;
  process_number?: string | null;
  modality?: string | null;
  published_at?: string | null;
  awarded_value?: number | null;
  estimated_value?: number | null;
  winner_canonical_name?: string | null;
  winner_entity_name?: string | null;
  object_summary?: string | null;
  city_name?: string | null;
  provenance?: ProvenanceRow[];
}

interface ContractRow {
  id: string;
  number?: string | null;
  raw_number?: string | null;
  supplier_canonical_name?: string | null;
  contract_value?: number | null;
  signed_at?: string | null;
}

interface PaymentRow {
  id: string;
  raw_number?: string | null;
  number?: string | null;
  amount?: number | null;
  paid_at?: string | null;
  supplier_canonical_name?: string | null;
}

interface ChainPayload {
  status?: string;
  bid?: BidDetail | null;
  contracts?: ContractRow[];
  payments?: PaymentRow[];
}

interface BidResponse {
  status?: string;
  bid?: BidDetail | null;
}

function money(value: number | null | undefined): string {
  if (typeof value !== "number") return "—";
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export default function LicitacaoDetailPage() {
  const params = useParams<{ id: string }>();
  const id = params?.id;

  const [bid, setBid] = useState<BidDetail | null>(null);
  const [bidLoading, setBidLoading] = useState(true);
  const [bidError, setBidError] = useState("");

  const [chain, setChain] = useState<ChainPayload | null>(null);
  const [chainLoading, setChainLoading] = useState(true);
  const [chainError, setChainError] = useState("");

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    async function loadBid() {
      setBidLoading(true);
      setBidError("");
      try {
        const response = await fetch(`${API_BASE}/bids/${id}`);
        const data = (await response.json().catch(() => null)) as BidResponse | null;
        if (!response.ok) {
          throw new Error(
            safeDetail(
              data,
              "Não foi possível carregar esta licitação agora. Tente novamente em instantes.",
            ),
          );
        }
        if (!cancelled) setBid(data?.bid ?? null);
      } catch (error: unknown) {
        if (!cancelled) {
          setBidError(
            safeNetworkMessage(
              error,
              "Não foi possível carregar esta licitação agora. Tente novamente em instantes.",
            ),
          );
        }
      } finally {
        if (!cancelled) setBidLoading(false);
      }
    }
    loadBid();
    return () => {
      cancelled = true;
    };
  }, [id]);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    async function loadChain() {
      setChainLoading(true);
      setChainError("");
      try {
        const response = await fetch(`${API_BASE}/bids/${id}/chain`);
        const data = (await response.json().catch(() => null)) as ChainPayload | null;
        if (!response.ok) {
          throw new Error(
            safeDetail(
              data,
              "Não foi possível carregar a cadeia desta licitação agora. Tente novamente em instantes.",
            ),
          );
        }
        if (!cancelled) setChain(data);
      } catch (error: unknown) {
        if (!cancelled) {
          setChainError(
            safeNetworkMessage(
              error,
              "Não foi possível carregar a cadeia desta licitação agora. Tente novamente em instantes.",
            ),
          );
        }
      } finally {
        if (!cancelled) setChainLoading(false);
      }
    }
    loadChain();
    return () => {
      cancelled = true;
    };
  }, [id]);

  const contracts = chain?.contracts || [];
  const payments = chain?.payments || [];
  const contractsTotal = contracts.reduce(
    (sum, contract) => sum + (typeof contract.contract_value === "number" ? contract.contract_value : 0),
    0,
  );
  const contractNode =
    contracts.length > 0
      ? {
          raw_number:
            contracts.length === 1
              ? contracts[0]?.raw_number || contracts[0]?.number || "Contrato vinculado"
              : `${contracts.length} contratos vinculados`,
          total_value: contractsTotal,
          signed_at: contracts[0]?.signed_at || null,
          status: "linked_exact" as const,
        }
      : null;

  const summary: FactSummaryItem[] = bid
    ? [
        {
          label: "Valor adjudicado (R$)",
          value: typeof bid.awarded_value === "number" ? bid.awarded_value : 0,
        },
        {
          label: "Valor estimado (R$)",
          value: typeof bid.estimated_value === "number" ? bid.estimated_value : 0,
        },
        { label: "Modalidade", value: bid.modality || "—" },
        { label: "Publicação", value: bid.published_at || "—" },
      ]
    : [];

  return (
    <div className="page-shell">
      <section className="page-header px-5 py-5 sm:px-6">
        <p className="invest-eyebrow">Licitação</p>
        {bidLoading ? (
          <div className="mt-3 max-w-3xl">
            <SkeletonBlock lines={3} />
          </div>
        ) : bidError ? (
          <p className="mt-3 text-sm font-bold text-[var(--invest-danger)]">{bidError}</p>
        ) : bid ? (
          <div className="mt-3 max-w-3xl">
            <h1 className="invest-title text-2xl sm:text-[2rem]">
              {bid.raw_number || bid.number || "Licitação"}
            </h1>
            <p className="invest-subtitle mt-3 text-sm sm:text-base">
              Processo {bid.process_number || "não informado"}
              {bid.city_name ? ` — ${bid.city_name}` : ""}
            </p>
            {bid.object_summary ? (
              <p className="mt-2 text-sm text-[var(--invest-muted)]">{bid.object_summary}</p>
            ) : null}
          </div>
        ) : null}
      </section>

      {!bidLoading && bid ? (
        <section className="invest-card p-5 sm:p-6">
          <FactSummaryGrid items={summary} />
        </section>
      ) : null}

      <section className="invest-card p-5 sm:p-6">
        <p className="invest-section-title">Cadeia factual</p>
        <div className="mt-4">
          {chainLoading ? (
            <SkeletonBlock lines={5} />
          ) : chainError ? (
            <p className="text-sm font-bold text-[var(--invest-danger)]">{chainError}</p>
          ) : (
            <ChainView bid={bid || chain?.bid || null} contract={contractNode} payments={payments} />
          )}
        </div>
      </section>

      <section className="invest-card p-5 sm:p-6">
        <p className="invest-section-title">Contratos vinculados</p>
        <div className="mt-4">
          {chainLoading ? (
            <SkeletonBlock lines={4} />
          ) : chainError ? (
            <p className="text-sm font-bold text-[var(--invest-danger)]">{chainError}</p>
          ) : contracts.length === 0 ? (
            <GapCallout kind="no_contract" />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-sm">
                <thead>
                  <tr className="text-left text-xs font-black uppercase tracking-[0.12em] text-[var(--invest-faint)]">
                    <th className="border-b border-[var(--invest-border)] py-2 pr-3">Número</th>
                    <th className="border-b border-[var(--invest-border)] py-2 pr-3">Fornecedor</th>
                    <th className="border-b border-[var(--invest-border)] py-2 pr-3">Valor</th>
                    <th className="border-b border-[var(--invest-border)] py-2 pr-3">Assinatura</th>
                    <th className="border-b border-[var(--invest-border)] py-2">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {contracts.map((c) => (
                    <tr key={c.id}>
                      <td className="border-b border-[var(--invest-border)] py-2 pr-3 font-mono text-xs text-[var(--invest-heading)]">
                        {c.raw_number || c.number || c.id.slice(0, 8)}
                      </td>
                      <td className="border-b border-[var(--invest-border)] py-2 pr-3 text-[var(--invest-heading)]">
                        {c.supplier_canonical_name || "—"}
                      </td>
                      <td className="border-b border-[var(--invest-border)] py-2 pr-3 text-[var(--invest-heading)]">
                        {money(c.contract_value)}
                      </td>
                      <td className="border-b border-[var(--invest-border)] py-2 pr-3 text-[var(--invest-muted)]">
                        {c.signed_at || "—"}
                      </td>
                      <td className="border-b border-[var(--invest-border)] py-2">
                        <Link href={`/contratos/${c.id}`} className="invest-button inline-flex px-3 py-1 text-xs">
                          Abrir
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </section>

      <section className="invest-card p-5 sm:p-6">
        <p className="invest-section-title">Pagamentos alcançados</p>
        <div className="mt-4">
          {chainLoading ? (
            <SkeletonBlock lines={4} />
          ) : chainError ? (
            <p className="text-sm font-bold text-[var(--invest-danger)]">{chainError}</p>
          ) : payments.length === 0 ? (
            <p className="text-sm text-[var(--invest-muted)]">
              Nenhum pagamento alcançado pela cadeia desta licitação no acervo atual.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-sm">
                <thead>
                  <tr className="text-left text-xs font-black uppercase tracking-[0.12em] text-[var(--invest-faint)]">
                    <th className="border-b border-[var(--invest-border)] py-2 pr-3">Número</th>
                    <th className="border-b border-[var(--invest-border)] py-2 pr-3">Fornecedor</th>
                    <th className="border-b border-[var(--invest-border)] py-2 pr-3">Valor</th>
                    <th className="border-b border-[var(--invest-border)] py-2 pr-3">Data</th>
                    <th className="border-b border-[var(--invest-border)] py-2">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {payments.map((p) => (
                    <tr key={p.id}>
                      <td className="border-b border-[var(--invest-border)] py-2 pr-3 font-mono text-xs text-[var(--invest-heading)]">
                        {p.raw_number || p.number || p.id.slice(0, 8)}
                      </td>
                      <td className="border-b border-[var(--invest-border)] py-2 pr-3 text-[var(--invest-heading)]">
                        {p.supplier_canonical_name || "—"}
                      </td>
                      <td className="border-b border-[var(--invest-border)] py-2 pr-3 text-[var(--invest-heading)]">
                        {money(p.amount)}
                      </td>
                      <td className="border-b border-[var(--invest-border)] py-2 pr-3 text-[var(--invest-muted)]">
                        {p.paid_at || "—"}
                      </td>
                      <td className="border-b border-[var(--invest-border)] py-2">
                        <Link href={`/pagamentos/${p.id}`} className="invest-button inline-flex px-3 py-1 text-xs">
                          Abrir
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </section>

      {bid?.provenance && bid.provenance.length > 0 ? (
        <section className="invest-card p-5 sm:p-6">
          <p className="invest-section-title">Provas de origem</p>
          <div className="mt-4">
            <ProvenanceTable rows={bid.provenance} />
          </div>
        </section>
      ) : null}
    </div>
  );
}
