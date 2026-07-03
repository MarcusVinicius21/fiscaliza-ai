"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { SkeletonBlock } from "@/components/app/skeleton-block";
import {
  AttentionPointCard,
  DiagnosticCard,
  FactLinkStatusSummary,
  PrintReportLayout,
  SupplierRanking,
  formatCurrency,
} from "@/components/product/investigative-product";
import { UploadDiagnostic, fetchUploadDiagnostic } from "@/lib/product-diagnostics";

export default function UploadReportPage() {
  const params = useParams<{ id: string }>();
  const uploadId = String(params?.id || "");
  const [diagnostic, setDiagnostic] = useState<UploadDiagnostic | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    if (!uploadId) return;
    let cancelled = false;

    async function loadReport() {
      setLoading(true);
      setErrorMessage("");
      try {
        const payload = await fetchUploadDiagnostic(uploadId);
        if (!cancelled) setDiagnostic(payload);
      } catch (error) {
        if (!cancelled) {
          setErrorMessage(error instanceof Error ? error.message : "Não foi possível carregar o dossiê.");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadReport();
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
            {errorMessage || "Dossiê não disponível."}
          </p>
        </section>
      </div>
    );
  }

  const upload = diagnostic.upload;

  return (
    <PrintReportLayout
      title={upload.file_name || "Upload sem nome"}
      subtitle="Relatório visual básico para impressão, com resumo executivo e pontos de atenção."
    >
      <DiagnosticCard
        title="Números principais"
        items={[
          { label: "Registros", value: diagnostic.summary.records_count },
          { label: "Valor identificado", value: formatCurrency(diagnostic.summary.total_amount) },
          { label: "Alertas", value: diagnostic.summary.alerts_count },
          { label: "Arquivo", value: upload.category || "não informado", hint: upload.report_type || undefined },
        ]}
      />

      <FactLinkStatusSummary
        contracts={diagnostic.link_status.contracts}
        payments={diagnostic.link_status.payments}
        bids={diagnostic.link_status.bids}
      />

      <section className="grid gap-5 xl:grid-cols-2">
        <SupplierRanking title="Concentração por valor" items={diagnostic.suppliers_by_amount.slice(0, 5)} />
        <SupplierRanking title="Concentração por quantidade" items={diagnostic.suppliers_by_count.slice(0, 5)} />
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        {diagnostic.attention_points.map((point) => (
          <AttentionPointCard key={point.title} title={point.title} body={point.body} />
        ))}
        <AttentionPointCard
          title="Observação cautelosa"
          body="Este dossiê organiza sinais e lacunas do acervo. Qualquer conclusão depende de conferência humana e documentos complementares."
          tone="info"
        />
      </section>

      <section className="invest-card p-5 sm:p-6 print:hidden">
        <Link href={`/uploads/${upload.id}/diagnostico`} className="invest-button-secondary px-4">
          Voltar ao diagnóstico
        </Link>
      </section>
    </PrintReportLayout>
  );
}
