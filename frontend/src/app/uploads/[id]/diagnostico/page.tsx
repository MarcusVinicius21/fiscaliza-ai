"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { StatusPill } from "@/components/app/status-pill";
import { SkeletonBlock } from "@/components/app/skeleton-block";
import {
  AttentionPointCard,
  DiagnosticCard,
  ExecutiveSummaryPanel,
  FactLinkStatusSummary,
  SupplierRanking,
  SupportRecordsTable,
  formatCurrency,
} from "@/components/product/investigative-product";
import { UploadDiagnostic, fetchUploadDiagnostic } from "@/lib/product-diagnostics";

export default function UploadDiagnosticPage() {
  const params = useParams<{ id: string }>();
  const uploadId = String(params?.id || "");
  const [diagnostic, setDiagnostic] = useState<UploadDiagnostic | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    if (!uploadId) return;
    let cancelled = false;

    async function loadDiagnostic() {
      setLoading(true);
      setErrorMessage("");
      try {
        const payload = await fetchUploadDiagnostic(uploadId);
        if (!cancelled) setDiagnostic(payload);
      } catch (error) {
        if (!cancelled) {
          setErrorMessage(error instanceof Error ? error.message : "Não foi possível carregar o resumo do arquivo.");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadDiagnostic();
    return () => {
      cancelled = true;
    };
  }, [uploadId]);

  if (loading) {
    return (
      <div className="page-shell">
        <section className="invest-card p-6">
          <SkeletonBlock lines={6} />
        </section>
      </div>
    );
  }

  if (errorMessage || !diagnostic) {
    return (
      <div className="page-shell">
        <section className="invest-card p-6">
          <p className="text-sm font-bold text-[var(--invest-danger)]">
            {errorMessage || "Resumo do arquivo não disponível."}
          </p>
        </section>
      </div>
    );
  }

  const upload = diagnostic.upload;
  const cityLabel = upload.city_name ? `${upload.city_name}${upload.state ? `/${upload.state}` : ""}` : "cidade nao informada";
  const statusLabel = upload.analysis_status || upload.status || "nao informado";
  const missingKeys = diagnostic.quality.records_with_any_link_key === 0;
  const qualityItems = [
    { label: "Contrato", present: diagnostic.quality.has_contract_keys },
    { label: "Licitação", present: diagnostic.quality.has_bid_keys },
    { label: "Processo", present: diagnostic.quality.has_process_keys },
    { label: "Objeto", present: diagnostic.quality.has_object_text },
    { label: "Alguma chave", present: diagnostic.quality.records_with_any_link_key > 0 },
  ];

  return (
    <div className="page-shell">
      <section className="page-header px-5 py-5 sm:px-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="max-w-3xl">
            <p className="invest-eyebrow">Resumo do arquivo</p>
            <h1 className="invest-title mt-3 text-2xl sm:text-[2rem]">
              {upload.file_name || "Arquivo sem nome"}
            </h1>
            <p className="invest-subtitle mt-3 text-sm sm:text-base">
              Resumo de qualidade, concentração e ligações encontradas sem alterar dados de origem.
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              <StatusPill tone="info">{upload.category || "categoria não informada"}</StatusPill>
              <span className="app-chip">{upload.report_type || "tipo não informado"}</span>
              <span className="app-chip">
                {upload.city_name ? `${upload.city_name}${upload.state ? `/${upload.state}` : ""}` : "cidade não informada"}
              </span>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link href={`/relatorios/upload/${upload.id}`} className="invest-button px-4">
              Abrir relatório
            </Link>
            <Link href="/uploads" className="invest-button-secondary px-4">
              Voltar
            </Link>
          </div>
        </div>
      </section>

      <ExecutiveSummaryPanel
        title="Leitura executiva do arquivo"
        body="Este resumo organiza volume, valor identificado, concentração por fornecedor e ligações ausentes. Ele serve para priorizar conferência e não substitui conferência documental."
        points={[
          `${diagnostic.summary.records_count} linha(s) lida(s) neste arquivo.`,
          `${formatCurrency(diagnostic.summary.total_amount)} identificado no recorte atual.`,
          missingKeys
            ? "Faltam chaves no arquivo para ligacao automatica."
            : `${diagnostic.quality.records_with_any_link_key} registro(s) trazem alguma chave de ligacao.`,
        ]}
      />

      <DiagnosticCard
        title="Numeros principais"
        items={[
          { label: "Arquivo", value: upload.file_name || "nao informado", hint: `${upload.category || "categoria nao informada"} / ${upload.report_type || "tipo nao informado"}` },
          { label: "Cidade/cliente", value: cityLabel },
          { label: "Linhas", value: diagnostic.summary.records_count },
          { label: "Valor identificado", value: formatCurrency(diagnostic.summary.total_amount) },
          { label: "Alertas", value: diagnostic.summary.alerts_count },
          { label: "Status", value: statusLabel },
        ]}
      />

      <FactLinkStatusSummary
        contracts={diagnostic.link_status.contracts}
        payments={diagnostic.link_status.payments}
        bids={diagnostic.link_status.bids}
      />

      <section className="grid gap-5 xl:grid-cols-2">
        <SupplierRanking title="Principais fornecedores por valor" items={diagnostic.suppliers_by_amount} />
        <SupplierRanking title="Principais fornecedores por quantidade" items={diagnostic.suppliers_by_count} />
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        {diagnostic.attention_points.map((point) => (
          <AttentionPointCard key={point.title} title={point.title} body={point.body} />
        ))}
        <AttentionPointCard
          title="Leitura cautelosa"
          body="Sem ligação automática encontrada não é conclusão sobre o caso. É sinal de que faltam dados no arquivo ou bases complementares para ligação automática."
          tone="info"
        />
      </section>

      <SupportRecordsTable records={diagnostic.support_records} />

      <section className="invest-card p-5 sm:p-6">
        <p className="invest-section-title">Dados que ajudam a ligar informações</p>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          {qualityItems.map((item) => (
            <div key={item.label} className="invest-card-solid p-4">
              <p className="metric-label">{item.label}</p>
              <p className="mt-2 text-sm font-black text-[var(--invest-heading)]">
                {item.present ? "informado no recorte" : "não informado"}
              </p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
