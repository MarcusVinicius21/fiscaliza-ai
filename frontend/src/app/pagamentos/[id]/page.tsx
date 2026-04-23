"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { SkeletonBlock } from "@/components/app/skeleton-block";
import { ChainView } from "@/components/facts/chain-view";
import { ChainStatusBadge } from "@/components/facts/chain-status-badge";
import { FactSummaryGrid, FactSummaryItem } from "@/components/facts/fact-summary-grid";
import { GapCallout } from "@/components/facts/gap-callout";
import { LinkBasisPill } from "@/components/facts/link-basis-pill";
import { ProvenanceRow, ProvenanceTable } from "@/components/facts/provenance-table";
import { safeDetail, safeNetworkMessage } from "@/lib/http-errors";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8000";

interface PaymentDetail {
  id: string;
  number?: string | null;
  raw_number?: string | null;
  supplier_canonical_name?: string | null;
  supplier_name?: string | null;
  amount?: number | null;
  paid_at?: string | null;
  city_name?: string | null;
  contract_link_status?: string | null;
  provenance?: ProvenanceRow[];
}

interface ContractBlock {
  id: string;
  number?: string | null;
  raw_number?: string | null;
  supplier_canonical_name?: string | null;
  contract_value?: number | null;
  signed_at?: string | null;
  modality?: string | null;
}

interface BidBlock {
  id: string;
  number?: string | null;
  raw_number?: string | null;
  modality?: string | null;
  process_number?: string | null;
}

interface ContractLinkPayload {
  status?: string | null;
  payment?: {
    id?: string;
    number?: string | null;
    raw_number?: string | null;
    amount?: number | null;
    paid_at?: string | null;
    contract_link_status?: string | null;
    bid_link_status?: string | null;
  } | null;
  contract?: ContractBlock | null;
  bid?: BidBlock | null;
  link_status?: string | null;
  link_basis?: string | null;
  link_reason?: string | null;
}

interface PaymentResponse {
  status?: string;
  payment?: PaymentDetail | null;
}

function money(value: number | null | undefined): string {
  if (typeof value !== "number") return "—";
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export default function PagamentoDetailPage() {
  const params = useParams<{ id: string }>();
  const id = params?.id;

  const [payment, setPayment] = useState<PaymentDetail | null>(null);
  const [paymentLoading, setPaymentLoading] = useState(true);
  const [paymentError, setPaymentError] = useState("");

  const [link, setLink] = useState<ContractLinkPayload | null>(null);
  const [linkLoading, setLinkLoading] = useState(true);
  const [linkError, setLinkError] = useState("");

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    async function loadPayment() {
      setPaymentLoading(true);
      setPaymentError("");
      try {
        const response = await fetch(`${API_BASE}/payments/${id}`);
        const data = (await response.json().catch(() => null)) as PaymentResponse | null;
        if (!response.ok) {
          throw new Error(
            safeDetail(
              data,
              "Não foi possível carregar este pagamento agora. Tente novamente em instantes.",
            ),
          );
        }
        if (!cancelled) setPayment(data?.payment ?? null);
      } catch (error: unknown) {
        if (!cancelled) {
          setPaymentError(
            safeNetworkMessage(
              error,
              "Não foi possível carregar este pagamento agora. Tente novamente em instantes.",
            ),
          );
        }
      } finally {
        if (!cancelled) setPaymentLoading(false);
      }
    }
    loadPayment();
    return () => {
      cancelled = true;
    };
  }, [id]);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    async function loadLink() {
      setLinkLoading(true);
      setLinkError("");
      try {
        const response = await fetch(`${API_BASE}/payments/${id}/contract-link`);
        const data = (await response.json().catch(() => null)) as ContractLinkPayload | null;
        if (!response.ok) {
          throw new Error(
            safeDetail(
              data,
              "Não foi possível carregar o vínculo contratual deste pagamento agora. Tente novamente em instantes.",
            ),
          );
        }
        if (!cancelled) setLink(data);
      } catch (error: unknown) {
        if (!cancelled) {
          setLinkError(
            safeNetworkMessage(
              error,
              "Não foi possível carregar o vínculo contratual deste pagamento agora. Tente novamente em instantes.",
            ),
          );
        }
      } finally {
        if (!cancelled) setLinkLoading(false);
      }
    }
    loadLink();
    return () => {
      cancelled = true;
    };
  }, [id]);

  const summary: FactSummaryItem[] = payment
    ? [
        { label: "Valor pago (R$)", value: typeof payment.amount === "number" ? payment.amount : 0 },
        { label: "Data", value: payment.paid_at || "—" },
        { label: "Cidade", value: payment.city_name || "—" },
        { label: "Fornecedor", value: payment.supplier_canonical_name || payment.supplier_name || "—" },
      ]
    : [];

  return (
    <div className="page-shell">
      <section className="page-header px-5 py-5 sm:px-6">
        <p className="invest-eyebrow">Pagamento</p>
        {paymentLoading ? (
          <div className="mt-3 max-w-3xl">
            <SkeletonBlock lines={3} />
          </div>
        ) : paymentError ? (
          <p className="mt-3 text-sm font-bold text-[var(--invest-danger)]">{paymentError}</p>
        ) : payment ? (
          <div className="mt-3 max-w-3xl">
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="invest-title text-2xl sm:text-[2rem]">
                {payment.raw_number || payment.number || "Pagamento"}
              </h1>
              <ChainStatusBadge status={payment.contract_link_status || link?.link_status || "unlinked"} />
            </div>
            <p className="invest-subtitle mt-3 text-sm sm:text-base">
              {payment.supplier_canonical_name || payment.supplier_name || "Fornecedor não identificado"}
              {payment.city_name ? ` — ${payment.city_name}` : ""}
            </p>
          </div>
        ) : null}
      </section>

      {!paymentLoading && payment ? (
        <section className="invest-card p-5 sm:p-6">
          <FactSummaryGrid items={summary} />
        </section>
      ) : null}

      <section className="invest-card p-5 sm:p-6">
        <p className="invest-section-title">Cadeia factual</p>
        <div className="mt-4">
          {linkLoading ? (
            <SkeletonBlock lines={5} />
          ) : linkError ? (
            <p className="text-sm font-bold text-[var(--invest-danger)]">{linkError}</p>
          ) : (
            <ChainView bid={link?.bid || null} contract={link?.contract || null} payments={payment ? [payment] : []} />
          )}
        </div>
      </section>

      <section className="invest-card p-5 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="invest-section-title">Contrato vinculado</p>
          {link?.link_basis ? (
            <LinkBasisPill basis={link.link_basis} reason={link.link_reason} />
          ) : null}
        </div>
        <div className="mt-4">
          {linkLoading ? (
            <SkeletonBlock lines={3} />
          ) : linkError ? (
            <p className="text-sm font-bold text-[var(--invest-danger)]">{linkError}</p>
          ) : link?.contract ? (
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="font-mono text-sm text-[var(--invest-heading)]">
                  {link.contract.raw_number || link.contract.number}
                </p>
                <p className="mt-1 text-sm text-[var(--invest-muted)]">
                  {link.contract.supplier_canonical_name || "—"}
                  {link.contract.modality ? ` · ${link.contract.modality}` : ""}
                  {link.contract.signed_at ? ` · ${link.contract.signed_at}` : ""}
                </p>
                <p className="mt-1 text-sm text-[var(--invest-heading)]">
                  Valor contratado: {money(link.contract.contract_value)}
                </p>
              </div>
              <Link href={`/contratos/${link.contract.id}`} className="invest-button inline-flex px-4">
                Abrir contrato
              </Link>
            </div>
          ) : (
            <GapCallout kind="no_contract" />
          )}
        </div>
      </section>

      <section className="invest-card p-5 sm:p-6">
        <p className="invest-section-title">Licitação alcançada pela cadeia</p>
        <div className="mt-4">
          {linkLoading ? (
            <SkeletonBlock lines={3} />
          ) : linkError ? (
            <p className="text-sm font-bold text-[var(--invest-danger)]">{linkError}</p>
          ) : link?.bid ? (
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="font-mono text-sm text-[var(--invest-heading)]">
                  {link.bid.raw_number || link.bid.number}
                </p>
                <p className="mt-1 text-sm text-[var(--invest-muted)]">
                  Processo {link.bid.process_number || "não informado"}
                  {link.bid.modality ? ` · ${link.bid.modality}` : ""}
                </p>
              </div>
              <Link href={`/licitacoes/${link.bid.id}`} className="invest-button inline-flex px-4">
                Abrir licitação
              </Link>
            </div>
          ) : (
            <p className="text-sm text-[var(--invest-muted)]">
              Este pagamento não alcança uma licitação pela cadeia atual. Pode ser dispensa/inexigibilidade ou lacuna de dado.
            </p>
          )}
        </div>
      </section>

      {payment?.provenance && payment.provenance.length > 0 ? (
        <section className="invest-card p-5 sm:p-6">
          <p className="invest-section-title">Provas de origem</p>
          <div className="mt-4">
            <ProvenanceTable rows={payment.provenance} />
          </div>
        </section>
      ) : null}
    </div>
  );
}
