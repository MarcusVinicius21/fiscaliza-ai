"use client";

import { useEffect, useMemo, useState } from "react";
import { StatusPill } from "@/components/app/status-pill";
import { SkeletonBlock } from "@/components/app/skeleton-block";
import { supabase } from "@/lib/supabase";

interface UploadRecord {
  id: string;
  city_id: string;
  file_name: string;
  category: string;
  report_type?: string | null;
  report_label?: string | null;
  status: string;
  analysis_status?: string | null;
  created_at: string;
  cities?: { name: string; state: string } | null;
}

interface AlertRecord {
  id: string;
  upload_id: string;
  city_id?: string | null;
  category?: string | null;
  report_type?: string | null;
  report_label?: string | null;
  title: string;
  explanation?: string | null;
  severity?: string | null;
  amount?: number | string | null;
  supplier_name?: string | null;
  created_at?: string | null;
  cities?: { name: string; state: string } | null;
}

interface AnalysisLog {
  upload_id: string;
  input_summary?: string | Record<string, unknown> | null;
  ai_output?: string | Record<string, unknown> | null;
  created_at?: string | null;
}

type StatusTone = "info" | "danger" | "success" | "muted" | "warning";

function parseJson(value: unknown) {
  if (!value) return {};
  if (typeof value === "object") return value as Record<string, unknown>;

  try {
    return JSON.parse(String(value)) as Record<string, unknown>;
  } catch {
    return {};
  }
}

function asRecordArray(value: unknown): Record<string, unknown>[] {
  if (!Array.isArray(value)) return [];
  return value.filter(
    (item): item is Record<string, unknown> =>
      Boolean(item) && typeof item === "object" && !Array.isArray(item)
  );
}

function textOrEmpty(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function parseAmount(value: unknown) {
  if (value === null || value === undefined || value === "") return 0;
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;

  const normalized = String(value)
    .replace("R$", "")
    .replace(/\s/g, "")
    .replace(/\./g, "")
    .replace(",", ".");

  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
}

function normalizeLabel(value: unknown) {
  const txt = String(value || "").trim();
  return txt || "Não informado";
}

function categoryLabel(value: string | null | undefined) {
  const map: Record<string, string> = {
    payroll: "Pessoal / RH",
    contracts: "Contratos",
    expenses: "Despesas / Pagamentos",
    bids: "Licitações",
    others: "Outros",
  };

  return map[String(value || "")] || normalizeLabel(value);
}

function severityTone(severity?: string | null): StatusTone {
  const sev = String(severity || "").toLowerCase();
  if (sev.includes("alta")) return "danger";
  if (sev.includes("media") || sev.includes("média")) return "warning";
  return "info";
}

function formatMoney(value: number) {
  return value.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

function formatPercent(value: number) {
  return `${value.toLocaleString("pt-BR", {
    maximumFractionDigits: 1,
  })}%`;
}

function formatDate(value?: string | null) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleDateString("pt-BR");
}

function MetricCard({
  label,
  value,
  note,
}: {
  label: string;
  value: string | number;
  note?: string;
}) {
  return (
    <div className="metric-card">
      <p className="metric-label">{label}</p>
      <p className="metric-value mt-3">{value}</p>
      {note && <p className="mt-2 text-xs text-[var(--invest-muted)]">{note}</p>}
    </div>
  );
}

function EmptyRow({ colSpan, children }: { colSpan: number; children: React.ReactNode }) {
  return (
    <tr>
      <td colSpan={colSpan} className="text-[var(--invest-muted)]">
        {children}
      </td>
    </tr>
  );
}

export default function DashboardPage() {
  const [cityCount, setCityCount] = useState(0);
  const [uploads, setUploads] = useState<UploadRecord[]>([]);
  const [alerts, setAlerts] = useState<AlertRecord[]>([]);
  const [logs, setLogs] = useState<AnalysisLog[]>([]);
  const [selectedUploadId, setSelectedUploadId] = useState("");
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    fetchDashboardData();
  }, []);

  async function fetchDashboardData() {
    setLoading(true);
    setErrorMessage("");

    try {
      const [citiesRes, uploadsRes, alertsRes, logsRes] = await Promise.all([
        supabase.from("cities").select("*", { count: "exact", head: true }),
        supabase
          .from("uploads")
          .select("id, city_id, file_name, category, report_type, report_label, status, analysis_status, created_at, cities(name, state)")
          .order("created_at", { ascending: false }),
        supabase
          .from("alerts")
          .select("id, upload_id, city_id, category, report_type, report_label, title, explanation, severity, amount, supplier_name, created_at, cities(name, state)")
          .order("created_at", { ascending: false })
          .limit(200),
        supabase
          .from("ai_analysis_logs")
          .select("upload_id, input_summary, ai_output, created_at")
          .order("created_at", { ascending: false })
          .limit(200),
      ]);

      if (citiesRes.error) throw new Error(citiesRes.error.message);
      if (uploadsRes.error) throw new Error(uploadsRes.error.message);
      if (alertsRes.error) throw new Error(alertsRes.error.message);
      if (logsRes.error) throw new Error(logsRes.error.message);

      const uploadsData = (uploadsRes.data as unknown as UploadRecord[]) || [];
      const analyzedUploads = uploadsData.filter(
        (item) => item.analysis_status === "analyzed"
      );

      setCityCount(citiesRes.count || 0);
      setUploads(uploadsData);
      setAlerts((alertsRes.data as unknown as AlertRecord[]) || []);
      setLogs((logsRes.data as AnalysisLog[]) || []);

      if (analyzedUploads.length > 0) {
        setSelectedUploadId((current) => current || analyzedUploads[0].id);
      }
    } catch (error: unknown) {
      setErrorMessage(
        error instanceof Error ? error.message : "Falha ao carregar o dashboard."
      );
    } finally {
      setLoading(false);
    }
  }

  const uploadsProcessados = useMemo(
    () => uploads.filter((item) => item.status === "processed"),
    [uploads]
  );

  const uploadsAnalisados = useMemo(
    () => uploads.filter((item) => item.analysis_status === "analyzed"),
    [uploads]
  );

  const latestLogByUpload = useMemo(() => {
    const map = new Map<string, AnalysisLog>();
    for (const log of logs) {
      if (!map.has(log.upload_id)) map.set(log.upload_id, log);
    }
    return map;
  }, [logs]);

  const selectedUpload =
    uploadsAnalisados.find((item) => item.id === selectedUploadId) ||
    uploadsAnalisados[0] ||
    null;

  const selectedLog = selectedUpload
    ? latestLogByUpload.get(selectedUpload.id) || null
    : null;

  const selectedAlerts = selectedUpload
    ? alerts.filter((item) => item.upload_id === selectedUpload.id)
    : [];

  const selectedInput = parseJson(selectedLog?.input_summary);
  const selectedAiOutput = parseJson(selectedLog?.ai_output);
  const insightsExecutivos = asRecordArray(
    selectedAiOutput["insights_executivos"]
  );
  const primaryInsight = insightsExecutivos[0] || null;

  const totalRegistros = Number(selectedInput["total_registros"] || 0);
  const valorTotal = parseAmount(selectedInput["valor_total_soma"]);

  const topConcentracao = Array.isArray(selectedInput["top_5_concentracao_volume"])
    ? (selectedInput["top_5_concentracao_volume"] as Record<string, unknown>[])
    : [];

  const maioresRegistros = Array.isArray(
    selectedInput["top_5_maiores_contratos_individuais"]
  )
    ? (selectedInput["top_5_maiores_contratos_individuais"] as Record<string, unknown>[])
    : Array.isArray(selectedInput["top_5_maiores_pagamentos_individuais"])
      ? (selectedInput["top_5_maiores_pagamentos_individuais"] as Record<string, unknown>[])
      : [];

  const repeticaoAnalitica = Array.isArray(
    selectedInput["alerta_potencial_repeticao_contratual"]
  )
    ? selectedInput["alerta_potencial_repeticao_contratual"]
    : Array.isArray(selectedInput["alerta_potencial_duplicidade"])
      ? selectedInput["alerta_potencial_duplicidade"]
      : [];

  const resumoContextual =
    typeof selectedInput["resumo_contextual"] === "object" &&
    selectedInput["resumo_contextual"] !== null
      ? (selectedInput["resumo_contextual"] as Record<string, unknown>)
      : {};

  const repeticoesIgnoradas = Array.isArray(
    resumoContextual["repeticoes_estruturais_ignoradas"]
  )
    ? (resumoContextual["repeticoes_estruturais_ignoradas"] as unknown[])
    : [];

  const porModalidade = Array.isArray(resumoContextual["por_modalidade"])
    ? (resumoContextual["por_modalidade"] as Record<string, unknown>[])
    : [];

  const porTipoAto = Array.isArray(resumoContextual["por_tipo_ato"])
    ? (resumoContextual["por_tipo_ato"] as Record<string, unknown>[])
    : [];

  const resumoInterpretativo =
    typeof selectedAiOutput["resumo_interpretativo"] === "string"
      ? selectedAiOutput["resumo_interpretativo"]
      : "";

  const resumoContextualIa =
    typeof selectedAiOutput["resumo_contextual_ia"] === "string"
      ? selectedAiOutput["resumo_contextual_ia"]
      : "";

  const primaryAlert = selectedAlerts
    .slice()
    .sort((a, b) => parseAmount(b.amount) - parseAmount(a.amount))[0];

  const primaryAlertAmount = parseAmount(primaryAlert?.amount);
  const primaryShare =
    valorTotal > 0 && primaryAlertAmount > 0
      ? (primaryAlertAmount / valorTotal) * 100
      : 0;
  const primaryHeadline =
    textOrEmpty(primaryInsight?.["headline"]) ||
    primaryAlert?.title ||
    "Nenhum alerta encontrado neste upload";
  const primarySubheadline =
    textOrEmpty(primaryInsight?.["subheadline"]) ||
    primaryAlert?.explanation ||
    "Quando houver alertas, o principal sinal aparecerá aqui com valor, fornecedor e motivo.";
  const primaryTranslation =
    textOrEmpty(primaryInsight?.["traducao_pratica"]) ||
    (primaryShare > 0
      ? `${formatPercent(primaryShare)} do valor analisado no upload.`
      : "Peso no total ainda não calculado.");
  const primaryConcern =
    textOrEmpty(primaryInsight?.["por_que_preocupa"]) ||
    "Este ponto merece leitura porque concentra valor, fornecedor ou padrão relevante na análise já salva.";

  if (loading) {
    return (
      <div className="page-shell">
        <section className="page-header p-6">
          <p className="invest-eyebrow">Dashboard</p>
          <h1 className="invest-title mt-3 text-3xl">Carregando dados</h1>
          <div className="mt-6 max-w-xl">
            <SkeletonBlock lines={4} />
          </div>
        </section>
      </div>
    );
  }

  return (
    <div className="page-shell">
      <section className="page-header p-6 md:p-8">
        <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_430px]">
          <div>
            <p className="invest-eyebrow">Painel principal</p>
            <h1 className="invest-title mt-3 max-w-4xl text-3xl md:text-5xl">
              O que exige explicação agora.
            </h1>
            <p className="invest-subtitle mt-4 max-w-3xl text-base">
              Comece pelo maior sinal de atenção do arquivo. O painel usa a
              análise já pronta e mantém vínculo com a origem.
            </p>
          </div>

          <div className="rounded-lg border border-[var(--invest-border)] bg-white p-4 shadow-[var(--invest-shadow-soft)]">
            <label className="invest-label">Arquivo analisado</label>
            <select
              value={selectedUpload?.id || ""}
              onChange={(e) => setSelectedUploadId(e.target.value)}
              className="invest-select"
            >
              {uploadsAnalisados.length === 0 && (
                <option value="">Nenhum upload analisado</option>
              )}

              {uploadsAnalisados.map((upload) => (
                <option key={upload.id} value={upload.id}>
                  {upload.file_name} - {categoryLabel(upload.category)} -{" "}
                  {upload.report_type || "sem tipo"}
                </option>
              ))}
            </select>

            {selectedUpload && (
              <div className="mt-4 rounded-lg border border-[var(--invest-border)] bg-[#fbfcff] p-4 text-sm text-[var(--invest-muted)]">
                <p className="font-bold text-[var(--invest-heading)]">
                  {selectedUpload.file_name}
                </p>
                <p className="mt-2">
                  {categoryLabel(selectedUpload.category)} ·{" "}
                  {selectedUpload.report_type || "sem tipo"} ·{" "}
                  {selectedUpload.cities?.name
                    ? `${selectedUpload.cities.name}/${selectedUpload.cities.state}`
                    : "cidade não informada"}{" "}
                  · {formatDate(selectedUpload.created_at)}
                </p>
              </div>
            )}
          </div>
        </div>
      </section>

      {errorMessage && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {errorMessage}
        </div>
      )}

      <section className="grid grid-cols-1 gap-4 md:grid-cols-4">
        <MetricCard label="Cidades" value={cityCount} />
        <MetricCard label="Uploads processados" value={uploadsProcessados.length} />
        <MetricCard label="Uploads analisados" value={uploadsAnalisados.length} />
        <MetricCard label="Alertas gerados" value={alerts.length} />
      </section>

      {!selectedUpload ? (
        <div className="rounded-lg border border-orange-200 bg-orange-50 p-5 text-sm text-orange-800">
          Ainda não existe upload analisado. Rode a Etapa 5 em pelo menos um
          arquivo para liberar o painel.
        </div>
      ) : (
        <>
          <section className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1.3fr)_minmax(360px,0.7fr)]">
            <article className="insight-card p-6">
              <p className="invest-eyebrow">Principal alerta do arquivo</p>
              <div className="mt-4 grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_220px]">
                <div>
                  <h2 className="max-w-3xl text-2xl font-black leading-tight text-[var(--invest-heading)] md:text-3xl">
                    {primaryHeadline}
                  </h2>
                  <p className="mt-4 max-w-3xl text-sm leading-7 text-[var(--invest-muted)]">
                    {primarySubheadline}
                  </p>
                  <div className="mt-4 rounded-lg border border-orange-200 bg-orange-50 p-4 text-sm leading-6 text-orange-950">
                    <p className="font-black">Por que isso preocupa</p>
                    <p className="mt-1">{primaryConcern}</p>
                  </div>
                  {primaryAlert?.supplier_name && (
                    <p className="mt-4 text-sm font-bold text-[var(--invest-heading)]">
                      Fornecedor envolvido: {primaryAlert.supplier_name}
                    </p>
                  )}
                </div>

                <div className="rounded-lg border border-[var(--invest-border)] bg-white p-4">
                  <p className="metric-label">Quanto isso custa</p>
                  <p className="invest-number mt-3 text-3xl font-black text-[var(--invest-heading)]">
                    {formatMoney(primaryAlertAmount)}
                  </p>
                  <p className="mt-3 text-sm text-[var(--invest-muted)]">
                    {primaryTranslation}
                  </p>
                  {primaryAlert && (
                    <div className="mt-4">
                      <StatusPill tone={severityTone(primaryAlert.severity)}>
                        {primaryAlert.severity || "baixa"}
                      </StatusPill>
                    </div>
                  )}
                </div>
              </div>
            </article>

            <aside className="rounded-lg border border-[var(--invest-border)] bg-white p-6 shadow-[var(--invest-shadow-soft)]">
              <p className="invest-eyebrow">Resumo do problema</p>
              <h2 className="mt-2 text-xl font-black text-[var(--invest-heading)]">
                Leitura curta da IA
              </h2>
              <p className="mt-4 text-sm leading-7 text-[var(--invest-muted)]">
                {resumoContextualIa || resumoInterpretativo || "Resumo indisponível."}
              </p>
            </aside>
          </section>

          <section className="grid grid-cols-1 gap-4 md:grid-cols-4">
            <MetricCard label="Linhas analisadas" value={totalRegistros} />
            <MetricCard label="Valor analisado" value={formatMoney(valorTotal)} />
            <MetricCard label="Alertas deste arquivo" value={selectedAlerts.length} />
            <MetricCard
              label="Linhas repetidas desconsideradas"
              value={repeticoesIgnoradas.length}
            />
          </section>

          <section className="grid grid-cols-1 gap-6 xl:grid-cols-[0.95fr_1.05fr]">
            <div className="rounded-lg border border-[var(--invest-border)] bg-white p-6 shadow-[var(--invest-shadow-soft)]">
              <p className="invest-eyebrow">Resumo técnico</p>
              <h2 className="mt-2 text-xl font-black text-[var(--invest-heading)]">
                O que a análise registrou
              </h2>
              <div className="mt-5 space-y-4 text-sm leading-7 text-[var(--invest-muted)]">
                <p>{resumoInterpretativo || "Resumo interpretativo indisponível."}</p>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                  <div className="rounded-lg border border-[var(--invest-border)] bg-[#fbfcff] p-3">
                    <p className="metric-label">Categoria do arquivo</p>
                    <p className="mt-1 font-black text-[var(--invest-heading)]">
                      {categoryLabel(selectedUpload.category)}
                    </p>
                  </div>
                  <div className="rounded-lg border border-[var(--invest-border)] bg-[#fbfcff] p-3">
                    <p className="metric-label">Padrões que merecem leitura</p>
                    <p className="mt-1 font-black text-[var(--invest-heading)]">
                      {Array.isArray(repeticaoAnalitica)
                        ? repeticaoAnalitica.length
                        : 0}
                    </p>
                  </div>
                  <div className="rounded-lg border border-[var(--invest-border)] bg-[#fbfcff] p-3">
                    <p className="metric-label">Linhas desconsideradas</p>
                    <p className="mt-1 font-black text-[var(--invest-heading)]">
                      {repeticoesIgnoradas.length}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <div className="rounded-lg border border-[var(--invest-border)] bg-white p-6 shadow-[var(--invest-shadow-soft)]">
              <p className="invest-eyebrow">Concentração</p>
              <h2 className="mt-2 text-xl font-black text-[var(--invest-heading)]">
                Quem concentra mais valor
              </h2>
              <div className="mt-5 space-y-3">
                {topConcentracao.slice(0, 5).map((item, index) => {
                  const value = parseAmount(item["valor_bruto"] ?? item["valor_total"]);
                  const share = valorTotal > 0 ? (value / valorTotal) * 100 : 0;
                  return (
                    <div key={`${normalizeLabel(item["nome_credor_servidor"])}-${index}`}>
                      <div className="flex items-center justify-between gap-3 text-sm">
                        <p className="font-bold text-[var(--invest-heading)]">
                          {normalizeLabel(item["nome_credor_servidor"])}
                        </p>
                        <p className="invest-number font-black text-[var(--invest-heading)]">
                          {formatMoney(value)}
                        </p>
                      </div>
                      <div className="mt-2 h-2 overflow-hidden rounded-full bg-[#eef2f8]">
                        <div
                          className="h-full rounded-full bg-[var(--invest-primary)]"
                          style={{ width: `${Math.min(100, Math.max(2, share))}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
                {topConcentracao.length === 0 && (
                  <p className="text-sm text-[var(--invest-muted)]">
                    Nenhum ranking disponível.
                  </p>
                )}
              </div>
            </div>
          </section>

          <section className="grid grid-cols-1 gap-6 xl:grid-cols-2">
            <div className="overflow-hidden rounded-lg border border-[var(--invest-border)] bg-white shadow-[var(--invest-shadow-soft)]">
              <div className="border-b border-[var(--invest-border)] p-5">
                <p className="invest-eyebrow">Maiores valores</p>
                <h2 className="mt-2 text-lg font-black text-[var(--invest-heading)]">
                  Itens que merecem leitura
                </h2>
              </div>
              <div className="invest-soft-scroll overflow-x-auto">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Nome</th>
                      <th>Documento</th>
                      <th className="text-right">Valor</th>
                    </tr>
                  </thead>
                  <tbody>
                    {maioresRegistros.map((item, index) => (
                      <tr key={`${normalizeLabel(item["nome_credor_servidor"])}-${index}`}>
                        <td>{normalizeLabel(item["nome_credor_servidor"])}</td>
                        <td>{normalizeLabel(item["documento"])}</td>
                        <td className="text-right invest-number font-bold">
                          {formatMoney(parseAmount(item["valor_bruto"]))}
                        </td>
                      </tr>
                    ))}
                    {maioresRegistros.length === 0 && (
                      <EmptyRow colSpan={3}>Nenhum registro disponível.</EmptyRow>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="overflow-hidden rounded-lg border border-[var(--invest-border)] bg-white shadow-[var(--invest-shadow-soft)]">
              <div className="border-b border-[var(--invest-border)] p-5">
                <p className="invest-eyebrow">Modalidade</p>
                <h2 className="mt-2 text-lg font-black text-[var(--invest-heading)]">
                  Como o valor se distribui
                </h2>
              </div>
              <div className="invest-soft-scroll overflow-x-auto">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Modalidade</th>
                      <th className="text-right">Valor</th>
                      <th className="text-right">Qtd.</th>
                    </tr>
                  </thead>
                  <tbody>
                    {porModalidade.map((item, index) => (
                      <tr key={`${normalizeLabel(item["modalidade"])}-${index}`}>
                        <td>{normalizeLabel(item["modalidade"])}</td>
                        <td className="text-right invest-number font-bold">
                          {formatMoney(parseAmount(item["valor_total"]))}
                        </td>
                        <td className="text-right invest-number">
                          {Number(item["qtd_registros"] || 0)}
                        </td>
                      </tr>
                    ))}
                    {porModalidade.length === 0 && (
                      <EmptyRow colSpan={3}>Nenhuma modalidade disponível.</EmptyRow>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </section>

          <section className="grid grid-cols-1 gap-6 xl:grid-cols-2">
            <div className="overflow-hidden rounded-lg border border-[var(--invest-border)] bg-white shadow-[var(--invest-shadow-soft)]">
              <div className="border-b border-[var(--invest-border)] p-5">
                <p className="invest-eyebrow">Tipo do documento</p>
                <h2 className="mt-2 text-lg font-black text-[var(--invest-heading)]">
                  Agrupamento por ato
                </h2>
              </div>
              <div className="invest-soft-scroll overflow-x-auto">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Tipo</th>
                      <th className="text-right">Valor</th>
                      <th className="text-right">Qtd.</th>
                    </tr>
                  </thead>
                  <tbody>
                    {porTipoAto.map((item, index) => (
                      <tr key={`${normalizeLabel(item["tipo_ato"])}-${index}`}>
                        <td>{normalizeLabel(item["tipo_ato"])}</td>
                        <td className="text-right invest-number font-bold">
                          {formatMoney(parseAmount(item["valor_total"]))}
                        </td>
                        <td className="text-right invest-number">
                          {Number(item["qtd_registros"] || 0)}
                        </td>
                      </tr>
                    ))}
                    {porTipoAto.length === 0 && (
                      <EmptyRow colSpan={3}>Nenhum tipo disponível.</EmptyRow>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="overflow-hidden rounded-lg border border-[var(--invest-border)] bg-white shadow-[var(--invest-shadow-soft)]">
              <div className="border-b border-[var(--invest-border)] p-5">
                <p className="invest-eyebrow">Alertas</p>
                <h2 className="mt-2 text-lg font-black text-[var(--invest-heading)]">
                  Sinais deste arquivo
                </h2>
              </div>
              <div className="divide-y divide-[var(--invest-border)]">
                {selectedAlerts.map((alert) => (
                  <article key={alert.id} className="p-5">
                    <div className="mb-3 flex flex-wrap items-center gap-2">
                      <StatusPill tone={severityTone(alert.severity)}>
                        {alert.severity || "baixa"}
                      </StatusPill>
                      <span className="app-chip">{formatDate(alert.created_at)}</span>
                    </div>
                    <h3 className="text-base font-black text-[var(--invest-heading)]">
                      {alert.title}
                    </h3>
                    <p className="mt-2 text-sm leading-6 text-[var(--invest-muted)]">
                      {alert.explanation || "Sem explicação registrada."}
                    </p>
                    {alert.supplier_name && (
                      <p className="mt-2 text-xs font-bold text-[var(--invest-muted)]">
                        Fornecedor: {alert.supplier_name}
                      </p>
                    )}
                  </article>
                ))}
                {selectedAlerts.length === 0 && (
                  <p className="p-5 text-sm text-[var(--invest-muted)]">
                    Nenhum alerta encontrado para este upload.
                  </p>
                )}
              </div>
            </div>
          </section>
        </>
      )}
    </div>
  );
}
