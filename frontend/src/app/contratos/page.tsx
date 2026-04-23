"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { SkeletonBlock } from "@/components/app/skeleton-block";
import { StatusPill } from "@/components/app/status-pill";
import { ChainStatusBadge } from "@/components/facts/chain-status-badge";
import { safeDetail, safeNetworkMessage } from "@/lib/http-errors";
import { supabase } from "@/lib/supabase";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8000";

interface CityOption {
  id: string;
  name: string;
  state?: string | null;
}

interface UploadOption {
  id: string;
  file_name?: string | null;
  city_id?: string | null;
}

interface ContractItem {
  id: string;
  number?: string | null;
  raw_number?: string | null;
  supplier_name?: string | null;
  supplier_canonical_name?: string | null;
  city_name?: string | null;
  modality?: string | null;
  contract_value?: number | null;
  total_paid?: number | null;
  bid_link_status?: string | null;
}

interface ContractsPayload {
  status?: string;
  total?: number;
  items: ContractItem[];
}

const MODALITIES = [
  { value: "", label: "Todas" },
  { value: "pregao", label: "Pregão" },
  { value: "concorrencia", label: "Concorrência" },
  { value: "dispensa", label: "Dispensa" },
  { value: "inexigibilidade", label: "Inexigibilidade" },
  { value: "tomada_de_precos", label: "Tomada de preços" },
];

const LINK_STATUSES = [
  { value: "", label: "Todos" },
  { value: "linked_exact", label: "Vínculo factual" },
  { value: "linked_probable", label: "Vínculo provável" },
  { value: "unlinked", label: "Sem vínculo" },
];

function money(value: number | null | undefined): string {
  if (typeof value !== "number") return "—";
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export default function ContratosPage() {
  const [uploadId, setUploadId] = useState("");
  const [cityId, setCityId] = useState("");
  const [modality, setModality] = useState("");
  const [linkStatus, setLinkStatus] = useState("");

  const [cities, setCities] = useState<CityOption[]>([]);
  const [uploads, setUploads] = useState<UploadOption[]>([]);

  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");
  const [payload, setPayload] = useState<ContractsPayload | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function loadMeta() {
      const citiesRes = await supabase
        .from("cities")
        .select("id, name, state")
        .order("name");
      const uploadsRes = await supabase
        .from("uploads")
        .select("id, file_name, city_id")
        .order("created_at", { ascending: false })
        .limit(80);
      if (!cancelled) {
        setCities((citiesRes.data || []) as CityOption[]);
        setUploads((uploadsRes.data || []) as UploadOption[]);
      }
    }
    loadMeta();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setErrorMessage("");
      try {
        const params = new URLSearchParams({ page: "1", page_size: "20" });
        if (uploadId) params.set("upload_id", uploadId);
        if (cityId) params.set("city_id", cityId);
        if (modality) params.set("modality", modality);
        if (linkStatus) params.set("bid_link_status", linkStatus);

        const response = await fetch(`${API_BASE}/contracts?${params.toString()}`);
        const data = (await response.json().catch(() => null)) as ContractsPayload | null;
        if (!response.ok) {
          throw new Error(
            safeDetail(
              data,
              "Não foi possível carregar os contratos agora. Tente novamente em instantes.",
            ),
          );
        }
        if (!cancelled) setPayload(data);
      } catch (error: unknown) {
        if (!cancelled) {
          setErrorMessage(
            safeNetworkMessage(
              error,
              "Não foi possível carregar os contratos agora. Tente novamente em instantes.",
            ),
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [uploadId, cityId, modality, linkStatus]);

  const items = payload?.items || [];

  return (
    <div className="page-shell">
      <section className="page-header px-5 py-5 sm:px-6">
        <p className="invest-eyebrow">Cadeia do gasto</p>
        <div className="mt-3 max-w-3xl">
          <h1 className="invest-title text-2xl sm:text-[2rem]">Contratos</h1>
          <p className="invest-subtitle mt-3 text-sm sm:text-base">
            Explore contratos consolidados com sua licitação de origem e pagamentos executados. Vínculos factuais privilegiam número e processo; vínculos prováveis ainda exigem checagem humana.
          </p>
        </div>
      </section>

      <section className="invest-card p-5 sm:p-6">
        <div className="grid gap-4 lg:grid-cols-4">
          <div>
            <label className="invest-label" htmlFor="contracts-upload">Upload</label>
            <select
              id="contracts-upload"
              className="invest-select"
              value={uploadId}
              onChange={(e) => setUploadId(e.target.value)}
            >
              <option value="">Todos</option>
              {uploads.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.file_name || u.id.slice(0, 8)}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="invest-label" htmlFor="contracts-city">Cidade</label>
            <select
              id="contracts-city"
              className="invest-select"
              value={cityId}
              onChange={(e) => setCityId(e.target.value)}
            >
              <option value="">Todas</option>
              {cities.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                  {c.state ? `/${c.state}` : ""}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="invest-label" htmlFor="contracts-modality">Modalidade</label>
            <select
              id="contracts-modality"
              className="invest-select"
              value={modality}
              onChange={(e) => setModality(e.target.value)}
            >
              {MODALITIES.map((m) => (
                <option key={m.value} value={m.value}>
                  {m.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="invest-label" htmlFor="contracts-link">Vínculo com licitação</label>
            <select
              id="contracts-link"
              className="invest-select"
              value={linkStatus}
              onChange={(e) => setLinkStatus(e.target.value)}
            >
              {LINK_STATUSES.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </select>
          </div>
        </div>
      </section>

      <section className="invest-card p-5 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="invest-section-title">Contratos encontrados</p>
            <p className="mt-1 text-sm text-[var(--invest-muted)]">
              {payload?.total ?? items.length} resultado(s) com os filtros atuais.
            </p>
          </div>
          <StatusPill tone="muted">{items.length} item(ns)</StatusPill>
        </div>

        <div className="mt-4">
          {loading ? (
            <SkeletonBlock lines={6} />
          ) : errorMessage ? (
            <p className="text-sm font-bold text-[var(--invest-danger)]">{errorMessage}</p>
          ) : items.length === 0 ? (
            <p className="text-sm text-[var(--invest-muted)]">
              Nenhum contrato encontrado com os filtros atuais. Amplie a busca ou confirme se o upload correto foi selecionado.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-sm">
                <thead>
                  <tr className="text-left text-xs font-black uppercase tracking-[0.12em] text-[var(--invest-faint)]">
                    <th className="border-b border-[var(--invest-border)] py-2 pr-3">Número</th>
                    <th className="border-b border-[var(--invest-border)] py-2 pr-3">Fornecedor</th>
                    <th className="border-b border-[var(--invest-border)] py-2 pr-3">Cidade</th>
                    <th className="border-b border-[var(--invest-border)] py-2 pr-3">Modalidade</th>
                    <th className="border-b border-[var(--invest-border)] py-2 pr-3">Contratado</th>
                    <th className="border-b border-[var(--invest-border)] py-2 pr-3">Pago</th>
                    <th className="border-b border-[var(--invest-border)] py-2 pr-3">Gap</th>
                    <th className="border-b border-[var(--invest-border)] py-2 pr-3">Vínculo</th>
                    <th className="border-b border-[var(--invest-border)] py-2">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item) => {
                    const contractValue = typeof item.contract_value === "number" ? item.contract_value : 0;
                    const paid = typeof item.total_paid === "number" ? item.total_paid : 0;
                    const gap = paid - contractValue;
                    const overPaid = gap > 0 && contractValue > 0;
                    return (
                      <tr key={item.id} className="align-top">
                        <td className="border-b border-[var(--invest-border)] py-2 pr-3 font-mono text-xs text-[var(--invest-heading)]">
                          {item.raw_number || item.number || item.id.slice(0, 8)}
                        </td>
                        <td className="border-b border-[var(--invest-border)] py-2 pr-3 text-[var(--invest-heading)]">
                          {item.supplier_canonical_name || item.supplier_name || "—"}
                        </td>
                        <td className="border-b border-[var(--invest-border)] py-2 pr-3 text-[var(--invest-muted)]">
                          {item.city_name || "—"}
                        </td>
                        <td className="border-b border-[var(--invest-border)] py-2 pr-3 text-[var(--invest-muted)]">
                          {item.modality || "—"}
                        </td>
                        <td className="border-b border-[var(--invest-border)] py-2 pr-3 text-[var(--invest-heading)]">
                          {money(item.contract_value)}
                        </td>
                        <td className="border-b border-[var(--invest-border)] py-2 pr-3 text-[var(--invest-heading)]">
                          {money(item.total_paid)}
                        </td>
                        <td
                          className="border-b border-[var(--invest-border)] py-2 pr-3 font-bold"
                          style={{ color: overPaid ? "var(--invest-danger)" : "var(--invest-muted)" }}
                        >
                          {money(gap)}
                        </td>
                        <td className="border-b border-[var(--invest-border)] py-2 pr-3">
                          <ChainStatusBadge status={item.bid_link_status || "unlinked"} />
                        </td>
                        <td className="border-b border-[var(--invest-border)] py-2">
                          <Link href={`/contratos/${item.id}`} className="invest-button inline-flex px-3 py-1 text-xs">
                            Abrir contrato
                          </Link>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
