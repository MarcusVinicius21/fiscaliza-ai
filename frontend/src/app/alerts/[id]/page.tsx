"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { supabase } from "@/lib/supabase";

type JsonObject = Record<string, unknown>;

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
  source_record_id?: string | null;
  created_at?: string | null;
  cities?: { name: string; state: string } | null;
}

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

interface AnalysisLog {
  upload_id: string;
  input_summary?: string | JsonObject | null;
  ai_output?: string | JsonObject | null;
  created_at?: string | null;
}

interface StandardizedRecord {
  id: string;
  upload_id: string;
  nome_credor_servidor?: string | null;
  documento?: string | null;
  valor_bruto?: number | string | null;
  raw_json?: string | JsonObject | null;
}

function parseJson(value: unknown): JsonObject {
  if (!value) return {};
  if (typeof value === "object" && !Array.isArray(value)) {
    return value as JsonObject;
  }

  try {
    const parsed = JSON.parse(String(value));
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? (parsed as JsonObject)
      : {};
  } catch {
    return {};
  }
}

function asRecordArray(value: unknown): JsonObject[] {
  if (!Array.isArray(value)) return [];

  return value.filter(
    (item): item is JsonObject =>
      Boolean(item) && typeof item === "object" && !Array.isArray(item)
  );
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

function normalizeText(value: unknown) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

function normalizeLabel(value: unknown) {
  const txt = String(value || "").trim();
  return txt || "Não informado";
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

function formatPercent(value: number) {
  return `${value.toLocaleString("pt-BR", {
    maximumFractionDigits: 2,
  })}%`;
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

function displayValue(value: unknown) {
  if (value === null || value === undefined || value === "") {
    return "Não informado";
  }

  if (typeof value === "object") {
    try {
      return JSON.stringify(value);
    } catch {
      return "Valor não exibível";
    }
  }

  return String(value);
}

function getRawDict(record: StandardizedRecord | null): JsonObject {
  if (!record) return {};
  return parseJson(record.raw_json);
}

function getRawValue(record: StandardizedRecord | null, keys: string[]) {
  const raw = getRawDict(record);

  for (const key of keys) {
    const value = raw[key];
    if (normalizeText(value)) return displayValue(value);
  }

  return "";
}

function roundMoney(value: unknown) {
  return Math.round(parseAmount(value) * 100) / 100;
}

function findMatchingAiAlert(alert: AlertRecord | null, aiAlerts: JsonObject[]) {
  if (!alert) return null;

  const alertTitle = normalizeText(alert.title);
  const alertSupplier = normalizeText(alert.supplier_name);
  const alertAmount = roundMoney(alert.amount);

  return (
    aiAlerts.find((item) => {
      const itemTitle = normalizeText(item.title);
      const itemSupplier = normalizeText(item.supplier_name);
      const itemAmount = roundMoney(item.amount);

      const sameTitle = alertTitle && itemTitle && alertTitle === itemTitle;
      const sameSupplierAndAmount =
        alertSupplier &&
        itemSupplier &&
        alertSupplier === itemSupplier &&
        alertAmount > 0 &&
        itemAmount === alertAmount;

      return sameTitle || sameSupplierAndAmount;
    }) || null
  );
}

function rawPreviewEntries(record: StandardizedRecord | null) {
  if (!record) return [];

  const preferredFields: Array<[string, string]> = [
    ["numero_contrato", "Número do contrato"],
    ["contrato", "Contrato"],
    ["numero_licitacao", "Número da licitação"],
    ["licitacao", "Licitação"],
    ["modalidade", "Modalidade"],
    ["tipo_ato", "Tipo de ato"],
    ["situacao", "Situação"],
    ["objeto", "Objeto"],
    ["inicio_vigencia", "Início da vigência"],
    ["termino_vigencia", "Término da vigência"],
    ["fiscal_nome", "Fiscal"],
    ["competencia", "Competência"],
    ["data", "Data"],
  ];

  const preferred = preferredFields
    .map(([key, label]) => ({
      label,
      value: getRawValue(record, [key]),
    }))
    .filter((item) => normalizeText(item.value));

  if (preferred.length > 0) {
    return preferred.slice(0, 10);
  }

  return Object.entries(getRawDict(record))
    .filter(([, value]) => normalizeText(value))
    .slice(0, 10)
    .map(([key, value]) => ({
      label: key,
      value: displayValue(value),
    }));
}

function mergeRecords(groups: Array<StandardizedRecord[]>) {
  const seen = new Set<string>();
  const merged: StandardizedRecord[] = [];

  for (const group of groups) {
    for (const record of group) {
      const key =
        record.id ||
        `${record.upload_id}-${record.nome_credor_servidor}-${record.documento}-${record.valor_bruto}`;

      if (!seen.has(key)) {
        seen.add(key);
        merged.push(record);
      }
    }
  }

  return merged;
}

export default function AlertDetailPage() {
  const params = useParams<{ id: string }>();
  const alertId = params.id;

  const [alert, setAlert] = useState<AlertRecord | null>(null);
  const [upload, setUpload] = useState<UploadRecord | null>(null);
  const [analysisLog, setAnalysisLog] = useState<AnalysisLog | null>(null);
  const [records, setRecords] = useState<StandardizedRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    if (alertId) {
      fetchAlertDetail(alertId);
    }
  }, [alertId]);

  async function fetchRelatedRecords(alertData: AlertRecord) {
    const supplier = normalizeText(alertData.supplier_name);
    const amount = parseAmount(alertData.amount);

    const recordGroups: StandardizedRecord[][] = [];

    if (alertData.source_record_id) {
      const { data, error } = await supabase
        .from("standardized_records")
        .select(
          "id, upload_id, nome_credor_servidor, documento, valor_bruto, raw_json"
        )
        .eq("id", alertData.source_record_id)
        .limit(1);

      if (error) throw new Error(error.message);
      if (data && data.length > 0) {
        recordGroups.push(data as StandardizedRecord[]);
      }
    }

    const queries = [];

    if (supplier) {
      queries.push(
        supabase
          .from("standardized_records")
          .select(
            "id, upload_id, nome_credor_servidor, documento, valor_bruto, raw_json"
          )
          .eq("upload_id", alertData.upload_id)
          .ilike("nome_credor_servidor", `%${alertData.supplier_name}%`)
          .limit(30)
      );
    }

    if (amount > 0) {
      queries.push(
        supabase
          .from("standardized_records")
          .select(
            "id, upload_id, nome_credor_servidor, documento, valor_bruto, raw_json"
          )
          .eq("upload_id", alertData.upload_id)
          .eq("valor_bruto", amount)
          .limit(30)
      );
    }

    if (queries.length === 0) {
      queries.push(
        supabase
          .from("standardized_records")
          .select(
            "id, upload_id, nome_credor_servidor, documento, valor_bruto, raw_json"
          )
          .eq("upload_id", alertData.upload_id)
          .order("valor_bruto", { ascending: false })
          .limit(20)
      );
    }

    const responses = await Promise.all(queries);
    const firstError = responses.find((response) => response.error)?.error;

    if (firstError) {
      throw new Error(firstError.message);
    }

    for (const response of responses) {
      recordGroups.push((response.data as StandardizedRecord[]) || []);
    }

    return mergeRecords(recordGroups);
  }

  async function fetchAlertDetail(id: string) {
    setLoading(true);
    setErrorMessage("");

    try {
      const { data: alertData, error: alertError } = await supabase
        .from("alerts")
        .select(
          "id, upload_id, city_id, category, report_type, report_label, title, explanation, severity, amount, supplier_name, source_record_id, created_at, cities(name, state)"
        )
        .eq("id", id)
        .single();

      if (alertError) throw new Error(alertError.message);
      if (!alertData) throw new Error("Alerta não encontrado.");

      const currentAlert = alertData as unknown as AlertRecord;

      const [uploadRes, logsRes] = await Promise.all([
        supabase
          .from("uploads")
          .select(
            "id, city_id, file_name, category, report_type, report_label, status, analysis_status, created_at, cities(name, state)"
          )
          .eq("id", currentAlert.upload_id)
          .single(),
        supabase
          .from("ai_analysis_logs")
          .select("upload_id, input_summary, ai_output, created_at")
          .eq("upload_id", currentAlert.upload_id)
          .order("created_at", { ascending: false })
          .limit(1),
      ]);

      if (uploadRes.error) throw new Error(uploadRes.error.message);
      if (logsRes.error) throw new Error(logsRes.error.message);

      const relatedRecords = await fetchRelatedRecords(currentAlert);

      setAlert(currentAlert);
      setUpload((uploadRes.data as unknown as UploadRecord) || null);
      setAnalysisLog(((logsRes.data as AnalysisLog[]) || [])[0] || null);
      setRecords(relatedRecords);
    } catch (error: unknown) {
      const message =
        error instanceof Error
          ? error.message
          : "Falha ao carregar detalhe do alerta.";

      setErrorMessage(message);
    } finally {
      setLoading(false);
    }
  }

  const inputSummary = useMemo(
    () => parseJson(analysisLog?.input_summary),
    [analysisLog]
  );

  const aiOutput = useMemo(
    () => parseJson(analysisLog?.ai_output),
    [analysisLog]
  );

  const resumoContextual = useMemo(
    () => parseJson(inputSummary.resumo_contextual),
    [inputSummary]
  );

  const aiAlerts = asRecordArray(aiOutput.alertas);
  const matchedAiAlert = findMatchingAiAlert(alert, aiAlerts);

  const firstRecord = records[0] || null;
  const rawEntries = rawPreviewEntries(firstRecord);

  const alertAmount = parseAmount(alert?.amount);
  const totalUpload = parseAmount(inputSummary.valor_total_soma);
  const percentOfUpload =
    totalUpload > 0 ? (alertAmount / totalUpload) * 100 : 0;

  const topConcentracao = asRecordArray(inputSummary.top_5_concentracao_volume);
  const supplierContext =
    topConcentracao.find(
      (item) =>
        normalizeText(item.nome_credor_servidor) ===
        normalizeText(alert?.supplier_name)
    ) || null;

  const supplierTotal = parseAmount(
    supplierContext?.valor_bruto ?? supplierContext?.valor_total
  );

  const supplierPercent =
    totalUpload > 0 ? (supplierTotal / totalUpload) * 100 : 0;

  const repeatedContext =
    asRecordArray(inputSummary.alerta_potencial_repeticao_contratual).length ||
    asRecordArray(inputSummary.alerta_potencial_duplicidade).length;

  if (loading) {
    return (
      <div className="p-6">
        <p className="text-sm text-gray-600">Carregando detalhe do alerta...</p>
      </div>
    );
  }

  if (errorMessage) {
    return (
      <div className="space-y-4">
        <Link href="/alerts" className="text-sm text-blue-700 hover:underline">
          Voltar para alertas
        </Link>

        <div className="border border-red-200 bg-red-50 p-4 rounded text-sm text-red-700">
          {errorMessage}
        </div>
      </div>
    );
  }

  if (!alert) {
    return (
      <div className="space-y-4">
        <Link href="/alerts" className="text-sm text-blue-700 hover:underline">
          Voltar para alertas
        </Link>

        <div className="border rounded p-4 bg-white text-sm text-gray-600">
          Alerta não encontrado.
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <header className="space-y-3">
        <Link href="/alerts" className="text-sm text-blue-700 hover:underline">
          Voltar para alertas
        </Link>

        <div className="space-y-2">
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
          </div>

          <h1 className="text-2xl font-bold text-gray-900">{alert.title}</h1>

          <p className="text-sm text-gray-700">
            {alert.explanation || "Sem explicação registrada."}
          </p>
        </div>
      </header>

      <section className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="border rounded p-4 bg-white">
          <p className="text-xs text-gray-500">Valor do alerta</p>
          <p className="text-lg font-bold text-gray-900">
            {formatMoney(alertAmount)}
          </p>
        </div>

        <div className="border rounded p-4 bg-white">
          <p className="text-xs text-gray-500">Fornecedor</p>
          <p className="text-lg font-bold text-gray-900">
            {alert.supplier_name || "Não informado"}
          </p>
        </div>

        <div className="border rounded p-4 bg-white">
          <p className="text-xs text-gray-500">Cidade</p>
          <p className="text-lg font-bold text-gray-900">
            {alert.cities?.name
              ? `${alert.cities.name}/${alert.cities.state}`
              : "Não informada"}
          </p>
        </div>

        <div className="border rounded p-4 bg-white">
          <p className="text-xs text-gray-500">Registros relacionados</p>
          <p className="text-lg font-bold text-gray-900">{records.length}</p>
        </div>
      </section>

      <section className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <div className="border rounded bg-white">
          <div className="p-4 border-b">
            <h2 className="font-semibold text-gray-900">Origem do alerta</h2>
          </div>

          <div className="p-4 space-y-3 text-sm">
            <p>
              <strong>Upload:</strong>{" "}
              {upload?.file_name || "Upload não encontrado"}
            </p>

            <p>
              <strong>Categoria:</strong>{" "}
              {categoryLabel(upload?.category || alert.category)}
            </p>

            <p>
              <strong>Relatório:</strong>{" "}
              {upload?.report_type ||
                upload?.report_label ||
                alert.report_type ||
                alert.report_label ||
                "Não informado"}
            </p>

            <p>
              <strong>Status do upload:</strong>{" "}
              {upload?.status || "Não informado"}
            </p>

            <p>
              <strong>Status da análise:</strong>{" "}
              {upload?.analysis_status || "Não informado"}
            </p>

            <p>
              <strong>Data do upload:</strong> {formatDate(upload?.created_at)}
            </p>

            <p>
              <strong>Source record ID:</strong>{" "}
              {alert.source_record_id || "Não vinculado"}
            </p>
          </div>
        </div>

        <div className="border rounded bg-white">
          <div className="p-4 border-b">
            <h2 className="font-semibold text-gray-900">
              Resumo explicativo com apoio da IA
            </h2>
          </div>

          <div className="p-4 space-y-4 text-sm">
            <div>
              <p className="text-xs font-medium text-gray-500 mb-1">
                Resumo contextual da IA
              </p>
              <p className="text-gray-800">
                {displayValue(aiOutput.resumo_contextual_ia) ||
                  "Resumo contextual indisponível."}
              </p>
            </div>

            <div>
              <p className="text-xs font-medium text-gray-500 mb-1">
                Resumo interpretativo
              </p>
              <p className="text-gray-800">
                {displayValue(aiOutput.resumo_interpretativo) ||
                  "Resumo interpretativo indisponível."}
              </p>
            </div>

            {matchedAiAlert && (
              <div className="border rounded p-3 bg-gray-50">
                <p className="text-xs font-medium text-gray-500 mb-1">
                  Alerta correspondente no retorno da IA
                </p>
                <p className="font-medium text-gray-900">
                  {displayValue(matchedAiAlert.title)}
                </p>
                <p className="text-gray-700">
                  {displayValue(matchedAiAlert.explanation)}
                </p>
              </div>
            )}
          </div>
        </div>
      </section>

      <section className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <div className="border rounded bg-white">
          <div className="p-4 border-b">
            <h2 className="font-semibold text-gray-900">
              Comparação simples
            </h2>
          </div>

          <div className="p-4 space-y-3 text-sm">
            <p>
              <strong>Total analisado no upload:</strong>{" "}
              {formatMoney(totalUpload)}
            </p>

            <p>
              <strong>Valor deste alerta:</strong> {formatMoney(alertAmount)}
            </p>

            <p>
              <strong>Participação no total analisado:</strong>{" "}
              {formatPercent(percentOfUpload)}
            </p>

            <p>
              <strong>Total do fornecedor no ranking da análise:</strong>{" "}
              {supplierTotal > 0
                ? formatMoney(supplierTotal)
                : "Não encontrado"}
            </p>

            <p>
              <strong>Participação do fornecedor no total:</strong>{" "}
              {supplierTotal > 0
                ? formatPercent(supplierPercent)
                : "Não calculada"}
            </p>
          </div>
        </div>

        <div className="border rounded bg-white">
          <div className="p-4 border-b">
            <h2 className="font-semibold text-gray-900">
              O que motivou o alerta
            </h2>
          </div>

          <div className="p-4 space-y-3 text-sm">
            <p>
              O alerta foi gerado a partir da análise já salva na Etapa 5 para o
              upload de origem.
            </p>

            <p>
              <strong>Tipo de contexto técnico:</strong>{" "}
              {normalizeLabel(resumoContextual.tipo_contexto)}
            </p>

            <p>
              <strong>Repetições analíticas relevantes no upload:</strong>{" "}
              {repeatedContext}
            </p>

            <p>
              <strong>Registros candidatos encontrados:</strong> {records.length}
            </p>

            <p className="text-gray-600">
              Esta tela não recalcula a análise. Ela apenas mostra a origem e o
              contexto do alerta já gerado.
            </p>
          </div>
        </div>
      </section>

      <section className="border rounded bg-white overflow-hidden">
        <div className="p-4 border-b">
          <h2 className="font-semibold text-gray-900">
            Registros relacionados
          </h2>
        </div>

        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b">
            <tr>
              <th className="text-left p-3">Fornecedor / nome</th>
              <th className="text-left p-3">Documento</th>
              <th className="text-right p-3">Valor</th>
            </tr>
          </thead>

          <tbody>
            {records.map((record) => (
              <tr key={record.id} className="border-b">
                <td className="p-3">
                  {normalizeLabel(record.nome_credor_servidor)}
                </td>
                <td className="p-3">{normalizeLabel(record.documento)}</td>
                <td className="p-3 text-right">
                  {formatMoney(parseAmount(record.valor_bruto))}
                </td>
              </tr>
            ))}

            {records.length === 0 && (
              <tr>
                <td colSpan={3} className="p-4 text-gray-500">
                  Nenhum registro relacionado encontrado.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </section>

      <section className="border rounded bg-white">
        <div className="p-4 border-b">
          <h2 className="font-semibold text-gray-900">Origem do dado</h2>
        </div>

        <div className="p-4 space-y-3 text-sm">
          <p className="text-gray-600">
            Campos abaixo foram extraídos do `raw_json` preservado no ETL.
          </p>

          {rawEntries.length > 0 ? (
            <dl className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {rawEntries.map((entry) => (
                <div key={entry.label} className="border rounded p-3">
                  <dt className="text-xs font-medium text-gray-500">
                    {entry.label}
                  </dt>
                  <dd className="text-gray-900 break-words">{entry.value}</dd>
                </div>
              ))}
            </dl>
          ) : (
            <p className="text-gray-500">
              Nenhum campo bruto relevante foi encontrado para exibição.
            </p>
          )}

          {firstRecord && (
            <details className="border rounded p-3 bg-slate-50">
              <summary className="cursor-pointer font-medium text-slate-800">
                Ver raw_json completo do primeiro registro relacionado
              </summary>
              <pre className="mt-3 overflow-x-auto text-xs text-slate-700">
                {JSON.stringify(getRawDict(firstRecord), null, 2)}
              </pre>
            </details>
          )}
        </div>
      </section>
    </div>
  );
}
