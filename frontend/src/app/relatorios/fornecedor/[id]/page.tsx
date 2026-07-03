"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { SkeletonBlock } from "@/components/app/skeleton-block";
import {
  AttentionPointCard,
  DiagnosticCard,
  ExecutiveSummaryPanel,
  PrintReportLayout,
  SupportRecordsTable,
  formatCurrency,
} from "@/components/product/investigative-product";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8000";

interface SupplierOverview {
  supplier: {
    id: string;
    canonical_name: string;
    document?: string | null;
    aliases?: string[];
  };
  summary: {
    uploads_count: number;
    records_count: number;
    alerts_count: number;
    total_amount: number;
    relative_rank?: number | null;
  };
  categories: Array<{ category: string; records_count: number; total_amount: number }>;
  uploads: Array<{ upload_id: string; file_name?: string | null; records_count: number; total_amount: number }>;
  related_alerts: Array<{ id: string; title: string; explanation?: string | null; severity?: string | null; amount?: number | null }>;
}

interface SupplierRecords {
  total: number;
  items: Array<{
    record_id: string;
    file_name?: string | null;
    category?: string | null;
    valor_bruto: number;
    data?: string | null;
    summary: string;
  }>;
}

function formatDocument(value?: string | null) {
  return value || "documento não informado";
}

export default function SupplierReportPage() {
  const params = useParams<{ id: string }>();
  const supplierId = String(params?.id || "");
  const [overview, setOverview] = useState<SupplierOverview | null>(null);
  const [records, setRecords] = useState<SupplierRecords | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    if (!supplierId) return;
    let cancelled = false;

    async function loadReport() {
      setLoading(true);
      setErrorMessage("");
      try {
        const [overviewRes, recordsRes] = await Promise.all([
          fetch(`${API_BASE}/suppliers/${supplierId}`),
          fetch(`${API_BASE}/suppliers/${supplierId}/records?page=1&page_size=12`),
        ]);
        const overviewPayload = (await overviewRes.json().catch(() => null)) as SupplierOverview | null;
        const recordsPayload = (await recordsRes.json().catch(() => null)) as SupplierRecords | null;

        if (!overviewRes.ok) throw new Error("Não foi possível carregar o fornecedor.");
        if (!recordsRes.ok) throw new Error("Não foi possível carregar os registros do fornecedor.");

        if (!cancelled) {
          setOverview(overviewPayload);
          setRecords(recordsPayload);
        }
      } catch (error) {
        if (!cancelled) {
          setErrorMessage(error instanceof Error ? error.message : "Não foi possível carregar o relatório.");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadReport();
    return () => {
      cancelled = true;
    };
  }, [supplierId]);

  if (loading) {
    return (
      <div className="page-shell">
        <section className="invest-card p-6">
          <SkeletonBlock lines={6} />
        </section>
      </div>
    );
  }

  if (errorMessage || !overview) {
    return (
      <div className="page-shell">
        <section className="invest-card p-6">
          <p className="text-sm font-bold text-[var(--invest-danger)]">
            {errorMessage || "Relatório não disponível."}
          </p>
        </section>
      </div>
    );
  }

  const supportRecords = (records?.items || []).map((record) => ({
    id: record.record_id,
    file_name: record.file_name,
    category: record.category,
    date: record.data,
    amount: record.valor_bruto,
    supplier: overview.supplier.canonical_name,
    summary: record.summary,
  }));
  const topCategory = overview.categories[0];
  const limitationText = overview.categories.some((category) => category.category === "contracts")
    ? "Há registro contratual relacionado. Quando não houver pagamento ligado automaticamente, leia como falta de informação no arquivo ou base complementar não carregada."
    : "A leitura consolida as linhas disponíveis sem afirmar ligação automática quando ela não existir.";

  return (
    <PrintReportLayout
      title={overview.supplier.canonical_name}
      subtitle={`Relatório básico do fornecedor. ${formatDocument(overview.supplier.document)}.`}
    >
      <ExecutiveSummaryPanel
        title="Resumo do fornecedor"
        body="Este relatório organiza presença em arquivos, valores, alertas e linhas de apoio. A leitura aponta concentração e pontos de atenção, sem substituir conferência documental."
        points={[
          `${formatCurrency(overview.summary.total_amount)} em valor total encontrado.`,
          `${overview.summary.records_count} linha(s) em ${overview.summary.uploads_count} arquivo(s).`,
          topCategory ? `Maior categoria: ${topCategory.category || "nao informado"}.` : "Categoria principal nao informada.",
        ]}
      />

      <DiagnosticCard
        title="Resumo executivo"
        items={[
          { label: "Valor total encontrado", value: formatCurrency(overview.summary.total_amount) },
          { label: "Linhas", value: overview.summary.records_count },
          { label: "Arquivos", value: overview.summary.uploads_count },
          { label: "Alertas", value: overview.summary.alerts_count },
        ]}
      />

      <section className="grid gap-5 xl:grid-cols-2">
        <article className="invest-card p-5 sm:p-6">
          <p className="invest-section-title">Distribuição por categoria</p>
          <div className="mt-4 space-y-3">
            {overview.categories.map((category) => (
              <div key={category.category} className="invest-card-solid p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-black text-[var(--invest-heading)]">
                      {category.category || "não informado"}
                    </p>
                    <p className="mt-1 text-xs text-[var(--invest-muted)]">
                      {category.records_count} registro(s)
                    </p>
                  </div>
                  <p className="text-sm font-black text-[var(--invest-heading)]">
                    {formatCurrency(category.total_amount)}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </article>

        <article className="invest-card p-5 sm:p-6">
          <p className="invest-section-title">Arquivos em que aparece</p>
          <div className="mt-4 space-y-3">
            {overview.uploads.slice(0, 8).map((upload) => (
              <div key={upload.upload_id} className="invest-card-solid p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-black text-[var(--invest-heading)]">
                      {upload.file_name || "arquivo não informado"}
                    </p>
                    <p className="mt-1 text-xs text-[var(--invest-muted)]">
                      {upload.records_count} linha(s)
                    </p>
                  </div>
                  <p className="text-sm font-black text-[var(--invest-heading)]">
                    {formatCurrency(upload.total_amount)}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </article>
      </section>

      <SupportRecordsTable records={supportRecords} />

      <section className="grid gap-4 lg:grid-cols-2">
        <AttentionPointCard
          title="O que chama atenção"
          body={`Valor total encontrado e presença em ${overview.summary.uploads_count} arquivo(s) ajudam a priorizar a conferência deste fornecedor.`}
        />
        <AttentionPointCard
          title="Limitações da leitura"
          body={limitationText}
          tone="info"
        />
        <AttentionPointCard
          title="Ligações ausentes"
          body="Quando não houver ligação automática, leia como falta de informação no arquivo ou base complementar não carregada."
          tone="info"
        />
      </section>

      <section className="invest-card p-5 sm:p-6 print:hidden">
        <Link href={`/fornecedores/${overview.supplier.id}`} className="invest-button-secondary px-4">
          Voltar ao fornecedor
        </Link>
      </section>
    </PrintReportLayout>
  );
}
