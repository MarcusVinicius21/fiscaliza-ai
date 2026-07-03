"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { SkeletonBlock } from "@/components/app/skeleton-block";
import { StatusPill } from "@/components/app/status-pill";
import {
  AttentionPointCard,
  FactLinkStatusSummary,
  EmptyStateWithReason,
} from "@/components/product/investigative-product";
import { parseMoney } from "@/lib/product-diagnostics";
import { supabase } from "@/lib/supabase";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8000";

interface SupplierAlert {
  id: string;
  title: string;
  explanation?: string | null;
  severity?: string | null;
  amount?: number | null;
  created_at?: string | null;
  link_source?: string | null;
  link_label?: string | null;
}

interface SupplierOverviewPayload {
  status: string;
  supplier: {
    id: string;
    entity_type: string;
    canonical_name: string;
    document?: string | null;
    source_confidence?: number | null;
    aliases: string[];
    alias_details?: Array<{
      alias_name?: string | null;
      alias_type?: string | null;
      source_upload_id?: string | null;
      source_file_name?: string | null;
      occurrences_count?: number | null;
      created_at?: string | null;
    }>;
  };
  summary: {
    uploads_count: number;
    cities_count: number;
    categories_count: number;
    records_count: number;
    total_amount: number;
    alerts_count: number;
    relative_rank?: number | null;
  };
  cities: Array<{
    city_id: string;
    city_name: string;
    state?: string | null;
    records_count: number;
    total_amount: number;
  }>;
  categories: Array<{
    category: string;
    records_count: number;
    total_amount: number;
  }>;
  timeline: Array<{
    period: string;
    records_count: number;
    total_amount: number;
  }>;
  uploads: Array<{
    upload_id: string;
    file_name?: string | null;
    report_type?: string | null;
    report_label?: string | null;
    category?: string | null;
    created_at?: string | null;
    records_count: number;
    total_amount: number;
  }>;
  related_alerts: SupplierAlert[];
}

interface SupplierRecord {
  record_id: string;
  upload_id: string;
  city_id?: string | null;
  file_name?: string | null;
  category?: string | null;
  report_type?: string | null;
  report_label?: string | null;
  city_name?: string | null;
  state?: string | null;
  document?: string | null;
  valor_bruto: number;
  tipo_ato?: string | null;
  modalidade?: string | null;
  data?: string | null;
  summary: string;
  alerts: Array<{ id: string; title: string; severity?: string | null; link_label?: string | null }>;
}

interface SupplierRecordsPayload {
  status: string;
  page: number;
  page_size: number;
  total: number;
  items: SupplierRecord[];
}

interface PossibleDuplicateItem {
  entity_id: string;
  canonical_name?: string | null;
  document?: string | null;
  reason: string;
  confidence_label: "provável" | "indício" | string;
  evidence?: {
    shared_document?: boolean;
    shared_normalized_name?: boolean;
    shared_alias?: boolean;
    shared_uploads_count?: number;
    records_count?: number;
  };
}

interface PossibleDuplicatesPayload {
  status: string;
  total: number;
  items: PossibleDuplicateItem[];
  note?: string;
}

interface SupplierSpendFacts {
  contracts: Array<{
    id: string;
    contract_number_raw?: string | null;
    contract_value?: number | null;
    bid_link_status?: string | null;
    object_text?: string | null;
  }>;
  payments: Array<{
    id: string;
    payment_number_raw?: string | null;
    payment_value?: number | null;
    contract_link_status?: string | null;
    payment_date?: string | null;
  }>;
}

function formatMoney(value: number) {
  return value.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

function formatDocument(value?: string | null) {
  const digits = String(value || "").replace(/\D/g, "");
  if (digits.length === 14) {
    return digits.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, "$1.$2.$3/$4-$5");
  }
  if (digits.length === 11) {
    return digits.replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/, "$1.$2.$3-$4");
  }
  return value || "Sem documento";
}

function isContractRecord(record: SupplierRecord) {
  return String(record.category || "").toLowerCase() === "contracts";
}

function isPaymentRecord(record: SupplierRecord) {
  const category = String(record.category || "").toLowerCase();
  const reportType = String(record.report_type || "").toLowerCase();
  return category === "expenses" || reportType === "pagamentos" || reportType === "pagamento";
}

function safeDetail(payload: unknown, fallback: string) {
  const detail =
    payload &&
    typeof payload === "object" &&
    "detail" in payload &&
    typeof (payload as { detail?: unknown }).detail === "string"
      ? String((payload as { detail?: string }).detail).trim()
      : "";

  if (!detail) return fallback;
  if (/failed to fetch|remoteprotocolerror|server disconnected|traceback|httpx/i.test(detail)) {
    return fallback;
  }
  return detail;
}

function safeNetworkMessage(error: unknown, fallback: string) {
  if (error instanceof Error) {
    const message = String(error.message || "").trim();
    if (message && !/failed to fetch|remoteprotocolerror|server disconnected|traceback|httpx/i.test(message)) {
      return message;
    }
  }
  return fallback;
}

export default function SupplierDetailPage() {
  const params = useParams<{ id: string }>();
  const supplierId = String(params?.id || "");

  const [overview, setOverview] = useState<SupplierOverviewPayload | null>(null);
  const [recordsPayload, setRecordsPayload] = useState<SupplierRecordsPayload | null>(null);
  const [loadingOverview, setLoadingOverview] = useState(true);
  const [loadingRecords, setLoadingRecords] = useState(true);
  const [overviewError, setOverviewError] = useState("");
  const [recordsError, setRecordsError] = useState("");
  const [duplicatesPayload, setDuplicatesPayload] = useState<PossibleDuplicatesPayload | null>(null);
  const [loadingDuplicates, setLoadingDuplicates] = useState(true);
  const [duplicatesError, setDuplicatesError] = useState("");
  const [recordsPage, setRecordsPage] = useState(1);
  const [selectedUpload, setSelectedUpload] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("");
  const [selectedCity, setSelectedCity] = useState("");
  const [alertFilter, setAlertFilter] = useState("");
  const [recordQuery, setRecordQuery] = useState("");
  const [spendFacts, setSpendFacts] = useState<SupplierSpendFacts>({ contracts: [], payments: [] });
  const [spendFactsError, setSpendFactsError] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function loadOverview() {
      if (!supplierId) return;

      setLoadingOverview(true);
      setOverviewError("");

      try {
        const response = await fetch(`${API_BASE}/suppliers/${supplierId}`);
        const payload = (await response.json().catch(() => null)) as SupplierOverviewPayload | null;

        if (!response.ok) {
          throw new Error(
            safeDetail(payload, "Não foi possível carregar este fornecedor agora. Tente novamente em instantes.")
          );
        }

        if (!cancelled) {
          setOverview(payload);
        }
      } catch (error: unknown) {
        if (!cancelled) {
          setOverviewError(
            safeNetworkMessage(
              error,
              "Não foi possível carregar este fornecedor agora. Tente novamente em instantes."
            )
          );
        }
      } finally {
        if (!cancelled) {
          setLoadingOverview(false);
        }
      }
    }

    loadOverview();
    return () => {
      cancelled = true;
    };
  }, [supplierId]);

  useEffect(() => {
    let cancelled = false;

    async function loadPossibleDuplicates() {
      if (!supplierId) return;
      setLoadingDuplicates(true);
      setDuplicatesError("");

      try {
        const response = await fetch(`${API_BASE}/suppliers/${supplierId}/possible-duplicates?limit=8`);
        const payload = (await response.json().catch(() => null)) as PossibleDuplicatesPayload | null;

        if (!response.ok) {
          throw new Error(
            safeDetail(payload, "Não foi possível carregar possíveis duplicidades agora.")
          );
        }

        if (!cancelled) {
          setDuplicatesPayload(payload);
        }
      } catch (error: unknown) {
        if (!cancelled) {
          setDuplicatesError(
            safeNetworkMessage(
              error,
              "Não foi possível carregar possíveis duplicidades agora. Tente novamente em instantes."
            )
          );
        }
      } finally {
        if (!cancelled) {
          setLoadingDuplicates(false);
        }
      }
    }

    loadPossibleDuplicates();
    return () => {
      cancelled = true;
    };
  }, [supplierId]);

  useEffect(() => {
    let cancelled = false;

    async function loadRecords() {
      if (!supplierId) return;

      setLoadingRecords(true);
      setRecordsError("");

      try {
        const params = new URLSearchParams({
          page: String(recordsPage),
          page_size: "20",
        });
        if (selectedUpload) params.set("upload_id", selectedUpload);
        if (selectedCategory) params.set("category", selectedCategory);
        if (selectedCity) params.set("city_id", selectedCity);
        if (alertFilter === "with") params.set("has_alert", "true");
        if (alertFilter === "without") params.set("has_alert", "false");
        if (recordQuery.trim()) params.set("q", recordQuery.trim());

        const response = await fetch(`${API_BASE}/suppliers/${supplierId}/records?${params.toString()}`);
        const payload = (await response.json().catch(() => null)) as SupplierRecordsPayload | null;

        if (!response.ok) {
          throw new Error(
            safeDetail(payload, "Não foi possível carregar os registros deste fornecedor agora.")
          );
        }

        if (!cancelled) {
          setRecordsPayload(payload);
        }
      } catch (error: unknown) {
        if (!cancelled) {
          setRecordsError(
            safeNetworkMessage(
              error,
              "Não foi possível carregar os registros deste fornecedor agora. Tente novamente em instantes."
            )
          );
        }
      } finally {
        if (!cancelled) {
          setLoadingRecords(false);
        }
      }
    }

    loadRecords();
    return () => {
      cancelled = true;
    };
  }, [supplierId, recordsPage, selectedUpload, selectedCategory, selectedCity, alertFilter, recordQuery]);

  useEffect(() => {
    setRecordsPage(1);
  }, [selectedUpload, selectedCategory, selectedCity, alertFilter, recordQuery]);

  useEffect(() => {
    let cancelled = false;

    async function loadSpendFacts() {
      if (!supplierId) return;
      setSpendFactsError("");
      const [contractsRes, paymentsRes] = await Promise.all([
        supabase
          .from("contracts_facts")
          .select("id, contract_number_raw, contract_value, bid_link_status, object_text")
          .eq("supplier_entity_id", supplierId)
          .limit(100),
        supabase
          .from("payments_facts")
          .select("id, payment_number_raw, payment_value, contract_link_status, payment_date")
          .eq("supplier_entity_id", supplierId)
          .limit(100),
      ]);

      if (cancelled) return;
      if (contractsRes.error || paymentsRes.error) {
        setSpendFactsError("Não foi possível carregar os contratos e pagamentos deste fornecedor agora.");
        return;
      }
      setSpendFacts({
        contracts: (contractsRes.data || []) as SupplierSpendFacts["contracts"],
        payments: (paymentsRes.data || []) as SupplierSpendFacts["payments"],
      });
    }

    loadSpendFacts();
    return () => {
      cancelled = true;
    };
  }, [supplierId]);

  const maxTimelineAmount = useMemo(() => {
    return Math.max(...(overview?.timeline || []).map((item) => item.total_amount), 0);
  }, [overview]);

  const totalPages = useMemo(() => {
    if (!recordsPayload) return 1;
    return Math.max(1, Math.ceil(recordsPayload.total / recordsPayload.page_size));
  }, [recordsPayload]);

  if (loadingOverview) {
    return (
      <div className="page-shell">
        <section className="invest-card p-6">
          <SkeletonBlock lines={6} />
        </section>
      </div>
    );
  }

  if (overviewError && !overview) {
    return (
      <div className="page-shell">
        <section className="invest-card p-6">
          <p className="text-sm font-bold text-[var(--invest-danger)]">{overviewError}</p>
        </section>
      </div>
    );
  }

  if (!overview) {
    return null;
  }

  const alertItems = overview.related_alerts || [];
  const possibleDuplicates = duplicatesPayload?.items || [];
  const records = recordsPayload?.items || [];
  const contractRecords = records.filter(isContractRecord);
  const paymentRecords = records.filter(isPaymentRecord);
  const contractCategory = overview.categories.find((item) => String(item.category || "").toLowerCase() === "contracts");
  const totalContracted = spendFacts.contracts.length > 0
    ? spendFacts.contracts.reduce((sum, item) => sum + parseMoney(item.contract_value || 0), 0)
    : contractRecords.reduce((sum, item) => sum + parseMoney(item.valor_bruto || 0), 0) || parseMoney(contractCategory?.total_amount || 0);
  const totalReceived = spendFacts.payments.length > 0
    ? spendFacts.payments.reduce((sum, item) => sum + parseMoney(item.payment_value || 0), 0)
    : paymentRecords.reduce((sum, item) => sum + parseMoney(item.valor_bruto || 0), 0);
  const contractVisualCount = spendFacts.contracts.length || contractRecords.length || Number(contractCategory?.records_count || 0);
  const paymentVisualCount = spendFacts.payments.length || paymentRecords.length;
  const contractsWithoutBid = spendFacts.contracts.filter((item) => (item.bid_link_status || "unlinked") === "unlinked").length;
  const paymentsWithoutContract = spendFacts.payments.filter((item) => (item.contract_link_status || "unlinked") === "unlinked").length;

  return (
    <div className="page-shell">
      <section className="page-header px-5 py-5 sm:px-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="max-w-3xl">
            <p className="invest-eyebrow">Visão por fornecedor</p>
            <h1 className="invest-title mt-3 text-2xl sm:text-[2rem]">
              {overview.supplier.canonical_name}
            </h1>
            <p className="invest-subtitle mt-3 text-sm sm:text-base">
              Histórico consolidado por fornecedor, com linhas, arquivos e alertas relacionados.
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              <StatusPill tone="info">
                {overview.supplier.entity_type === "organization" ? "Organização" : "Fornecedor"}
              </StatusPill>
              <span className="app-chip">{formatDocument(overview.supplier.document)}</span>
              {overview.summary.relative_rank ? (
                <span className="app-chip">Ranking #{overview.summary.relative_rank}</span>
              ) : null}
            </div>
          </div>

          <Link href="/search" className="invest-button-secondary px-4">
            Voltar para busca
          </Link>
          <Link href={`/relatorios/fornecedor/${supplierId}`} className="invest-button px-4">
            Abrir relatório
          </Link>
        </div>

        {overview.supplier.aliases.length > 0 ? (
          <div className="mt-5 flex flex-wrap gap-2">
            {overview.supplier.aliases.slice(0, 4).map((alias) => (
              <span key={alias} className="app-chip">
                {alias}
              </span>
            ))}
          </div>
        ) : null}
      </section>

      <section className="invest-card p-5 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="invest-section-title">Nomes encontrados no arquivo</p>
            <p className="mt-1 text-sm text-[var(--invest-muted)]">
              Use estes nomes para conferir se o fornecedor aparece com grafias diferentes.
            </p>
          </div>
          <StatusPill tone="info">Nome principal</StatusPill>
        </div>

        <div className="mt-4 grid gap-3 lg:grid-cols-2">
          <article className="invest-card-solid p-4">
            <p className="metric-label">Nome principal</p>
            <p className="mt-2 text-sm font-black text-[var(--invest-heading)]">
              {overview.supplier.canonical_name}
            </p>
            <p className="mt-1 text-xs text-[var(--invest-muted)]">
              Documento encontrado: {formatDocument(overview.supplier.document)}
            </p>
          </article>

          {(overview.supplier.alias_details || []).length > 0 ? (
            overview.supplier.alias_details?.slice(0, 6).map((alias) => (
              <article key={`${alias.alias_name}-${alias.source_upload_id}`} className="invest-card-solid p-4">
                <p className="metric-label">Nome encontrado no arquivo</p>
                <p className="mt-2 text-sm font-black text-[var(--invest-heading)]">
                  {alias.alias_name || "nome não informado"}
                </p>
                <p className="mt-1 text-xs text-[var(--invest-muted)]">
                  Arquivo de origem: {alias.source_file_name || "não informado"}
                </p>
                <p className="mt-1 text-xs text-[var(--invest-muted)]">
                  Apareceu {alias.occurrences_count || 1} vez(es) neste recorte.
                </p>
              </article>
            ))
          ) : overview.supplier.aliases.length > 0 ? (
            overview.supplier.aliases.slice(0, 6).map((alias) => (
              <article key={alias} className="invest-card-solid p-4">
                <p className="metric-label">Nome encontrado no arquivo</p>
                <p className="mt-2 text-sm font-black text-[var(--invest-heading)]">{alias}</p>
                <p className="mt-1 text-xs text-[var(--invest-muted)]">Arquivo de origem não informado.</p>
              </article>
            ))
          ) : (
            <article className="invest-card-solid p-4">
              <p className="text-sm text-[var(--invest-muted)]">
                Nenhum outro nome foi encontrado para este fornecedor.
              </p>
            </article>
          )}
        </div>
      </section>

      <section className="invest-card p-5 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="invest-section-title">Possíveis duplicidades</p>
            <p className="mt-1 text-sm text-[var(--invest-muted)]">
              Estes nomes ou documentos parecem parecidos. Confira antes de concluir que são o mesmo fornecedor.
            </p>
          </div>
          <StatusPill tone={possibleDuplicates.length > 0 ? "warning" : "success"}>
            {possibleDuplicates.length > 0 ? "precisa de conferência" : "sem indício"}
          </StatusPill>
        </div>

        <div className="mt-4 grid gap-3 lg:grid-cols-2">
          {loadingDuplicates ? (
            <div className="lg:col-span-2">
              <SkeletonBlock lines={4} />
            </div>
          ) : duplicatesError ? (
            <p className="text-sm font-bold text-[var(--invest-danger)]">{duplicatesError}</p>
          ) : possibleDuplicates.length === 0 ? (
            <p className="text-sm text-[var(--invest-muted)]">
              Nenhuma possível duplicidade encontrada com os dados atuais.
            </p>
          ) : (
            possibleDuplicates.map((item) => (
              <article key={item.entity_id} className="invest-card-highlight p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-black text-[var(--invest-heading)]">
                      {item.canonical_name || "Fornecedor sem nome"}
                    </p>
                    <p className="mt-1 text-xs text-[var(--invest-muted)]">
                      {formatDocument(item.document)}
                    </p>
                  </div>
                  <StatusPill tone={item.confidence_label === "provável" ? "warning" : "muted"}>
                    {item.confidence_label || "indício"}
                  </StatusPill>
                </div>
                <p className="mt-3 text-sm leading-6 text-[var(--invest-muted)]">
                  {item.reason}. Possível duplicidade — precisa de conferência.
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {item.evidence?.shared_document ? <span className="app-chip">mesmo documento</span> : null}
                  {item.evidence?.shared_alias ? <span className="app-chip">nome encontrado em comum</span> : null}
                  {item.evidence?.shared_uploads_count ? (
                    <span className="app-chip">{item.evidence.shared_uploads_count} arquivo(s) em comum</span>
                  ) : null}
                  <span className="app-chip">{item.evidence?.records_count || 0} linha(s)</span>
                </div>
                <Link href={`/fornecedores/${item.entity_id}`} className="invest-button-secondary mt-4 px-4">
                  Abrir histórico
                </Link>
              </article>
            ))
          )}
        </div>
      </section>

      <section className="invest-card p-5 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="invest-section-title">Fornecedor 360</p>
            <p className="mt-1 text-sm text-[var(--invest-muted)]">
              Leitura por contratos, pagamentos e linhas encontradas nos arquivos.
            </p>
          </div>
          <StatusPill tone={paymentsWithoutContract || contractsWithoutBid ? "warning" : "success"}>
            {paymentsWithoutContract || contractsWithoutBid ? "precisa de conferência" : "ligações encontradas"}
          </StatusPill>
        </div>

        {spendFactsError ? (
          <p className="mt-4 text-sm font-bold text-[var(--invest-danger)]">{spendFactsError}</p>
        ) : (
          <>
            <div className="mt-4 grid gap-3 sm:grid-cols-3">
              <article className="metric-card">
                <p className="metric-label">Total contratado</p>
                <p className="metric-value mt-2">{formatMoney(totalContracted)}</p>
              </article>
              <article className="metric-card">
                <p className="metric-label">Total pago</p>
                <p className="metric-value mt-2">{formatMoney(totalReceived)}</p>
              </article>
              <article className="metric-card">
                <p className="metric-label">Contratos / pagamentos</p>
                <p className="metric-value mt-2">{contractVisualCount} / {paymentVisualCount}</p>
                <p className="mt-1 text-xs text-[var(--invest-muted)]">itens encontrados nos arquivos</p>
              </article>
            </div>

            {paymentsWithoutContract || contractsWithoutBid || spendFacts.contracts.length === 0 ? (
              <div className="mt-5">
                <AttentionPointCard
                  title="Ligação automática não encontrada"
                  body="Quando não há ligação automática, a tela mostra linhas relacionadas como informação de apoio. Isso não afirma ligação direta com pagamento."
                  tone="info"
                />
              </div>
            ) : null}
          </>
        )}
      </section>

      <FactLinkStatusSummary
        contracts={{ total: contractVisualCount, unlinked: spendFacts.contracts.length ? contractsWithoutBid : contractVisualCount }}
        payments={{ total: paymentVisualCount, unlinked: spendFacts.payments.length ? paymentsWithoutContract : paymentVisualCount }}
        bids={{ total: 0, unlinked: 0 }}
      />

      <section className="grid gap-5 xl:grid-cols-2">
        <article className="invest-card p-5 sm:p-6">
          <p className="invest-section-title">Contratos / registros contratuais</p>
          <div className="mt-4 space-y-3">
            {spendFacts.contracts.length > 0 ? (
              spendFacts.contracts.slice(0, 8).map((contract) => (
                <div key={contract.id} className="invest-card-solid p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="font-mono text-sm text-[var(--invest-heading)]">
                        {contract.contract_number_raw || contract.id.slice(0, 8)}
                      </p>
                      <p className="mt-1 line-clamp-2 text-xs text-[var(--invest-muted)]">
                        {contract.object_text || "objeto não informado"}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-black text-[var(--invest-heading)]">
                        {formatMoney(parseMoney(contract.contract_value || 0))}
                      </p>
                      <StatusPill tone={(contract.bid_link_status || "unlinked") === "unlinked" ? "warning" : "success"}>
                        {(contract.bid_link_status || "unlinked") === "unlinked" ? "sem licitação" : "vinculado"}
                      </StatusPill>
                    </div>
                  </div>
                </div>
              ))
            ) : contractRecords.length > 0 ? (
              contractRecords.slice(0, 8).map((record) => (
                <div key={record.record_id} className="invest-card-solid p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="font-mono text-sm text-[var(--invest-heading)]">
                        {record.document || record.record_id.slice(0, 8)}
                      </p>
                      <p className="mt-1 text-xs text-[var(--invest-muted)]">
                        Registro contratual encontrado no arquivo.
                      </p>
                      <p className="mt-1 line-clamp-2 text-xs text-[var(--invest-muted)]">
                        {record.summary || "resumo não informado"}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-black text-[var(--invest-heading)]">
                        {formatMoney(parseMoney(record.valor_bruto || 0))}
                      </p>
                      <StatusPill tone="warning">sem pagamento ligado automaticamente</StatusPill>
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <EmptyStateWithReason reason="Nenhum contrato ou registro contratual foi associado a este fornecedor no acervo atual." />
            )}
          </div>
        </article>

        <article className="invest-card p-5 sm:p-6">
          <p className="invest-section-title">Pagamentos / registros financeiros</p>
          <div className="mt-4 space-y-3">
            {spendFacts.payments.length > 0 ? (
              spendFacts.payments.slice(0, 8).map((payment) => (
                <div key={payment.id} className="invest-card-solid p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="font-mono text-sm text-[var(--invest-heading)]">
                        {payment.payment_number_raw || payment.id.slice(0, 8)}
                      </p>
                      <p className="mt-1 text-xs text-[var(--invest-muted)]">
                        {payment.payment_date || "data não informada"}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-black text-[var(--invest-heading)]">
                        {formatMoney(parseMoney(payment.payment_value || 0))}
                      </p>
                      <StatusPill tone={(payment.contract_link_status || "unlinked") === "unlinked" ? "warning" : "success"}>
                        {(payment.contract_link_status || "unlinked") === "unlinked" ? "sem contrato" : "vinculado"}
                      </StatusPill>
                    </div>
                  </div>
                </div>
              ))
            ) : paymentRecords.length > 0 ? (
              paymentRecords.slice(0, 8).map((record) => (
                <div key={record.record_id} className="invest-card-solid p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="font-mono text-sm text-[var(--invest-heading)]">
                        {record.document || record.record_id.slice(0, 8)}
                      </p>
                      <p className="mt-1 text-xs text-[var(--invest-muted)]">
                        Registro financeiro encontrado na base carregada.
                      </p>
                      <p className="mt-1 text-xs text-[var(--invest-muted)]">
                        {record.data || "data não informada"}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-black text-[var(--invest-heading)]">
                        {formatMoney(parseMoney(record.valor_bruto || 0))}
                      </p>
                      <StatusPill tone="warning">sem pagamento vinculado automaticamente</StatusPill>
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <EmptyStateWithReason reason="Nenhum pagamento ou registro financeiro foi associado a este fornecedor no acervo atual." />
            )}
          </div>
        </article>
      </section>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <article className="metric-card">
          <p className="metric-label">Arquivos</p>
          <p className="metric-value mt-2">{overview.summary.uploads_count}</p>
        </article>
        <article className="metric-card">
          <p className="metric-label">Linhas</p>
          <p className="metric-value mt-2">{overview.summary.records_count}</p>
        </article>
        <article className="metric-card">
          <p className="metric-label">Valor total encontrado</p>
          <p className="metric-value mt-2">{formatMoney(overview.summary.total_amount)}</p>
        </article>
        <article className="metric-card">
          <p className="metric-label">Alertas relacionados</p>
          <p className="metric-value mt-2">{overview.summary.alerts_count}</p>
        </article>
        <article className="metric-card">
          <p className="metric-label">Cidades / categorias</p>
          <p className="metric-value mt-2">
            {overview.summary.cities_count} / {overview.summary.categories_count}
          </p>
        </article>
      </section>

      <section className="grid gap-5 xl:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
        <article className="invest-card p-5 sm:p-6">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="invest-section-title">Onde aparece</p>
              <p className="mt-1 text-sm text-[var(--invest-muted)]">Onde o fornecedor aparece por cidade.</p>
            </div>
            <StatusPill tone="muted">{overview.cities.length} cidade(s)</StatusPill>
          </div>

          <div className="mt-4 space-y-3">
            {overview.cities.map((city) => (
              <div key={city.city_id} className="invest-card-solid p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-black text-[var(--invest-heading)]">
                      {city.city_name}
                      {city.state ? `/${city.state}` : ""}
                    </p>
                    <p className="mt-1 text-xs text-[var(--invest-muted)]">
                      {city.records_count} linha(s) vinculadas
                    </p>
                  </div>
                  <p className="text-sm font-black text-[var(--invest-heading)]">
                    {formatMoney(city.total_amount)}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </article>

        <article className="invest-card p-5 sm:p-6">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="invest-section-title">Categorias</p>
              <p className="mt-1 text-sm text-[var(--invest-muted)]">
                Distribuição do fornecedor pelos tipos de arquivo.
              </p>
            </div>
          </div>

          <div className="mt-4 space-y-3">
            {overview.categories.map((category) => (
              <div key={category.category} className="invest-card-solid p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-black text-[var(--invest-heading)]">
                      {category.category || "Não informado"}
                    </p>
                    <p className="mt-1 text-xs text-[var(--invest-muted)]">
                      {category.records_count} linha(s)
                    </p>
                  </div>
                  <p className="text-sm font-black text-[var(--invest-heading)]">
                    {formatMoney(category.total_amount)}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </article>
      </section>

      <section className="grid gap-5 xl:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
        <article className="invest-card p-5 sm:p-6">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="invest-section-title">Linha do tempo simples</p>
              <p className="mt-1 text-sm text-[var(--invest-muted)]">
                Evolução mensal do volume encontrado.
              </p>
            </div>
          </div>

          <div className="mt-4 space-y-3">
            {overview.timeline.length === 0 ? (
              <p className="text-sm text-[var(--invest-muted)]">
                Ainda não há referência temporal suficiente para montar a série.
              </p>
            ) : (
              overview.timeline.map((item) => {
                const width =
                  maxTimelineAmount > 0
                    ? `${Math.max(10, (item.total_amount / maxTimelineAmount) * 100)}%`
                    : "10%";

                return (
                  <div key={item.period} className="space-y-2">
                    <div className="flex items-center justify-between gap-3 text-sm">
                      <span className="font-bold text-[var(--invest-heading)]">{item.period}</span>
                      <span className="text-[var(--invest-muted)]">
                        {formatMoney(item.total_amount)} · {item.records_count} linha(s)
                      </span>
                    </div>
                    <div className="h-2 rounded-full bg-[var(--invest-surface-soft)]">
                      <div className="h-2 rounded-full bg-[var(--invest-primary)]" style={{ width }} />
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </article>

        <article className="invest-card p-5 sm:p-6">
          <div className="flex items-center justify-between gap-3">
            <div>
          <p className="invest-section-title">Arquivos relacionados</p>
              <p className="mt-1 text-sm text-[var(--invest-muted)]">
                Arquivos onde este fornecedor apareceu.
              </p>
            </div>
          </div>

          <div className="mt-4 space-y-3">
            {overview.uploads.map((upload) => (
              <div key={upload.upload_id} className="invest-card-solid p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-black text-[var(--invest-heading)]">
                      {upload.file_name || "Arquivo sem nome"}
                    </p>
                    <p className="mt-1 text-xs text-[var(--invest-muted)]">
                      {upload.category || "categoria"} · {upload.report_type || "tipo"} ·{" "}
                      {upload.report_label || "sem rótulo"}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-black text-[var(--invest-heading)]">
                      {formatMoney(upload.total_amount)}
                    </p>
                    <p className="mt-1 text-xs text-[var(--invest-muted)]">
                      {upload.records_count} linha(s)
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </article>
      </section>

      <section className="invest-card p-5 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="invest-section-title">Alertas relacionados</p>
            <p className="mt-1 text-sm text-[var(--invest-muted)]">
              Ligações conservadoras com base no arquivo, no fornecedor e na linha de origem.
            </p>
          </div>
          <StatusPill tone="muted">{alertItems.length} alerta(s)</StatusPill>
        </div>

        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          {alertItems.length === 0 ? (
            <p className="text-sm text-[var(--invest-muted)]">
              Nenhum alerta vinculado com critério seguro até aqui.
            </p>
          ) : (
            alertItems.map((alert, index) => (
              <article key={alert.id} className="invest-card-highlight p-5">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="invest-eyebrow">Alerta {String(index + 1).padStart(2, "0")}</p>
                    <p className="mt-2 text-base font-black text-[var(--invest-heading)]">
                      {alert.title}
                    </p>
                  </div>
                  <StatusPill
                    tone={
                      alert.severity === "alta"
                        ? "danger"
                        : alert.severity === "media"
                          ? "warning"
                          : "info"
                    }
                  >
                    {alert.severity || "baixa"}
                  </StatusPill>
                </div>
                <p className="mt-3 text-sm leading-6 text-[var(--invest-muted)]">
                  {alert.explanation || "Sem explicação adicional."}
                </p>
                <div className="mt-4 flex items-center justify-between gap-3">
                  <span className="app-chip">{formatMoney(Number(alert.amount || 0))}</span>
                  <Link href={`/alerts/${alert.id}`} className="invest-button-secondary px-4">
                    Abrir alerta
                  </Link>
                </div>
              </article>
            ))
          )}
        </div>
      </section>

      <section className="invest-card p-5 sm:p-6">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="invest-section-title">Linhas encontradas</p>
            <p className="mt-1 text-sm text-[var(--invest-muted)]">
              Linhas ligadas a este fornecedor.
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <div>
              <label className="invest-label" htmlFor="supplier-upload-filter">
                Arquivo
              </label>
              <select
                id="supplier-upload-filter"
                className="invest-select min-w-[200px]"
                value={selectedUpload}
                onChange={(event) => setSelectedUpload(event.target.value)}
              >
                <option value="">Todos</option>
                {overview.uploads.map((upload) => (
                  <option key={upload.upload_id} value={upload.upload_id}>
                    {upload.file_name || upload.upload_id}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="invest-label" htmlFor="supplier-category-filter">
                Categoria
              </label>
              <select
                id="supplier-category-filter"
                className="invest-select min-w-[180px]"
                value={selectedCategory}
                onChange={(event) => setSelectedCategory(event.target.value)}
              >
                <option value="">Todas</option>
                {overview.categories.map((category) => (
                  <option key={category.category} value={category.category}>
                    {category.category}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="invest-label" htmlFor="supplier-city-filter">
                Cidade
              </label>
              <select
                id="supplier-city-filter"
                className="invest-select min-w-[180px]"
                value={selectedCity}
                onChange={(event) => setSelectedCity(event.target.value)}
              >
                <option value="">Todas</option>
                {overview.cities.map((city) => (
                  <option key={city.city_id} value={city.city_id}>
                    {city.city_name}
                    {city.state ? `/${city.state}` : ""}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="invest-label" htmlFor="supplier-alert-filter">
                Alertas
              </label>
              <select
                id="supplier-alert-filter"
                className="invest-select min-w-[170px]"
                value={alertFilter}
                onChange={(event) => setAlertFilter(event.target.value)}
              >
                <option value="">Todas</option>
                <option value="with">Com alerta</option>
                <option value="without">Sem alerta</option>
              </select>
            </div>

            <div>
              <label className="invest-label" htmlFor="supplier-record-query">
                Buscar nas linhas
              </label>
              <input
                id="supplier-record-query"
                className="invest-input min-w-[220px]"
                value={recordQuery}
                onChange={(event) => setRecordQuery(event.target.value)}
                placeholder="Resumo, documento ou arquivo"
              />
            </div>
          </div>
        </div>

        {recordsError ? (
          <div className="mt-4 rounded-lg border border-[var(--invest-danger-soft)] bg-[var(--invest-danger-bg)] px-4 py-3">
            <p className="text-sm font-medium text-[var(--invest-danger)]">{recordsError}</p>
          </div>
        ) : null}

        <div className="mt-5 overflow-x-auto rounded-lg border border-[var(--invest-border)]">
          {loadingRecords ? (
            <div className="p-5">
              <SkeletonBlock lines={4} />
            </div>
          ) : (
            <table className="invest-table min-w-[980px]">
              <thead>
                <tr>
                  <th>Arquivo</th>
                  <th>Cidade</th>
                  <th>Categoria</th>
                  <th>Documento</th>
                  <th>Valor</th>
                  <th>Data</th>
                  <th>Resumo</th>
                  <th>Alertas</th>
                </tr>
              </thead>
              <tbody>
                {(recordsPayload?.items || []).length === 0 ? (
                  <tr>
                    <td colSpan={8} className="text-sm text-[var(--invest-muted)]">
                      Nenhuma linha encontrada para o filtro atual.
                    </td>
                  </tr>
                ) : (
                  recordsPayload?.items.map((record) => (
                    <tr key={record.record_id}>
                      <td>{record.file_name || "-"}</td>
                      <td>
                        {record.city_name || "-"}
                        {record.state ? `/${record.state}` : ""}
                      </td>
                      <td>{record.category || "-"}</td>
                      <td>{record.document || "-"}</td>
                      <td className="whitespace-nowrap">{formatMoney(record.valor_bruto)}</td>
                      <td className="whitespace-nowrap">{record.data || "-"}</td>
                      <td className="max-w-[260px] text-sm leading-6">{record.summary}</td>
                      <td>
                        <div className="flex flex-wrap gap-2">
                          {record.alerts.length > 0 ? (
                            record.alerts.map((alert) => (
                              <Link key={alert.id} href={`/alerts/${alert.id}`} className="app-chip">
                                {alert.link_label || "Precisa de conferência"}
                              </Link>
                            ))
                          ) : (
                            <span className="app-chip">Sem alerta vinculado</span>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          )}
        </div>

        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-[var(--invest-muted)]">
            Página {recordsPayload?.page || 1} de {totalPages}
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              className="invest-button-secondary px-4"
              disabled={(recordsPayload?.page || 1) <= 1}
              onClick={() => setRecordsPage((current) => Math.max(1, current - 1))}
            >
              Anterior
            </button>
            <button
              type="button"
              className="invest-button-secondary px-4"
              disabled={(recordsPayload?.page || 1) >= totalPages}
              onClick={() => setRecordsPage((current) => Math.min(totalPages, current + 1))}
            >
              Próxima
            </button>
          </div>
        </div>
      </section>

      <section className="invest-card p-5 sm:p-6">
        <details>
          <summary className="list-none text-sm font-black text-[var(--invest-heading)]">
            Ver nomes encontrados no arquivo
          </summary>
          <div className="mt-4 flex flex-wrap gap-2">
            {overview.supplier.aliases.length > 0 ? (
              overview.supplier.aliases.map((alias) => (
                <span key={alias} className="app-chip">
                  {alias}
                </span>
              ))
            ) : (
              <span className="app-chip">Nenhum nome alternativo registrado</span>
            )}
          </div>
        </details>
      </section>
    </div>
  );
}
