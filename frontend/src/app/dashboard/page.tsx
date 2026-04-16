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

function parseJson(value: unknown) {
  if (!value) return {};
  if (typeof value === "object") return value as Record<string, unknown>;

  try {
    return JSON.parse(String(value)) as Record<string, unknown>;
  } catch {
    return {};
  }
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

function severityTone(severity?: string | null) {
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

function formatDate(value?: string | null) {
  if (!value) return "—";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";

  return date.toLocaleDateString("pt-BR");
}

function MetricCard({
  label,
  value,
  note,
  tone = "info",
}: {
  label: string;
  value: string | number;
  note?: string;
  tone?: "info" | "danger" | "success" | "warning";
}) {
  const accent = {
    info: "from-[rgba(78,168,222,0.18)]",
    danger: "from-[rgba(230,57,70,0.18)]",
    success: "from-[rgba(45,212,191,0.18)]",
    warning: "from-[rgba(245,184,75,0.18)]",
  };

  return (
    <div className={`invest-kpi bg-gradient-to-b ${accent[tone]} to-transparent`}>
      <p className="text-xs font-extrabold uppercase tracking-[0.1em] text-[var(--invest-faint)]">
        {label}
      </p>
      <p className="invest-number mt-3 text-3xl font-black text-white">
        {value}
      </p>
      {note && <p className="mt-2 text-xs text-[var(--invest-muted)]">{note}</p>}
    </div>
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
      if (!map.has(log.upload_id)) {
        map.set(log.upload_id, log);
      }
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

  const totalRegistros = Number(selectedInput?.total_registros || 0);
  const valorTotal = parseAmount(selectedInput?.valor_total_soma);

  const topConcentracao = Array.isArray(selectedInput?.top_5_concentracao_volume)
    ? (selectedInput.top_5_concentracao_volume as Record<string, unknown>[])
    : [];

  const maioresRegistros = Array.isArray(
    selectedInput?.top_5_maiores_contratos_individuais
  )
    ? (selectedInput.top_5_maiores_contratos_individuais as Record<string, unknown>[])
    : Array.isArray(selectedInput?.top_5_maiores_pagamentos_individuais)
    ? (selectedInput.top_5_maiores_pagamentos_individuais as Record<string, unknown>[])
    : [];

  const repeticaoAnalitica = Array.isArray(
    selectedInput?.alerta_potencial_repeticao_contratual
  )
    ? selectedInput.alerta_potencial_repeticao_contratual
    : Array.isArray(selectedInput?.alerta_potencial_duplicidade)
    ? selectedInput.alerta_potencial_duplicidade
    : [];

  const resumoContextual =
    typeof selectedInput?.resumo_contextual === "object" &&
    selectedInput.resumo_contextual !== null
      ? (selectedInput.resumo_contextual as Record<string, unknown>)
      : {};
  const repeticoesIgnoradas = Array.isArray(
    resumoContextual?.repeticoes_estruturais_ignoradas
  )
    ? resumoContextual.repeticoes_estruturais_ignoradas
    : [];

  const porModalidade = Array.isArray(resumoContextual?.por_modalidade)
    ? (resumoContextual.por_modalidade as Record<string, unknown>[])
    : [];

  const porTipoAto = Array.isArray(resumoContextual?.por_tipo_ato)
    ? (resumoContextual.por_tipo_ato as Record<string, unknown>[])
    : [];

  const resumoInterpretativo =
    typeof selectedAiOutput?.resumo_interpretativo === "string"
      ? selectedAiOutput.resumo_interpretativo
      : "";

  const resumoContextualIa =
    typeof selectedAiOutput?.resumo_contextual_ia === "string"
      ? selectedAiOutput.resumo_contextual_ia
      : "";

  if (loading) {
    return (
      <div className="invest-page">
        <section className="invest-page-hero p-6">
          <p className="invest-eyebrow">Painel executivo</p>
          <h1 className="invest-title mt-3 text-3xl">Carregando operação</h1>
          <div className="mt-6 max-w-xl">
            <SkeletonBlock lines={4} />
          </div>
        </section>
      </div>
    );
  }

  return (
    <div className="invest-page">
      <section className="invest-page-hero p-6 md:p-8">
        <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_460px]">
          <div>
            <p className="invest-eyebrow">Painel executivo</p>
            <h1 className="invest-title mt-3 max-w-4xl text-3xl md:text-5xl">
              Leitura executiva dos achados já produzidos.
            </h1>
            <p className="invest-subtitle mt-4 max-w-3xl text-base">
              O dashboard consome a Etapa 5 sem refazer análise. A tela organiza
              alertas, resumos e contexto técnico para investigação responsável.
            </p>
          </div>

          <div className="invest-card p-5">
            <p className="invest-eyebrow">Upload em foco</p>
            <label className="invest-label mt-4">Base analisada</label>
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
                  {upload.file_name} — {categoryLabel(upload.category)} —{" "}
                  {upload.report_type || "sem subtipo"}
                </option>
              ))}
            </select>

            {selectedUpload && (
              <div className="mt-4 rounded-lg border border-[var(--invest-border)] bg-[rgba(3,7,18,0.32)] p-4 text-sm text-[var(--invest-muted)]">
                <p className="font-bold text-white">{selectedUpload.file_name}</p>
                <p className="mt-2">
                  {categoryLabel(selectedUpload.category)} •{" "}
                  {selectedUpload.report_type || "sem subtipo"} •{" "}
                  {selectedUpload.cities?.name
                    ? `${selectedUpload.cities.name}/${selectedUpload.cities.state}`
                    : "cidade não informada"}{" "}
                  • {formatDate(selectedUpload.created_at)}
                </p>
              </div>
            )}
          </div>
        </div>
      </section>

      {errorMessage && (
        <div className="rounded-lg border border-[rgba(230,57,70,0.4)] bg-[rgba(230,57,70,0.1)] p-4 text-sm text-[#ffb4ba]">
          {errorMessage}
        </div>
      )}

      <section className="grid grid-cols-1 gap-4 md:grid-cols-4">
        <MetricCard label="Cidades monitoradas" value={cityCount} />
        <MetricCard label="Uploads processados" value={uploadsProcessados.length} tone="success" />
        <MetricCard label="Uploads analisados" value={uploadsAnalisados.length} tone="info" />
        <MetricCard label="Alertas gerados" value={alerts.length} tone="warning" />
      </section>

      {!selectedUpload ? (
        <div className="invest-card-highlight p-5 text-sm text-[var(--invest-muted)]">
          Ainda não existe upload com <code>analysis_status = analyzed</code>.
          Primeiro rode a Etapa 5 em pelo menos um arquivo.
        </div>
      ) : (
        <>
          <section className="grid grid-cols-1 gap-4 md:grid-cols-4">
            <MetricCard label="Registros analisados" value={totalRegistros} />
            <MetricCard label="Valor analisado" value={formatMoney(valorTotal)} note="Base deduplicada quando aplicável" />
            <MetricCard label="Alertas do upload" value={selectedAlerts.length} tone="warning" />
            <MetricCard label="Repetições ignoradas" value={repeticoesIgnoradas.length} tone="success" />
          </section>

          <section className="grid grid-cols-1 gap-6 xl:grid-cols-[1.15fr_0.85fr]">
            <article className="invest-card p-6">
              <p className="invest-eyebrow">Síntese da IA</p>
              <h2 className="mt-2 text-2xl font-black text-white">
                Resumo interpretativo e contextual
              </h2>
              <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
                <div className="invest-evidence rounded-lg p-4">
                  <p className="text-xs font-black uppercase tracking-[0.12em] text-[var(--invest-cyan)]">
                    Resumo interpretativo
                  </p>
                  <p className="mt-3 text-sm leading-7 text-[#dbe6f3]">
                    {resumoInterpretativo ||
                      "Nenhum resumo interpretativo disponível."}
                  </p>
                </div>

                <div className="rounded-lg border border-[var(--invest-border)] bg-[rgba(3,7,18,0.32)] p-4">
                  <p className="text-xs font-black uppercase tracking-[0.12em] text-[var(--invest-faint)]">
                    Resumo contextual da IA
                  </p>
                  <p className="mt-3 text-sm leading-7 text-[#dbe6f3]">
                    {resumoContextualIa ||
                      "Nenhum resumo contextual disponível."}
                  </p>
                </div>
              </div>
            </article>

            <aside className="invest-card p-6">
              <p className="invest-eyebrow">Contexto técnico</p>
              <h2 className="mt-2 text-xl font-black text-white">
                Leitura operacional
              </h2>
              <div className="mt-5 space-y-4">
                <div className="flex items-center justify-between border-b border-[var(--invest-border)] pb-3">
                  <span className="text-sm text-[var(--invest-muted)]">
                    Tipo de contexto
                  </span>
                  <span className="font-bold text-white">
                    {normalizeLabel(resumoContextual?.tipo_contexto)}
                  </span>
                </div>
                <div className="flex items-center justify-between border-b border-[var(--invest-border)] pb-3">
                  <span className="text-sm text-[var(--invest-muted)]">
                    Repetições relevantes
                  </span>
                  <span className="invest-number font-black text-white">
                    {Array.isArray(repeticaoAnalitica)
                      ? repeticaoAnalitica.length
                      : 0}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-[var(--invest-muted)]">
                    Estruturais ignoradas
                  </span>
                  <span className="invest-number font-black text-white">
                    {repeticoesIgnoradas.length}
                  </span>
                </div>
              </div>
            </aside>
          </section>

          <section className="grid grid-cols-1 gap-6 xl:grid-cols-2">
            <div className="invest-card overflow-hidden">
              <div className="border-b border-[var(--invest-border)] p-5">
                <p className="invest-eyebrow">Ranking</p>
                <h2 className="mt-2 text-lg font-black text-white">
                  Top concentração por fornecedor
                </h2>
              </div>
              <div className="invest-soft-scroll overflow-x-auto">
                <table className="invest-table">
                  <thead>
                    <tr>
                      <th>Fornecedor</th>
                      <th className="text-right">Valor</th>
                    </tr>
                  </thead>
                  <tbody>
                    {topConcentracao.map((item, index) => (
                      <tr key={`${normalizeLabel(item["nome_credor_servidor"])}-${index}`}>
                        <td>{normalizeLabel(item["nome_credor_servidor"])}</td>
                        <td className="text-right invest-number">
                          {formatMoney(
                            parseAmount(item["valor_bruto"] ?? item["valor_total"])
                          )}
                        </td>
                      </tr>
                    ))}

                    {topConcentracao.length === 0 && (
                      <tr>
                        <td colSpan={2}>Nenhum ranking disponível.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="invest-card overflow-hidden">
              <div className="border-b border-[var(--invest-border)] p-5">
                <p className="invest-eyebrow">Maiores itens</p>
                <h2 className="mt-2 text-lg font-black text-white">
                  Maiores registros do upload
                </h2>
              </div>
              <div className="invest-soft-scroll overflow-x-auto">
                <table className="invest-table">
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
                        <td className="text-right invest-number">
                          {formatMoney(parseAmount(item["valor_bruto"]))}
                        </td>
                      </tr>
                    ))}

                    {maioresRegistros.length === 0 && (
                      <tr>
                        <td colSpan={3}>Nenhum registro disponível.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </section>

          <section className="grid grid-cols-1 gap-6 xl:grid-cols-2">
            <div className="invest-card overflow-hidden">
              <div className="border-b border-[var(--invest-border)] p-5">
                <p className="invest-eyebrow">Contratos</p>
                <h2 className="mt-2 text-lg font-black text-white">
                  Resumo por modalidade
                </h2>
              </div>
              <div className="invest-soft-scroll overflow-x-auto">
                <table className="invest-table">
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
                        <td className="text-right invest-number">
                          {formatMoney(parseAmount(item["valor_total"]))}
                        </td>
                        <td className="text-right invest-number">
                          {Number(item["qtd_registros"] || 0)}
                        </td>
                      </tr>
                    ))}

                    {porModalidade.length === 0 && (
                      <tr>
                        <td colSpan={3}>Nenhuma modalidade disponível.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="invest-card overflow-hidden">
              <div className="border-b border-[var(--invest-border)] p-5">
                <p className="invest-eyebrow">Atos</p>
                <h2 className="mt-2 text-lg font-black text-white">
                  Resumo por tipo de ato
                </h2>
              </div>
              <div className="invest-soft-scroll overflow-x-auto">
                <table className="invest-table">
                  <thead>
                    <tr>
                      <th>Tipo de ato</th>
                      <th className="text-right">Valor</th>
                      <th className="text-right">Qtd.</th>
                    </tr>
                  </thead>
                  <tbody>
                    {porTipoAto.map((item, index) => (
                      <tr key={`${normalizeLabel(item["tipo_ato"])}-${index}`}>
                        <td>{normalizeLabel(item["tipo_ato"])}</td>
                        <td className="text-right invest-number">
                          {formatMoney(parseAmount(item["valor_total"]))}
                        </td>
                        <td className="text-right invest-number">
                          {Number(item["qtd_registros"] || 0)}
                        </td>
                      </tr>
                    ))}

                    {porTipoAto.length === 0 && (
                      <tr>
                        <td colSpan={3}>Nenhum tipo de ato disponível.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </section>

          <section className="invest-card overflow-hidden">
            <div className="border-b border-[var(--invest-border)] p-5">
              <p className="invest-eyebrow">Fila do upload</p>
              <h2 className="mt-2 text-lg font-black text-white">
                Alertas do upload selecionado
              </h2>
            </div>

            <div className="divide-y divide-[rgba(148,163,184,0.13)]">
              {selectedAlerts.map((alert) => (
                <article key={alert.id} className="grid gap-4 p-5 lg:grid-cols-[200px_minmax(0,1fr)_160px]">
                  <div className="flex flex-wrap items-start gap-2">
                    <StatusPill tone={severityTone(alert.severity)}>
                      {alert.severity || "baixa"}
                    </StatusPill>
                    <span className="invest-chip">{categoryLabel(alert.category)}</span>
                  </div>

                  <div>
                    <h3 className="text-base font-black text-white">{alert.title}</h3>
                    <p className="mt-2 text-sm leading-6 text-[var(--invest-muted)]">
                      {alert.explanation || "Sem explicação registrada."}
                    </p>
                    {alert.supplier_name && (
                      <p className="mt-2 text-xs text-[var(--invest-faint)]">
                        Fornecedor: {alert.supplier_name}
                      </p>
                    )}
                  </div>

                  <div className="text-left text-sm text-[var(--invest-muted)] lg:text-right">
                    <p>{formatDate(alert.created_at)}</p>
                    {alert.amount !== null && alert.amount !== undefined && (
                      <p className="invest-number mt-2 font-black text-white">
                        {formatMoney(parseAmount(alert.amount))}
                      </p>
                    )}
                  </div>
                </article>
              ))}

              {selectedAlerts.length === 0 && (
                <p className="p-5 text-sm text-[var(--invest-muted)]">
                  Nenhum alerta encontrado para este upload.
                </p>
              )}
            </div>
          </section>
        </>
      )}
    </div>
  );
}
