import { supabase } from "@/lib/supabase";

export interface SupplierRank {
  id?: string | null;
  name: string;
  document?: string | null;
  amount: number;
  count: number;
}

export interface UploadDiagnostic {
  upload: {
    id: string;
    file_name?: string | null;
    category?: string | null;
    report_type?: string | null;
    report_label?: string | null;
    status?: string | null;
    analysis_status?: string | null;
    created_at?: string | null;
    city_name?: string | null;
    state?: string | null;
  };
  summary: {
    records_count: number;
    total_amount: number;
    alerts_count: number;
  };
  suppliers_by_amount: SupplierRank[];
  suppliers_by_count: SupplierRank[];
  link_status: {
    contracts: { total: number; unlinked: number };
    payments: { total: number; unlinked: number };
    bids: { total: number; unlinked: number };
  };
  quality: {
    has_contract_keys: boolean;
    has_bid_keys: boolean;
    has_process_keys: boolean;
    has_object_text: boolean;
    records_with_any_link_key: number;
  };
  support_records: Array<{
    id: string;
    file_name?: string | null;
    category?: string | null;
    date?: string | null;
    amount: number;
    supplier?: string | null;
    summary?: string | null;
  }>;
  attention_points: Array<{ title: string; body: string }>;
}

type RawMap = Record<string, unknown>;

interface UploadRow {
  id: string;
  file_name?: string | null;
  category?: string | null;
  report_type?: string | null;
  report_label?: string | null;
  status?: string | null;
  analysis_status?: string | null;
  created_at?: string | null;
  cities?: { name?: string | null; state?: string | null } | Array<{ name?: string | null; state?: string | null }> | null;
}

interface StandardizedRecordRow {
  id: string;
  category?: string | null;
  report_type?: string | null;
  nome_credor_servidor?: string | null;
  documento?: string | null;
  valor_bruto?: unknown;
  raw_json?: unknown;
}

interface ContractFactRow {
  id: string;
  contract_value?: unknown;
  supplier_entity_id?: string | null;
  bid_link_status?: string | null;
  bid_fact_id?: string | null;
  bid_number_raw?: string | null;
  process_number_raw?: string | null;
  object_text?: string | null;
}

interface PaymentFactRow {
  id: string;
  payment_value?: unknown;
  supplier_entity_id?: string | null;
  contract_link_status?: string | null;
  contract_fact_id?: string | null;
  contract_number_raw?: string | null;
  bid_number_raw?: string | null;
  process_number_raw?: string | null;
  object_text?: string | null;
}

interface BidFactRow {
  id: string;
  estimated_value?: unknown;
  awarded_value?: unknown;
  winner_entity_id?: string | null;
}

function asArray<T>(value: T[] | null | undefined): T[] {
  return Array.isArray(value) ? value : [];
}

export function parseMoney(value: unknown): number {
  if (value === null || value === undefined || value === "") return 0;
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  if (typeof value === "boolean") return 0;

  let text = String(value).replace("R$", "").replace("\u00a0", " ").trim();
  text = text.replace(/[^\d,.-]/g, "");
  if (!text || text === "-" || text === "." || text === ",") return 0;

  const hasComma = text.includes(",");
  const hasDot = text.includes(".");

  if (hasComma && hasDot) {
    text = text.lastIndexOf(",") > text.lastIndexOf(".")
      ? text.replace(/\./g, "").replace(",", ".")
      : text.replace(/,/g, "");
  } else if (hasComma) {
    text = text.replace(",", ".");
  } else if (hasDot) {
    const parts = text.split(".");
    if (parts.length > 2 && parts.slice(1).every((part) => part.length === 3)) {
      text = text.replace(/\./g, "");
    }
  }

  const parsed = Number(text);
  return Number.isFinite(parsed) ? parsed : 0;
}

function rawValue(row: { raw_json?: unknown }, keys: string[]) {
  const raw = row.raw_json as RawMap | null;
  if (!raw || typeof raw !== "object") return "";
  for (const key of keys) {
    const value = raw[key];
    if (String(value || "").trim()) return String(value).trim();
  }
  return "";
}

function supplierName(row: { nome_credor_servidor?: string | null; raw_json?: unknown }) {
  return (
    row.nome_credor_servidor ||
    rawValue(row, ["fornecedor", "credor", "nome_credor", "nome_fornecedor", "razao_social"]) ||
    "Fornecedor não informado"
  );
}

function supplierDocument(row: { documento?: string | null; raw_json?: unknown }) {
  return row.documento || rawValue(row, ["cnpj", "cpf", "documento", "cpf_cnpj"]) || null;
}

function buildRankings(records: Array<{ nome_credor_servidor?: string | null; documento?: string | null; valor_bruto?: unknown; raw_json?: unknown }>) {
  const grouped = new Map<string, SupplierRank>();
  for (const record of records) {
    const name = supplierName(record);
    const document = supplierDocument(record);
    const key = `${name}|${document || ""}`;
    const current = grouped.get(key) || { name, document, amount: 0, count: 0 };
    current.amount += parseMoney(record.valor_bruto || rawValue(record, ["valor_pago", "valor", "valor_contrato", "valor_contratado"]));
    current.count += 1;
    grouped.set(key, current);
  }
  const items = Array.from(grouped.values());
  return {
    byAmount: [...items].sort((a, b) => b.amount - a.amount).slice(0, 6),
    byCount: [...items].sort((a, b) => b.count - a.count || b.amount - a.amount).slice(0, 6),
  };
}

function hasAnyKey(record: { raw_json?: unknown }, keys: string[]) {
  return Boolean(rawValue(record, keys));
}

export async function fetchUploadDiagnostic(uploadId: string): Promise<UploadDiagnostic> {
  const uploadRes = await supabase
    .from("uploads")
    .select("id, file_name, category, report_type, report_label, status, analysis_status, created_at, cities(name, state)")
    .eq("id", uploadId)
    .maybeSingle();

  if (uploadRes.error) throw new Error(uploadRes.error.message);
  if (!uploadRes.data) throw new Error("Arquivo não encontrado.");

  const uploadRow = uploadRes.data as UploadRow;
  const city = Array.isArray(uploadRow.cities) ? uploadRow.cities[0] : uploadRow.cities;

  const [recordsRes, alertsRes, contractsRes, paymentsRes, bidsRes] = await Promise.all([
    supabase
      .from("standardized_records")
      .select("id, category, report_type, nome_credor_servidor, documento, valor_bruto, raw_json")
      .eq("upload_id", uploadId)
      .limit(5000),
    supabase
      .from("alerts")
      .select("id, title, severity, amount, supplier_name")
      .eq("upload_id", uploadId)
      .limit(1000),
    supabase
      .from("contracts_facts")
      .select("id, contract_value, supplier_entity_id, bid_link_status, bid_fact_id, bid_number_raw, process_number_raw, object_text")
      .eq("source_upload_id", uploadId)
      .limit(5000),
    supabase
      .from("payments_facts")
      .select("id, payment_value, supplier_entity_id, contract_link_status, contract_fact_id, contract_number_raw, bid_number_raw, process_number_raw, object_text")
      .eq("source_upload_id", uploadId)
      .limit(5000),
    supabase
      .from("bids_facts")
      .select("id, estimated_value, awarded_value, winner_entity_id")
      .eq("source_upload_id", uploadId)
      .limit(5000),
  ]);

  for (const result of [recordsRes, alertsRes, contractsRes, paymentsRes, bidsRes]) {
    if (result.error) throw new Error(result.error.message);
  }

  const records = asArray(recordsRes.data as StandardizedRecordRow[] | null);
  const alerts = asArray(alertsRes.data as Array<{ id: string }> | null);
  const contracts = asArray(contractsRes.data as ContractFactRow[] | null);
  const payments = asArray(paymentsRes.data as PaymentFactRow[] | null);
  const bids = asArray(bidsRes.data as BidFactRow[] | null);

  const totalAmountFromFacts =
    contracts.reduce((sum, item) => sum + parseMoney(item.contract_value), 0) +
    payments.reduce((sum, item) => sum + parseMoney(item.payment_value), 0) +
    bids.reduce((sum, item) => sum + parseMoney(item.awarded_value || item.estimated_value), 0);
  const totalAmountFromRecords = records.reduce(
    (sum, item) => sum + parseMoney(item.valor_bruto || rawValue(item, ["valor_pago", "valor", "valor_contrato", "valor_contratado"])),
    0,
  );

  const rankings = buildRankings(records);
  const supportRecords = records.slice(0, 12).map((record) => ({
    id: record.id,
    file_name: uploadRow.file_name,
    category: record.category || uploadRow.category,
    date: rawValue(record, ["data", "data_pagamento", "data_contrato", "competencia"]),
    amount: parseMoney(record.valor_bruto || rawValue(record, ["valor_pago", "valor", "valor_contrato", "valor_contratado"])),
    supplier: supplierName(record),
    summary: rawValue(record, ["objeto", "descricao", "historico", "observacao", "detalhamento"]),
  }));
  const linkKeyGroups = {
    contract: ["numero_contrato", "contrato", "contract_number"],
    bid: ["numero_licitacao", "licitacao", "bid_number"],
    process: ["numero_processo", "processo", "process_number"],
    object: ["objeto", "descricao", "historico", "object_text"],
  };
  const keyPresence = records.reduce(
    (acc, record) => {
      const hasContract = hasAnyKey(record, linkKeyGroups.contract);
      const hasBid = hasAnyKey(record, linkKeyGroups.bid);
      const hasProcess = hasAnyKey(record, linkKeyGroups.process);
      const hasObject = hasAnyKey(record, linkKeyGroups.object);
      acc.contract += hasContract ? 1 : 0;
      acc.bid += hasBid ? 1 : 0;
      acc.process += hasProcess ? 1 : 0;
      acc.object += hasObject ? 1 : 0;
      acc.any += hasContract || hasBid || hasProcess || hasObject ? 1 : 0;
      return acc;
    },
    { contract: 0, bid: 0, process: 0, object: 0, any: 0 },
  );

  const contractsUnlinked = contracts.filter((item) => (item.bid_link_status || "unlinked") === "unlinked").length;
  const paymentsUnlinked = payments.filter((item) => (item.contract_link_status || "unlinked") === "unlinked").length;
  const attentionPoints: UploadDiagnostic["attention_points"] = [];

  if (keyPresence.any === 0 || paymentsUnlinked > 0 || contractsUnlinked > 0) {
    attentionPoints.push({
      title: "Faltam chaves no arquivo",
      body: "Este arquivo não trouxe número de contrato, licitação, processo ou objeto suficiente para ligação automática em parte do acervo.",
    });
  }
  if (bids.length === 0) {
    attentionPoints.push({
      title: "Licitações não carregadas neste recorte",
      body: "Não há licitações carregadas para este arquivo. As ligações ausentes devem ser lidas como limitação do acervo atual.",
    });
  }
  if (rankings.byAmount[0] && rankings.byAmount[0].amount > 0) {
    attentionPoints.push({
      title: "Concentração por fornecedor",
      body: "Os maiores valores por fornecedor são pontos de atenção para priorizar análise humana e conferência documental.",
    });
  }
  if (alerts.length > 0) {
    attentionPoints.push({
      title: "Alertas relacionados",
      body: "Há alertas associados ao arquivo. Eles indicam necessidade de revisão, não conclusão automática.",
    });
  }

  return {
    upload: {
      id: String(uploadRow.id),
      file_name: uploadRow.file_name,
      category: uploadRow.category,
      report_type: uploadRow.report_type,
      report_label: uploadRow.report_label,
      status: uploadRow.status,
      analysis_status: uploadRow.analysis_status,
      created_at: uploadRow.created_at,
      city_name: city?.name,
      state: city?.state,
    },
    summary: {
      records_count: records.length,
      total_amount: Math.round((totalAmountFromFacts || totalAmountFromRecords) * 100) / 100,
      alerts_count: alerts.length,
    },
    suppliers_by_amount: rankings.byAmount,
    suppliers_by_count: rankings.byCount,
    link_status: {
      contracts: { total: contracts.length, unlinked: contractsUnlinked },
      payments: { total: payments.length, unlinked: paymentsUnlinked },
      bids: { total: bids.length, unlinked: 0 },
    },
    quality: {
      has_contract_keys: keyPresence.contract > 0 || contracts.some((item) => item.bid_number_raw || item.process_number_raw),
      has_bid_keys: keyPresence.bid > 0 || payments.some((item) => item.bid_number_raw),
      has_process_keys: keyPresence.process > 0 || payments.some((item) => item.process_number_raw),
      has_object_text: keyPresence.object > 0 || contracts.some((item) => item.object_text) || payments.some((item) => item.object_text),
      records_with_any_link_key: keyPresence.any,
    },
    support_records: supportRecords,
    attention_points: attentionPoints,
  };
}
