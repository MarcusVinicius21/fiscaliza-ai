"use client";

import { FormEvent, useEffect, useState } from "react";
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
}

interface PaymentItem {
  id: string;
  number?: string | null;
  raw_number?: string | null;
  supplier_canonical_name?: string | null;
  supplier_name?: string | null;
  amount?: number | null;
  paid_at?: string | null;
  contract_fact_id?: string | null;
  contract_link_status?: string | null;
  contract_raw_number?: string | null;
}

interface PaymentsPayload {
  status?: string;
  total?: number;
  items: PaymentItem[];
}

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

export default function PagamentosPage() {
  const [uploadId, setUploadId] = useState("");
  const [cityId, setCityId] = useState("");
  const [supplierInput, setSupplierInput] = useState("");
  const [supplierQuery, setSupplierQuery] = useState("");
  const [linkStatus, setLinkStatus] = useState("");

  const [cities, setCities] = useState<CityOption[]>([]);
  const [uploads, setUploads] = useState<UploadOption[]>([]);

  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");
  const [payload, setPayload] = useState<PaymentsPayload | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function loadMeta() {
      const citiesRes = await supabase.from("cities").select("id, name, state").order("name");
      const uploadsRes = await supabase
        .from("uploads")
        .select("id, file_name")
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
        if (supplierQuery) params.set("supplier", supplierQuery);
        if (linkStatus) params.set("contract_link_status", linkStatus);

        const response = await fetch(`${API_BASE}/payments?${params.toString()}`);
        const data = (await response.json().catch(() => null)) as PaymentsPayload | null;
        if (!response.ok) {
          throw new Error(
            safeDetail(
              data,
              "Não foi possível carregar os pagamentos agora. Tente novamente em instantes.",
            ),
          );
        }
        if (!cancelled) setPayload(data);
      } catch (error: unknown) {
        if (!cancelled) {
          setErrorMessage(
            safeNetworkMessage(
              error,
              "Não foi possível carregar os pagamentos agora. Tente novamente em instantes.",
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
  }, [uploadId, cityId, supplierQuery, linkStatus]);

  const items = payload?.items || [];

  function applySupplier(event?: FormEvent) {
    event?.preventDefault();
    setSupplierQuery(supplierInput.trim());
  }

  return (
    <div className="page-shell">
      <section className="page-header px-5 py-5 sm:px-6">
        <p className="invest-eyebrow">Cadeia do gasto</p>
        <div className="mt-3 max-w-3xl">
          <h1 className="invest-title text-2xl sm:text-[2rem]">Pagamentos</h1>
          <p className="invest-subtitle mt-3 text-sm sm:text-base">
            Execução financeira com vínculo factual a contratos. Pagamentos sem cobertura contratual pedem explicação humana.
          </p>
        </div>
      </section>

      <section className="invest-card p-5 sm:p-6">
        <div className="grid gap-4 lg:grid-cols-4">
          <div>
            <label className="invest-label" htmlFor="payments-upload">Upload</label>
            <select
              id="payments-upload"
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
            <label className="invest-label" htmlFor="payments-city">Cidade</label>
            <select
              id="payments-city"
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
            <label className="invest-label" htmlFor="payments-link">Vínculo com contrato</label>
            <select
              id="payments-link"
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
          <form onSubmit={applySupplier}>
            <label className="invest-label" htmlFor="payments-supplier">Fornecedor</label>
            <div className="flex gap-2">
              <input
                id="payments-supplier"
                className="invest-input"
                placeholder="Nome ou alias"
                value={supplierInput}
                onChange={(e) => setSupplierInput(e.target.value)}
              />
              <button type="submit" className="invest-button px-3 text-xs">Aplicar</button>
            </div>
          </form>
        </div>
      </section>

      <section className="invest-card p-5 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="invest-section-title">Pagamentos encontrados</p>
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
              Nenhum pagamento encontrado com os filtros atuais. Amplie a busca ou confirme se o upload correto foi selecionado.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-sm">
                <thead>
                  <tr className="text-left text-xs font-black uppercase tracking-[0.12em] text-[var(--invest-faint)]">
                    <th className="border-b border-[var(--invest-border)] py-2 pr-3">Número</th>
                    <th className="border-b border-[var(--invest-border)] py-2 pr-3">Fornecedor</th>
                    <th className="border-b border-[var(--invest-border)] py-2 pr-3">Valor</th>
                    <th className="border-b border-[var(--invest-border)] py-2 pr-3">Data</th>
                    <th className="border-b border-[var(--invest-border)] py-2 pr-3">Contrato</th>
                    <th className="border-b border-[var(--invest-border)] py-2 pr-3">Vínculo</th>
                    <th className="border-b border-[var(--invest-border)] py-2">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item) => (
                    <tr key={item.id}>
                      <td className="border-b border-[var(--invest-border)] py-2 pr-3 font-mono text-xs text-[var(--invest-heading)]">
                        {item.raw_number || item.number || item.id.slice(0, 8)}
                      </td>
                      <td className="border-b border-[var(--invest-border)] py-2 pr-3 text-[var(--invest-heading)]">
                        {item.supplier_canonical_name || item.supplier_name || "—"}
                      </td>
                      <td className="border-b border-[var(--invest-border)] py-2 pr-3 text-[var(--invest-heading)]">
                        {money(item.amount)}
                      </td>
                      <td className="border-b border-[var(--invest-border)] py-2 pr-3 text-[var(--invest-muted)]">
                        {item.paid_at || "—"}
                      </td>
                      <td className="border-b border-[var(--invest-border)] py-2 pr-3">
                        {item.contract_fact_id ? (
                          <Link
                            href={`/contratos/${item.contract_fact_id}`}
                            className="font-mono text-xs text-[var(--invest-primary)] underline"
                          >
                            {item.contract_raw_number || item.contract_fact_id.slice(0, 8)}
                          </Link>
                        ) : (
                          <span className="text-xs text-[var(--invest-muted)]">Sem vínculo</span>
                        )}
                      </td>
                      <td className="border-b border-[var(--invest-border)] py-2 pr-3">
                        <ChainStatusBadge status={item.contract_link_status || "unlinked"} />
                      </td>
                      <td className="border-b border-[var(--invest-border)] py-2">
                        <Link href={`/pagamentos/${item.id}`} className="invest-button inline-flex px-3 py-1 text-xs">
                          Abrir
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
