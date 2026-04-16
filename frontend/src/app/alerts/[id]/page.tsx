"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { StatusPill } from "@/components/app/status-pill";
import { SkeletonBlock } from "@/components/app/skeleton-block";
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

function severityTone(severity?: string | null) {
  const sev = String(severity || "").toLowerCase();

  if (sev.includes("alta")) return "danger";
  if (sev.includes("media") || sev.includes("média")) return "warning";

  return "info";
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
      <div className="invest-page">
        <section className="invest-page-hero p-6">
          <p className="invest-eyebrow">Detalhe do alerta</p>
          <h1 className="invest-title mt-3 text-3xl">Carregando evidência</h1>
          <div className="mt-6 max-w-xl">
            <SkeletonBlock lines={4} />
          </div>
        </section>
      </div>
    );
  }

  if (errorMessage) {
    return (
      <div className="invest-page">
        <Link href="/alerts" className="invest-button-secondary w-fit px-4 py-2 text-sm">
          Voltar para alertas
        </Link>

        <div className="rounded-lg border border-[rgba(230,57,70,0.4)] bg-[rgba(230,57,70,0.1)] p-4 text-sm text-[#ffb4ba]">
          {errorMessage}
        </div>
      </div>
    );
  }

  if (!alert) {
    return (
      <div className="invest-page">
        <Link href="/alerts" className="invest-button-secondary w-fit px-4 py-2 text-sm">
          Voltar para alertas
        </Link>

        <div className="invest-card p-5 text-sm text-[var(--invest-muted)]">
          Alerta não encontrado.
        </div>
      </div>
    );
  }

  return (
    <div className="invest-page">
      <section className="invest-page-hero p-6 md:p-8">
        <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
          <div>
            <Link href="/alerts" className="invest-button-secondary mb-5 w-fit px-4 py-2 text-sm">
              Voltar para alertas
            </Link>

            <div className="flex flex-wrap items-center gap-2">
              <StatusPill tone={severityTone(alert.severity)}>
                {alert.severity || "baixa"}
              </StatusPill>
              <span className="invest-chip">{categoryLabel(alert.category)}</span>
              <span className="invest-chip">{formatDate(alert.created_at)}</span>
            </div>

            <h1 className="invest-title mt-5 max-w-4xl text-3xl md:text-5xl">
              {alert.title}
            </h1>

            <p className="invest-subtitle mt-4 max-w-3xl text-base">
              {alert.explanation || "Sem explicação registrada."}
            </p>
          </div>

          <aside className="invest-card p-5">
            <p className="invest-eyebrow">Ação pública</p>
            <h2 className="mt-2 text-lg font-black text-white">
              Comunicação rastreável
            </h2>
            <p className="mt-3 text-sm leading-6 text-[var(--invest-muted)]">
              Gere uma arte apenas com base no alerta e no contexto já
              persistido.
            </p>
            <Link
              href={`/creatives/${alert.id}`}
              className="invest-button mt-5 w-full px-4 py-2 text-sm"
            >
              Gerar arte
            </Link>
          </aside>
        </div>
      </section>

      <section className="grid grid-cols-1 gap-4 md:grid-cols-4">
        <div className="invest-kpi">
          <p className="text-xs font-bold text-[var(--invest-muted)]">
            Valor do alerta
          </p>
          <p className="invest-number mt-2 text-2xl font-black text-white">
            {formatMoney(alertAmount)}
          </p>
        </div>

        <div className="invest-kpi">
          <p className="text-xs font-bold text-[var(--invest-muted)]">
            Fornecedor
          </p>
          <p className="mt-2 text-lg font-black text-white">
            {alert.supplier_name || "Não informado"}
          </p>
        </div>

        <div className="invest-kpi">
          <p className="text-xs font-bold text-[var(--invest-muted)]">Cidade</p>
          <p className="mt-2 text-lg font-black text-white">
            {alert.cities?.name
              ? `${alert.cities.name}/${alert.cities.state}`
              : "Não informada"}
          </p>
        </div>

        <div className="invest-kpi">
          <p className="text-xs font-bold text-[var(--invest-muted)]">
            Registros relacionados
          </p>
          <p className="invest-number mt-2 text-2xl font-black text-white">
            {records.length}
          </p>
        </div>
      </section>

      <section className="grid grid-cols-1 gap-6 xl:grid-cols-[0.9fr_1.1fr]">
        <div className="invest-card p-6">
          <p className="invest-eyebrow">Origem</p>
          <h2 className="mt-2 text-xl font-black text-white">
            Upload que gerou o alerta
          </h2>

          <dl className="mt-5 grid grid-cols-1 gap-3 text-sm">
            {[
              ["Upload", upload?.file_name || "Upload não encontrado"],
              ["Categoria", categoryLabel(upload?.category || alert.category)],
              [
                "Relatório",
                upload?.report_type ||
                  upload?.report_label ||
                  alert.report_type ||
                  alert.report_label ||
                  "Não informado",
              ],
              ["Status do upload", upload?.status || "Não informado"],
              ["Status da análise", upload?.analysis_status || "Não informado"],
              ["Data do upload", formatDate(upload?.created_at)],
              ["Source record ID", alert.source_record_id || "Não vinculado"],
            ].map(([label, value]) => (
              <div
                key={label}
                className="rounded-lg border border-[var(--invest-border)] bg-[rgba(3,7,18,0.28)] p-3"
              >
                <dt className="text-xs font-black uppercase tracking-[0.1em] text-[var(--invest-faint)]">
                  {label}
                </dt>
                <dd className="mt-1 break-words font-bold text-white">
                  {value}
                </dd>
              </div>
            ))}
          </dl>
        </div>

        <div className="invest-card p-6">
          <p className="invest-eyebrow">Apoio da IA</p>
          <h2 className="mt-2 text-xl font-black text-white">
            Resumo explicativo
          </h2>

          <div className="mt-5 grid grid-cols-1 gap-4 lg:grid-cols-2">
            <div className="invest-evidence rounded-lg p-4">
              <p className="text-xs font-black uppercase tracking-[0.12em] text-[var(--invest-cyan)]">
                Resumo contextual da IA
              </p>
              <p className="mt-3 text-sm leading-7 text-[#dbe6f3]">
                {displayValue(aiOutput.resumo_contextual_ia) ||
                  "Resumo contextual indisponível."}
              </p>
            </div>

            <div className="rounded-lg border border-[var(--invest-border)] bg-[rgba(3,7,18,0.28)] p-4">
              <p className="text-xs font-black uppercase tracking-[0.12em] text-[var(--invest-faint)]">
                Resumo interpretativo
              </p>
              <p className="mt-3 text-sm leading-7 text-[#dbe6f3]">
                {displayValue(aiOutput.resumo_interpretativo) ||
                  "Resumo interpretativo indisponível."}
              </p>
            </div>
          </div>

          {matchedAiAlert && (
            <div className="mt-4 rounded-lg border border-[rgba(245,184,75,0.32)] bg-[rgba(245,184,75,0.08)] p-4">
              <p className="text-xs font-black uppercase tracking-[0.12em] text-[var(--invest-warning)]">
                Alerta correspondente no retorno da IA
              </p>
              <p className="mt-2 font-black text-white">
                {displayValue(matchedAiAlert.title)}
              </p>
              <p className="mt-2 text-sm leading-6 text-[var(--invest-muted)]">
                {displayValue(matchedAiAlert.explanation)}
              </p>
            </div>
          )}
        </div>
      </section>

      <section className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <div className="invest-card p-6">
          <p className="invest-eyebrow">Comparação</p>
          <h2 className="mt-2 text-xl font-black text-white">
            Proporção no upload analisado
          </h2>

          <div className="mt-5 space-y-4 text-sm">
            <div className="flex items-center justify-between border-b border-[var(--invest-border)] pb-3">
              <span className="text-[var(--invest-muted)]">Total analisado</span>
              <span className="invest-number font-black text-white">
                {formatMoney(totalUpload)}
              </span>
            </div>
            <div className="flex items-center justify-between border-b border-[var(--invest-border)] pb-3">
              <span className="text-[var(--invest-muted)]">Valor deste alerta</span>
              <span className="invest-number font-black text-white">
                {formatMoney(alertAmount)}
              </span>
            </div>
            <div className="flex items-center justify-between border-b border-[var(--invest-border)] pb-3">
              <span className="text-[var(--invest-muted)]">Participação no total</span>
              <span className="invest-number font-black text-white">
                {formatPercent(percentOfUpload)}
              </span>
            </div>
            <div className="flex items-center justify-between border-b border-[var(--invest-border)] pb-3">
              <span className="text-[var(--invest-muted)]">Total do fornecedor</span>
              <span className="invest-number font-black text-white">
                {supplierTotal > 0 ? formatMoney(supplierTotal) : "Não encontrado"}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-[var(--invest-muted)]">Participação do fornecedor</span>
              <span className="invest-number font-black text-white">
                {supplierTotal > 0 ? formatPercent(supplierPercent) : "Não calculada"}
              </span>
            </div>
          </div>
        </div>

        <div className="invest-card-highlight p-6">
          <p className="invest-eyebrow">Motivação</p>
          <h2 className="mt-2 text-xl font-black text-white">
            Por que isto apareceu
          </h2>

          <div className="mt-5 space-y-4 text-sm leading-6 text-[var(--invest-muted)]">
            <p>
              O alerta foi gerado a partir da análise já salva na Etapa 5 para o
              upload de origem.
            </p>
            <p>
              <strong className="text-white">Tipo de contexto técnico:</strong>{" "}
              {normalizeLabel(resumoContextual.tipo_contexto)}
            </p>
            <p>
              <strong className="text-white">Repetições analíticas relevantes:</strong>{" "}
              {repeatedContext}
            </p>
            <p>
              <strong className="text-white">Registros candidatos encontrados:</strong>{" "}
              {records.length}
            </p>
            <p>
              Esta tela não recalcula a análise. Ela apenas mostra origem,
              contexto e evidência do alerta já gerado.
            </p>
          </div>
        </div>
      </section>

      <section className="invest-card overflow-hidden">
        <div className="border-b border-[var(--invest-border)] p-5">
          <p className="invest-eyebrow">Evidências</p>
          <h2 className="mt-2 text-xl font-black text-white">
            Registros relacionados
          </h2>
        </div>

        <div className="invest-soft-scroll overflow-x-auto">
          <table className="invest-table">
            <thead>
              <tr>
                <th>Fornecedor / nome</th>
                <th>Documento</th>
                <th className="text-right">Valor</th>
              </tr>
            </thead>

            <tbody>
              {records.map((record) => (
                <tr key={record.id}>
                  <td>{normalizeLabel(record.nome_credor_servidor)}</td>
                  <td>{normalizeLabel(record.documento)}</td>
                  <td className="text-right invest-number">
                    {formatMoney(parseAmount(record.valor_bruto))}
                  </td>
                </tr>
              ))}

              {records.length === 0 && (
                <tr>
                  <td colSpan={3}>Nenhum registro relacionado encontrado.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="invest-card p-6">
        <p className="invest-eyebrow">Prova de origem</p>
        <h2 className="mt-2 text-xl font-black text-white">Origem do dado</h2>
        <p className="mt-2 text-sm leading-6 text-[var(--invest-muted)]">
          Campos abaixo foram extraídos do `raw_json` preservado no ETL.
        </p>

        {rawEntries.length > 0 ? (
          <dl className="mt-5 grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
            {rawEntries.map((entry) => (
              <div
                key={entry.label}
                className="rounded-lg border border-[var(--invest-border)] bg-[rgba(3,7,18,0.34)] p-4"
              >
                <dt className="text-xs font-black uppercase tracking-[0.1em] text-[var(--invest-faint)]">
                  {entry.label}
                </dt>
                <dd className="mt-2 break-words text-sm font-bold text-white">
                  {entry.value}
                </dd>
              </div>
            ))}
          </dl>
        ) : (
          <p className="mt-5 text-sm text-[var(--invest-muted)]">
            Nenhum campo bruto relevante foi encontrado para exibição.
          </p>
        )}

        {firstRecord && (
          <details className="mt-5 rounded-lg border border-[var(--invest-border)] bg-[rgba(3,7,18,0.42)] p-4">
            <summary className="font-bold text-white">
              Ver raw_json completo do primeiro registro relacionado
            </summary>
            <pre className="invest-soft-scroll mt-4 max-h-[520px] overflow-auto rounded-lg border border-[var(--invest-border)] bg-[#030712] p-4 text-xs leading-5 text-[#dbe6f3]">
              {JSON.stringify(getRawDict(firstRecord), null, 2)}
            </pre>
          </details>
        )}
      </section>
    </div>
  );
}
