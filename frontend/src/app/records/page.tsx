"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { SkeletonBlock } from "@/components/app/skeleton-block";
import { StatusPill } from "@/components/app/status-pill";
import { supabase } from "@/lib/supabase";

type JsonObject = Record<string, unknown>;

interface UploadRecord {
  id: string;
  file_name: string;
  category: string;
  report_type?: string | null;
  report_label?: string | null;
  analysis_status?: string | null;
  created_at?: string | null;
  cities?: { name: string; state: string } | null;
}

interface AlertRecord {
  id: string;
  upload_id: string;
  title: string;
  explanation?: string | null;
  severity?: string | null;
  amount?: number | string | null;
  supplier_name?: string | null;
  source_record_id?: string | null;
  created_at?: string | null;
}

interface StandardizedRecord {
  id: string;
  upload_id: string;
  nome_credor_servidor?: string | null;
  documento?: string | null;
  valor_bruto?: number | string | null;
  created_at?: string | null;
  raw_json?: string | JsonObject | null;
}

const PAGE_SIZE = 20;

function parseJson(value: unknown): JsonObject {
  if (!value) return {};
  if (typeof value === "object" && !Array.isArray(value)) return value as JsonObject;

  try {
    const parsed = JSON.parse(String(value));
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? (parsed as JsonObject)
      : {};
  } catch {
    return {};
  }
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

function formatMoney(value: unknown) {
  return parseAmount(value).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

function formatDate(value?: string | null) {
  if (!value) return "-";

  const text = String(value).trim();
  const dateMatch = text.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  const date = dateMatch
    ? new Date(`${dateMatch[3]}-${dateMatch[2]}-${dateMatch[1]}T00:00:00`)
    : new Date(text);

  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleDateString("pt-BR");
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

function raw(record: StandardizedRecord) {
  return parseJson(record.raw_json);
}

function rawValue(record: StandardizedRecord, keys: string[]) {
  const data = raw(record);
  for (const key of keys) {
    const value = data[key];
    if (normalizeText(value)) return String(value).trim();
  }
  return "";
}

function primaryDate(record: StandardizedRecord) {
  return formatDate(
    rawValue(record, ["data_publicacao"]) ||
      rawValue(record, ["data_assinatura"]) ||
      rawValue(record, ["data_processo"]) ||
      record.created_at ||
      ""
  );
}

function alertFamily(alert: AlertRecord) {
  const text = normalizeText(`${alert.title} ${alert.explanation}`);
  if (text.includes("inexigibilidade") || text.includes("sem disputa")) {
    return "inexigibilidade";
  }
  if (text.includes("dispensa")) return "dispensa";
  if (text.includes("concentr")) return "concentracao";
  if (text.includes("repet") || text.includes("duplic")) return "repeticao";
  return "geral";
}

function sameSupplier(record: StandardizedRecord, alert: AlertRecord) {
  const recordSupplier = normalizeText(record.nome_credor_servidor);
  const alertSupplier = normalizeText(alert.supplier_name);
  return Boolean(
    recordSupplier &&
      alertSupplier &&
      (recordSupplier === alertSupplier ||
        recordSupplier.includes(alertSupplier) ||
        alertSupplier.includes(recordSupplier))
  );
}

function recordAlerts(record: StandardizedRecord, alerts: AlertRecord[]) {
  return alerts.filter((alert) => {
    const family = alertFamily(alert);
    const modality = normalizeText(rawValue(record, ["modalidade"]));
    const recordAmount = Math.round(parseAmount(record.valor_bruto) * 100) / 100;
    const alertAmount = Math.round(parseAmount(alert.amount) * 100) / 100;

    if (alert.source_record_id && alert.source_record_id === record.id) return true;
    if (family === "inexigibilidade") return modality.includes("inexigibilidade");
    if (family === "dispensa") return modality.includes("dispensa");
    if (family === "concentracao") return sameSupplier(record, alert);
    if (family === "repeticao") {
      return sameSupplier(record, alert) && recordAmount > 0 && recordAmount === alertAmount;
    }

    return false;
  });
}

function shortSummary(record: StandardizedRecord) {
  const type = rawValue(record, ["tipo_ato", "tipo"]);
  const modality = rawValue(record, ["modalidade"]);
  const object = rawValue(record, ["objeto", "descricao", "historico"]);

  const base = type || "Linha do arquivo";
  const withModality = modality ? `${base} por ${modality}` : base;
  return object ? `${withModality} para ${object}` : withModality;
}

function duplicateKey(record: StandardizedRecord) {
  return [
    normalizeText(record.nome_credor_servidor),
    normalizeText(record.documento),
    parseAmount(record.valor_bruto).toFixed(2),
    normalizeText(rawValue(record, ["numero_contrato", "contrato"])),
    normalizeText(rawValue(record, ["numero_licitacao", "licitacao"])),
    normalizeText(rawValue(record, ["objeto"])),
  ].join("|");
}

function buildDuplicateMap(records: StandardizedRecord[]) {
  const map = new Map<string, { count: number; fiscais: Set<string> }>();

  for (const record of records) {
    const key = duplicateKey(record);
    const item = map.get(key) || { count: 0, fiscais: new Set<string>() };
    item.count += 1;
    const fiscal = normalizeText(rawValue(record, ["fiscal_nome"]));
    if (fiscal) item.fiscais.add(fiscal);
    map.set(key, item);
  }

  return map;
}

function duplicateStatus(record: StandardizedRecord, duplicateMap: Map<string, { count: number; fiscais: Set<string> }>) {
  const info = duplicateMap.get(duplicateKey(record));
  if (!info || info.count <= 1) {
    return { label: "Sem repetição aparente", tone: "muted" as const };
  }

  if (info.fiscais.size > 1) {
    return { label: `Repetição estrutural provável (${info.count} linhas)`, tone: "warning" as const };
  }

  return { label: `Linha parecida no arquivo (${info.count} vezes)`, tone: "info" as const };
}

export default function RecordsPage() {
  const [uploads, setUploads] = useState<UploadRecord[]>([]);
  const [alerts, setAlerts] = useState<AlertRecord[]>([]);
  const [records, setRecords] = useState<StandardizedRecord[]>([]);
  const [selectedUploadId, setSelectedUploadId] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [textFilter, setTextFilter] = useState("");
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    fetchBaseData();
  }, []);

  useEffect(() => {
    setPage(0);
  }, [selectedUploadId, categoryFilter, typeFilter, textFilter]);

  async function fetchBaseData() {
    setLoading(true);
    setErrorMessage("");

    try {
      const [uploadsRes, alertsRes] = await Promise.all([
        supabase
          .from("uploads")
          .select("id, file_name, category, report_type, report_label, analysis_status, created_at, cities(name, state)")
          .order("created_at", { ascending: false }),
        supabase
          .from("alerts")
          .select("id, upload_id, title, explanation, severity, amount, supplier_name, source_record_id, created_at")
          .order("created_at", { ascending: false }),
      ]);

      if (uploadsRes.error) throw new Error(uploadsRes.error.message);
      if (alertsRes.error) throw new Error(alertsRes.error.message);

      const uploadData = (uploadsRes.data as unknown as UploadRecord[]) || [];
      setUploads(uploadData);
      setAlerts((alertsRes.data as unknown as AlertRecord[]) || []);

      const firstAnalyzed = uploadData.find((item) => item.analysis_status === "analyzed") || uploadData[0];
      if (firstAnalyzed) {
        setSelectedUploadId(firstAnalyzed.id);
        await fetchRecords(firstAnalyzed.id);
      }
    } catch (error: unknown) {
      setErrorMessage(
        error instanceof Error ? error.message : "Falha ao carregar linhas."
      );
    } finally {
      setLoading(false);
    }
  }

  async function fetchRecords(uploadId: string) {
    if (!uploadId) {
      setRecords([]);
      return;
    }

    const initialRecordsRes = await supabase
      .from("standardized_records")
      .select("id, upload_id, nome_credor_servidor, documento, valor_bruto, created_at, raw_json")
      .eq("upload_id", uploadId)
      .order("valor_bruto", { ascending: false })
      .limit(1000);

    let data = initialRecordsRes.data as StandardizedRecord[] | null;
    let error = initialRecordsRes.error;

    if (error && normalizeText(error.message).includes("created_at")) {
      const fallback = await supabase
        .from("standardized_records")
        .select("id, upload_id, nome_credor_servidor, documento, valor_bruto, raw_json")
        .eq("upload_id", uploadId)
        .order("valor_bruto", { ascending: false })
        .limit(1000);

      data = fallback.data as StandardizedRecord[] | null;
      error = fallback.error;
    }

    if (error) throw new Error(error.message);
    setRecords((data as StandardizedRecord[]) || []);
  }

  async function handleUploadChange(uploadId: string) {
    setSelectedUploadId(uploadId);
    setLoading(true);
    setErrorMessage("");

    try {
      await fetchRecords(uploadId);
    } catch (error: unknown) {
      setErrorMessage(
        error instanceof Error ? error.message : "Falha ao carregar linhas."
      );
    } finally {
      setLoading(false);
    }
  }

  const selectedUpload = uploads.find((item) => item.id === selectedUploadId) || null;

  const filteredUploads = useMemo(() => {
    return uploads.filter(
      (upload) => !categoryFilter || upload.category === categoryFilter
    );
  }, [uploads, categoryFilter]);

  const categories = useMemo(() => {
    return Array.from(new Set(uploads.map((item) => item.category).filter(Boolean)));
  }, [uploads]);

  const selectedAlerts = useMemo(() => {
    return alerts.filter((alert) => alert.upload_id === selectedUploadId);
  }, [alerts, selectedUploadId]);

  const alertNumbers = useMemo(() => {
    const map = new Map<string, string>();
    selectedAlerts.forEach((alert, index) => {
      map.set(alert.id, `Alerta ${String(index + 1).padStart(2, "0")}`);
    });
    return map;
  }, [selectedAlerts]);

  const typeOptions = useMemo(() => {
    return Array.from(
      new Set(records.map((record) => rawValue(record, ["tipo_ato", "tipo"])).filter(Boolean))
    ).sort();
  }, [records]);

  const filteredRecords = useMemo(() => {
    const text = normalizeText(textFilter);
    const type = normalizeText(typeFilter);

    return records.filter((record) => {
      const rawData = raw(record);
      const haystack = normalizeText(
        [
          record.nome_credor_servidor,
          record.documento,
          rawData["objeto"],
          rawData["modalidade"],
          rawData["tipo_ato"],
          rawData["numero_contrato"],
          rawData["numero_licitacao"],
        ].join(" ")
      );
      const recordType = normalizeText(rawValue(record, ["tipo_ato", "tipo"]));

      return (!text || haystack.includes(text)) && (!type || recordType === type);
    });
  }, [records, textFilter, typeFilter]);

  const pageCount = Math.max(1, Math.ceil(filteredRecords.length / PAGE_SIZE));
  const currentPage = Math.min(page, pageCount - 1);
  const visibleRecords = filteredRecords.slice(
    currentPage * PAGE_SIZE,
    currentPage * PAGE_SIZE + PAGE_SIZE
  );
  const duplicateMap = useMemo(() => buildDuplicateMap(records), [records]);

  if (loading && records.length === 0) {
    return (
      <div className="page-shell">
        <section className="page-header p-6">
          <p className="invest-eyebrow">Linhas</p>
          <h1 className="invest-title mt-3 text-3xl">Carregando base</h1>
          <div className="mt-6 max-w-xl">
            <SkeletonBlock lines={4} />
          </div>
        </section>
      </div>
    );
  }

  return (
    <div className="page-shell">
      <section className="page-header p-5 md:p-6">
        <p className="invest-eyebrow">Base carregada</p>
        <h1 className="invest-title mt-2 max-w-3xl text-xl leading-tight md:text-[1.875rem]">
          Linhas do arquivo, com vínculos de alerta.
        </h1>
        <p className="invest-subtitle mt-3 max-w-2xl text-sm">
          Consulte as linhas tratadas, veja o resumo humano de cada registro e
          confira se ele participa de algum alerta.
        </p>
      </section>

      {errorMessage && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {errorMessage}
        </div>
      )}

      <section className="rounded-lg border border-[var(--invest-border)] bg-white p-3 shadow-[var(--invest-shadow-soft)]">
        <div className="grid grid-cols-1 gap-3 xl:grid-cols-[180px_minmax(260px,1fr)_180px_240px]">
          <div>
            <label className="invest-label">Categoria</label>
            <select
              value={categoryFilter}
              onChange={(event) => setCategoryFilter(event.target.value)}
              className="invest-select"
            >
              <option value="">Todas</option>
              {categories.map((category) => (
                <option key={category} value={category}>
                  {categoryLabel(category)}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="invest-label">Upload</label>
            <select
              value={selectedUploadId}
              onChange={(event) => handleUploadChange(event.target.value)}
              className="invest-select"
            >
              {filteredUploads.map((upload) => (
                <option key={upload.id} value={upload.id}>
                  {upload.file_name} - {categoryLabel(upload.category)}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="invest-label">Tipo de ato</label>
            <select
              value={typeFilter}
              onChange={(event) => setTypeFilter(event.target.value)}
              className="invest-select"
            >
              <option value="">Todos</option>
              {typeOptions.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="invest-label">Busca</label>
            <input
              value={textFilter}
              onChange={(event) => setTextFilter(event.target.value)}
              className="invest-input"
              placeholder="Fornecedor, objeto, documento"
            />
          </div>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-[var(--invest-border)] pt-3 text-xs font-bold text-[var(--invest-muted)]">
          {selectedUpload && (
            <span className="app-chip">
              Upload: {selectedUpload.file_name}
            </span>
          )}
          <span className="app-chip">{filteredRecords.length} linhas</span>
          <span className="app-chip">{selectedAlerts.length} alertas</span>
          <span className="app-chip">
            Página {currentPage + 1} de {pageCount}
          </span>
          <span className="app-chip">
            Valor filtrado:{" "}
            {formatMoney(
              filteredRecords.reduce(
                (sum, record) => sum + parseAmount(record.valor_bruto),
                0
              )
            )}
          </span>
        </div>
      </section>

      <section className="overflow-hidden rounded-lg border border-[var(--invest-border)] bg-white shadow-[var(--invest-shadow-soft)]">
        <div className="border-b border-[var(--invest-border)] px-4 py-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="invest-eyebrow">Tabela consultável</p>
              <h2 className="mt-1 text-lg font-black text-[var(--invest-heading)]">
                Registros do upload selecionado
              </h2>
            </div>
            <p className="text-sm font-bold text-[var(--invest-muted)]">
              {visibleRecords.length} de {filteredRecords.length} linhas filtradas
            </p>
          </div>
        </div>
        <div className="invest-soft-scroll overflow-x-auto">
          <table className="data-table min-w-[1260px] text-[0.82rem]">
            <thead>
              <tr>
                <th className="w-[190px]">Nome / fornecedor</th>
                <th className="w-[120px]">Documento</th>
                <th className="text-right">Valor</th>
                <th className="w-[120px]">Tipo</th>
                <th className="w-[150px]">Modalidade</th>
                <th className="w-[110px]">Data</th>
                <th className="w-[260px]">Resumo da linha</th>
                <th className="w-[190px]">Status</th>
                <th className="w-[260px]">Alertas</th>
              </tr>
            </thead>
            <tbody>
              {visibleRecords.map((record) => {
                const status = duplicateStatus(record, duplicateMap);
                const linkedAlerts = recordAlerts(record, selectedAlerts);

                return (
                  <tr key={record.id}>
                    <td className="font-bold text-[var(--invest-heading)]">
                      {normalizeLabel(record.nome_credor_servidor)}
                    </td>
                    <td>{normalizeLabel(record.documento)}</td>
                    <td className="text-right invest-number font-bold">
                      {formatMoney(record.valor_bruto)}
                    </td>
                    <td>{normalizeLabel(rawValue(record, ["tipo_ato", "tipo"]))}</td>
                    <td>{normalizeLabel(rawValue(record, ["modalidade"]))}</td>
                    <td className="whitespace-nowrap">{primaryDate(record)}</td>
                    <td className="max-w-[260px] text-sm leading-5">
                      {shortSummary(record)}
                    </td>
                    <td>
                      <StatusPill tone={status.tone}>{status.label}</StatusPill>
                    </td>
                    <td>
                      {linkedAlerts.length > 0 ? (
                        <div className="flex flex-wrap gap-2">
                          {linkedAlerts.map((alert) => (
                            <Link
                              key={alert.id}
                              href={`/alerts/${alert.id}`}
                              className="app-chip border-[rgba(49,92,255,0.28)] bg-[#f2f5ff] text-[var(--invest-primary)]"
                              title={alert.title}
                            >
                              {alertNumbers.get(alert.id) || "Alerta"}:{" "}
                              {alert.title}
                            </Link>
                          ))}
                        </div>
                      ) : (
                        <span className="text-sm text-[var(--invest-muted)]">
                          Sem alerta vinculado
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}

              {visibleRecords.length === 0 && (
                <tr>
                  <td colSpan={9} className="text-center text-[var(--invest-muted)]">
                    Nenhuma linha encontrada para os filtros atuais.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-[var(--invest-muted)]">
          Página {currentPage + 1} de {pageCount}. Exibindo {visibleRecords.length} de {filteredRecords.length} linhas filtradas.
        </p>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setPage((current) => Math.max(0, current - 1))}
            disabled={currentPage === 0}
            className="invest-button-secondary px-4 py-2 text-sm disabled:opacity-50"
          >
            Anterior
          </button>
          <button
            type="button"
            onClick={() => setPage((current) => Math.min(pageCount - 1, current + 1))}
            disabled={currentPage >= pageCount - 1}
            className="invest-button-secondary px-4 py-2 text-sm disabled:opacity-50"
          >
            Próxima
          </button>
        </div>
      </div>
    </div>
  );
}
