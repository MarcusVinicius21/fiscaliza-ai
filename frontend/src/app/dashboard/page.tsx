"use client";

import { useEffect, useMemo, useState } from "react";
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

function severityClass(severity?: string | null) {
  const sev = String(severity || "").toLowerCase();

  if (sev.includes("alta")) return "bg-red-50 text-red-700 border-red-200";
  if (sev.includes("media") || sev.includes("média")) {
    return "bg-yellow-50 text-yellow-700 border-yellow-200";
  }

  return "bg-blue-50 text-blue-700 border-blue-200";
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
      setAlerts((alertsRes.data as AlertRecord[]) || []);
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

  const globalCards = {
    totalCidades: cityCount,
    uploadsProcessados: uploadsProcessados.length,
    uploadsAnalisados: uploadsAnalisados.length,
    totalAlertas: alerts.length,
  };

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
      <div className="p-6">
        <p className="text-sm text-gray-600">Carregando dashboard...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-sm text-gray-600">
          Painel enxuto consumindo os resultados já produzidos pela Etapa 5.
        </p>
      </header>

      {errorMessage && (
        <div className="border border-red-200 bg-red-50 p-4 rounded text-sm text-red-700">
          {errorMessage}
        </div>
      )}

      <section className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="border rounded p-4 bg-white">
          <p className="text-xs text-gray-500">Cidades monitoradas</p>
          <p className="text-lg font-bold text-gray-900">
            {globalCards.totalCidades}
          </p>
        </div>

        <div className="border rounded p-4 bg-white">
          <p className="text-xs text-gray-500">Uploads processados</p>
          <p className="text-lg font-bold text-gray-900">
            {globalCards.uploadsProcessados}
          </p>
        </div>

        <div className="border rounded p-4 bg-white">
          <p className="text-xs text-gray-500">Uploads analisados</p>
          <p className="text-lg font-bold text-gray-900">
            {globalCards.uploadsAnalisados}
          </p>
        </div>

        <div className="border rounded p-4 bg-white">
          <p className="text-xs text-gray-500">Alertas gerados</p>
          <p className="text-lg font-bold text-gray-900">
            {globalCards.totalAlertas}
          </p>
        </div>
      </section>

      <section className="bg-white border rounded p-4 space-y-3">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Upload analisado
          </label>
          <select
            value={selectedUpload?.id || ""}
            onChange={(e) => setSelectedUploadId(e.target.value)}
            className="w-full md:w-[520px] border rounded px-3 py-2 text-sm"
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
        </div>

        {selectedUpload && (
          <div className="text-sm text-gray-600">
            <span className="font-medium text-gray-800">
              {selectedUpload.file_name}
            </span>{" "}
            • {categoryLabel(selectedUpload.category)} •{" "}
            {selectedUpload.report_type || "sem subtipo"} •{" "}
            {selectedUpload.cities?.name
              ? `${selectedUpload.cities.name}/${selectedUpload.cities.state}`
              : "cidade não informada"}{" "}
            • {formatDate(selectedUpload.created_at)}
          </div>
        )}
      </section>

      {!selectedUpload ? (
        <div className="border rounded p-4 bg-yellow-50 text-sm text-yellow-800">
          Ainda não existe upload com <code>analysis_status = analyzed</code>.
          Primeiro rode a Etapa 5 em pelo menos um arquivo.
        </div>
      ) : (
        <>
          <section className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="border rounded p-4 bg-white">
              <p className="text-xs text-gray-500">Registros analisados</p>
              <p className="text-lg font-bold text-gray-900">{totalRegistros}</p>
            </div>

            <div className="border rounded p-4 bg-white">
              <p className="text-xs text-gray-500">Valor analisado</p>
              <p className="text-lg font-bold text-gray-900">
                {formatMoney(valorTotal)}
              </p>
            </div>

            <div className="border rounded p-4 bg-white">
              <p className="text-xs text-gray-500">Alertas do upload</p>
              <p className="text-lg font-bold text-gray-900">
                {selectedAlerts.length}
              </p>
            </div>

            <div className="border rounded p-4 bg-white">
              <p className="text-xs text-gray-500">
                Repetições estruturais ignoradas
              </p>
              <p className="text-lg font-bold text-gray-900">
                {repeticoesIgnoradas.length}
              </p>
            </div>
          </section>

          <section className="grid grid-cols-1 xl:grid-cols-2 gap-6">
            <div className="border rounded bg-white">
              <div className="p-4 border-b">
                <h2 className="font-semibold text-gray-900">
                  Resumo interpretativo da IA
                </h2>
              </div>
              <div className="p-4 space-y-4 text-sm">
                <div>
                  <p className="text-xs font-medium text-gray-500 mb-1">
                    Resumo interpretativo
                  </p>
                  <p className="text-gray-800">
                    {resumoInterpretativo || "Nenhum resumo interpretativo disponível."}
                  </p>
                </div>

                <div>
                  <p className="text-xs font-medium text-gray-500 mb-1">
                    Resumo contextual da IA
                  </p>
                  <p className="text-gray-800">
                    {resumoContextualIa || "Nenhum resumo contextual disponível."}
                  </p>
                </div>
              </div>
            </div>

            <div className="border rounded bg-white">
              <div className="p-4 border-b">
                <h2 className="font-semibold text-gray-900">
                  Contexto técnico do upload
                </h2>
              </div>
              <div className="p-4 space-y-4 text-sm">
                <div>
                  <p className="text-xs font-medium text-gray-500 mb-1">
                    Tipo de contexto
                  </p>
                  <p className="text-gray-800">
                    {normalizeLabel(resumoContextual?.tipo_contexto)}
                  </p>
                </div>

                <div>
                  <p className="text-xs font-medium text-gray-500 mb-1">
                    Repetições analíticas relevantes
                  </p>
                  <p className="text-gray-800">{repeticaoAnalitica.length}</p>
                </div>

                <div>
                  <p className="text-xs font-medium text-gray-500 mb-1">
                    Repetições estruturais ignoradas
                  </p>
                  <p className="text-gray-800">{repeticoesIgnoradas.length}</p>
                </div>
              </div>
            </div>
          </section>

          <section className="grid grid-cols-1 xl:grid-cols-2 gap-6">
            <div className="border rounded bg-white overflow-hidden">
              <div className="p-4 border-b">
                <h2 className="font-semibold text-gray-900">
                  Top concentração por fornecedor
                </h2>
              </div>

              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b">
                  <tr>
                    <th className="text-left p-3">Fornecedor</th>
                    <th className="text-right p-3">Valor</th>
                  </tr>
                </thead>
                <tbody>
                  {topConcentracao.map((item, index) => (
                    <tr key={`${normalizeLabel(item["nome_credor_servidor"])}-${index}`} className="border-b">
                      <td className="p-3">
                        {normalizeLabel(item["nome_credor_servidor"])}
                      </td>
                      <td className="p-3 text-right">
                        {formatMoney(
                          parseAmount(item["valor_bruto"] ?? item["valor_total"])
                        )}
                      </td>
                    </tr>
                  ))}

                  {topConcentracao.length === 0 && (
                    <tr>
                      <td colSpan={2} className="p-4 text-gray-500">
                        Nenhum ranking disponível.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            <div className="border rounded bg-white overflow-hidden">
              <div className="p-4 border-b">
                <h2 className="font-semibold text-gray-900">
                  Maiores registros do upload
                </h2>
              </div>

              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b">
                  <tr>
                    <th className="text-left p-3">Nome</th>
                    <th className="text-left p-3">Documento</th>
                    <th className="text-right p-3">Valor</th>
                  </tr>
                </thead>
                <tbody>
                  {maioresRegistros.map((item, index) => (
                    <tr key={`${normalizeLabel(item["nome_credor_servidor"])}-${index}`} className="border-b">
                      <td className="p-3">
                        {normalizeLabel(item["nome_credor_servidor"])}
                      </td>
                      <td className="p-3">
                        {normalizeLabel(item["documento"])}
                      </td>
                      <td className="p-3 text-right">
                        {formatMoney(parseAmount(item["valor_bruto"]))}
                      </td>
                    </tr>
                  ))}

                  {maioresRegistros.length === 0 && (
                    <tr>
                      <td colSpan={3} className="p-4 text-gray-500">
                        Nenhum registro disponível.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>

          <section className="grid grid-cols-1 xl:grid-cols-2 gap-6">
            <div className="border rounded bg-white overflow-hidden">
              <div className="p-4 border-b">
                <h2 className="font-semibold text-gray-900">
                  Resumo por modalidade
                </h2>
              </div>

              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b">
                  <tr>
                    <th className="text-left p-3">Modalidade</th>
                    <th className="text-right p-3">Valor</th>
                    <th className="text-right p-3">Qtd.</th>
                  </tr>
                </thead>
                <tbody>
                  {porModalidade.map((item, index) => (
                    <tr key={`${normalizeLabel(item["modalidade"])}-${index}`} className="border-b">
                      <td className="p-3">{normalizeLabel(item["modalidade"])}</td>
                      <td className="p-3 text-right">
                        {formatMoney(parseAmount(item["valor_total"]))}
                      </td>
                      <td className="p-3 text-right">
                        {Number(item["qtd_registros"] || 0)}
                      </td>
                    </tr>
                  ))}

                  {porModalidade.length === 0 && (
                    <tr>
                      <td colSpan={3} className="p-4 text-gray-500">
                        Nenhuma modalidade disponível.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            <div className="border rounded bg-white overflow-hidden">
              <div className="p-4 border-b">
                <h2 className="font-semibold text-gray-900">
                  Resumo por tipo de ato
                </h2>
              </div>

              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b">
                  <tr>
                    <th className="text-left p-3">Tipo de ato</th>
                    <th className="text-right p-3">Valor</th>
                    <th className="text-right p-3">Qtd.</th>
                  </tr>
                </thead>
                <tbody>
                  {porTipoAto.map((item, index) => (
                    <tr key={`${normalizeLabel(item["tipo_ato"])}-${index}`} className="border-b">
                      <td className="p-3">{normalizeLabel(item["tipo_ato"])}</td>
                      <td className="p-3 text-right">
                        {formatMoney(parseAmount(item["valor_total"]))}
                      </td>
                      <td className="p-3 text-right">
                        {Number(item["qtd_registros"] || 0)}
                      </td>
                    </tr>
                  ))}

                  {porTipoAto.length === 0 && (
                    <tr>
                      <td colSpan={3} className="p-4 text-gray-500">
                        Nenhum tipo de ato disponível.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>

          <section className="border rounded bg-white overflow-hidden">
            <div className="p-4 border-b">
              <h2 className="font-semibold text-gray-900">
                Alertas do upload selecionado
              </h2>
            </div>

            <div className="divide-y">
              {selectedAlerts.map((alert) => (
                <article key={alert.id} className="p-4 space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className={`border rounded px-2 py-1 text-xs ${severityClass(
                        alert.severity
                      )}`}
                    >
                      {alert.severity || "baixa"}
                    </span>

                    <span className="text-xs text-gray-500">
                      {categoryLabel(alert.category)}
                    </span>

                    <span className="text-xs text-gray-500">
                      {formatDate(alert.created_at)}
                    </span>

                    {alert.amount !== null && alert.amount !== undefined && (
                      <span className="text-xs text-gray-500">
                        {formatMoney(parseAmount(alert.amount))}
                      </span>
                    )}
                  </div>

                  <h3 className="font-medium text-gray-900">{alert.title}</h3>

                  <p className="text-sm text-gray-700">
                    {alert.explanation || "Sem explicação registrada."}
                  </p>

                  {alert.supplier_name && (
                    <p className="text-xs text-gray-500">
                      Fornecedor: {alert.supplier_name}
                    </p>
                  )}
                </article>
              ))}

              {selectedAlerts.length === 0 && (
                <p className="p-4 text-sm text-gray-500">
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
