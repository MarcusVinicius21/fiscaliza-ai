"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { SkeletonBlock } from "@/components/app/skeleton-block";
import { ChainStatusBadge } from "@/components/facts/chain-status-badge";
import { ChainView } from "@/components/facts/chain-view";
import { FactSummaryGrid, FactSummaryItem } from "@/components/facts/fact-summary-grid";
import { GapCallout } from "@/components/facts/gap-callout";
import { ProvenanceTable, ProvenanceRow } from "@/components/facts/provenance-table";
import { ValueCompareCard } from "@/components/facts/value-compare-card";
import { safeDetail, safeNetworkMessage } from "@/lib/http-errors";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8000";

interface ContractDetail {
  id: string;
  number?: string | null;
  raw_number?: string | null;
  supplier_canonical_name?: string | null;
  supplier_name?: string | null;
  supplier_id?: string | null;
  city_name?: string | null;
  modality?: string | null;
  signed_at?: string | null;
  object_summary?: string | null;
  contract_value?: number | null;
  total_paid?: number | null;
  bid_link_status?: string | null;
  provenance?: ProvenanceRow[];
  fragmentation_signal?: {
    related_contracts_count?: number | null;
    total_related_value?: number | null;
    sample_numbers?: string[];
  } | null;
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
  bid?: {
    id?: string;
    number?: string | null;
    raw_number?: string | null;
    modality?: string | null;
    status?: string | null;
    value?: number | null;
    published_at?: string | null;
  } | null;
  contract?: ContractDetail | null;
  payments?: PaymentRow[];
}

interface ContractResponse {
  status?: string;
  contract?: ContractDetail | null;
}

function money(value: number | null | undefined): string {
  if (typeof value !== "number") return "—";
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export default function ContratoDetailPage() {
  const params = useParams<{ id: string }>();
  const id = params?.id;

  const [contract, setContract] = useState<ContractDetail | null>(null);
  const [contractLoading, setContractLoading] = useState(true);
  const [contractError, setContractError] = useState("");

  const [chain, setChain] = useState<ChainPayload | null>(null);
  const [chainLoading, setChainLoading] = useState(true);
  const [chainError, setChainError] = useState("");

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    async function loadContract() {
      setContractLoading(true);
      setContractError("");
      try {
        const response = await fetch(`${API_BASE}/contracts/${id}`);
        const data = (await response.json().catch(() => null)) as ContractResponse | null;
        if (!response.ok) {
          throw new Error(
            safeDetail(
              data,
              "Não foi possível carregar este contrato agora. Tente novamente em instantes.",
            ),
          );
        }
        if (!cancelled) setContract(data?.contract ?? null);
      } catch (error: unknown) {
        if (!cancelled) {
          setContractError(
            safeNetworkMessage(
              error,
              "Não foi possível carregar este contrato agora. Tente novamente em instantes.",
            ),
          );
        }
      } finally {
        if (!cancelled) setContractLoading(false);
      }
    }
    loadContract();
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
        const response = await fetch(`${API_BASE}/contracts/${id}/chain`);
        const data = (await response.json().catch(() => null)) as ChainPayload | null;
        if (!response.ok) {
          throw new Error(
            safeDetail(
              data,
              "Não foi possível carregar a cadeia deste contrato agora. Tente novamente em instantes.",
            ),
          );
        }
        if (!cancelled) setChain(data);
      } catch (error: unknown) {
        if (!cancelled) {
          setChainError(
            safeNetworkMessage(
              error,
              "Não foi possível carregar a cadeia deste contrato agora. Tente novamente em instantes.",
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

  const contractValue = typeof contract?.contract_value === "number" ? contract.contract_value : 0;
  const totalPaid = typeof contract?.total_paid === "number" ? contract.total_paid : 0;
  const overPaid = totalPaid > contractValue && contractValue > 0;

  const summary: FactSummaryItem[] = contract
    ? [
        { label: "Valor contratado (R$)", value: contractValue },
        { label: "Total pago (R$)", value: totalPaid },
        {
          label: "Diferença (R$)",
          value: totalPaid - contractValue,
          tone: overPaid ? "danger" : "default",
        },
        { label: "Modalidade", value: contract.modality || "—" },
      ]
    : [];

  const payments = chain?.payments || [];

  return (
    <div className="page-shell">
      <section className="page-header px-5 py-5 sm:px-6">
        <p className="invest-eyebrow">Contrato</p>
        {contractLoading ? (
          <div className="mt-3 max-w-3xl">
            <SkeletonBlock lines={3} />
          </div>
        ) : contractError ? (
          <p className="mt-3 text-sm font-bold text-[var(--invest-danger)]">{contractError}</p>
        ) : contract ? (
          <div className="mt-3 max-w-3xl">
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="invest-title text-2xl sm:text-[2rem]">
                {contract.raw_number || contract.number || "Contrato"}
              </h1>
              <ChainStatusBadge status={contract.bid_link_status || "unlinked"} />
            </div>
            <p className="invest-subtitle mt-3 text-sm sm:text-base">
              {contract.supplier_canonical_name || contract.supplier_name || "Fornecedor não identificado"}
              {contract.city_name ? ` — ${contract.city_name}` : ""}
            </p>
            {contract.object_summary ? (
              <p className="mt-2 text-sm text-[var(--invest-muted)]">{contract.object_summary}</p>
            ) : null}
          </div>
        ) : null}
      </section>

      {!contractLoading && contract ? (
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
            <ChainView
              bid={chain?.bid || null}
              contract={contract || chain?.contract || null}
              payments={payments}
            />
          )}
        </div>
      </section>

      <section className="invest-card p-5 sm:p-6">
        <p className="invest-section-title">Licitação de origem</p>
        <div className="mt-4">
          {chainLoading ? (
            <SkeletonBlock lines={3} />
          ) : chainError ? (
            <p className="text-sm font-bold text-[var(--invest-danger)]">{chainError}</p>
          ) : chain?.bid ? (
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="font-mono text-sm text-[var(--invest-heading)]">
                  {chain.bid.raw_number || chain.bid.number}
                </p>
                <p className="mt-1 text-sm text-[var(--invest-muted)]">
                  {chain.bid.modality || "—"}
                  {chain.bid.published_at ? ` · ${chain.bid.published_at}` : ""}
                </p>
              </div>
              {chain.bid.id ? (
                <Link href={`/licitacoes/${chain.bid.id}`} className="invest-button inline-flex px-4">
                  Abrir licitação
                </Link>
              ) : null}
            </div>
          ) : (
            <GapCallout kind="no_bid" />
          )}
        </div>
      </section>

      <section className="invest-card p-5 sm:p-6">
        <p className="invest-section-title">Pagamentos vinculados</p>
        <div className="mt-4">
          {chainLoading ? (
            <SkeletonBlock lines={4} />
          ) : chainError ? (
            <p className="text-sm font-bold text-[var(--invest-danger)]">{chainError}</p>
          ) : payments.length === 0 ? (
            <p className="text-sm text-[var(--invest-muted)]">
              Nenhum pagamento vinculado a este contrato foi encontrado no acervo atual.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-sm">
                <thead>
                  <tr className="text-left text-xs font-black uppercase tracking-[0.12em] text-[var(--invest-faint)]">
                    <th className="border-b border-[var(--invest-border)] py-2 pr-3">Número</th>
                    <th className="border-b border-[var(--invest-border)] py-2 pr-3">Data</th>
                    <th className="border-b border-[var(--invest-border)] py-2 pr-3">Valor</th>
                    <th className="border-b border-[var(--invest-border)] py-2">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {payments.map((p) => (
                    <tr key={p.id}>
                      <td className="border-b border-[var(--invest-border)] py-2 pr-3 font-mono text-xs text-[var(--invest-heading)]">
                        {p.raw_number || p.number || p.id.slice(0, 8)}
                      </td>
                      <td className="border-b border-[var(--invest-border)] py-2 pr-3 text-[var(--invest-muted)]">
                        {p.paid_at || "—"}
                      </td>
                      <td className="border-b border-[var(--invest-border)] py-2 pr-3 text-[var(--invest-heading)]">
                        {money(p.amount)}
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

      {!contractLoading && contract ? (
        <section className="invest-card p-5 sm:p-6 space-y-4">
          <ValueCompareCard contractValue={contractValue} totalPaid={totalPaid} />
          {overPaid ? <GapCallout kind="over_paid" /> : null}
          {contract.fragmentation_signal?.related_contracts_count ? (
            <GapCallout
              kind="object_repeat"
              detail={
                contract.fragmentation_signal.sample_numbers?.length
                  ? `Outros contratos com objeto semelhante: ${contract.fragmentation_signal.sample_numbers.join(", ")}`
                  : undefined
              }
            />
          ) : null}
        </section>
      ) : null}

      {contract?.provenance && contract.provenance.length > 0 ? (
        <section className="invest-card p-5 sm:p-6">
          <p className="invest-section-title">Provas de origem</p>
          <div className="mt-4">
            <ProvenanceTable rows={contract.provenance} />
          </div>
        </section>
      ) : null}
    </div>
  );
}
