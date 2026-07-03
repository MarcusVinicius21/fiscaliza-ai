"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { SkeletonBlock } from "@/components/app/skeleton-block";
import { StatusPill } from "@/components/app/status-pill";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8000";

type SortMode = "amount" | "records" | "alerts" | "name";

interface SupplierItem {
  id: string;
  canonical_name: string;
  document?: string | null;
  uploads_count: number;
  records_count: number;
  total_amount: number;
  alerts_count: number;
}

interface SuppliersPayload {
  suppliers?: SupplierItem[];
  items?: SupplierItem[];
}

interface SearchItem {
  id: string;
  entity_type: string;
  canonical_name: string;
  document?: string | null;
  uploads_count: number;
  records_count: number;
  total_amount: number;
}

interface SearchPayload {
  results?: Record<string, SearchItem[]>;
}

function formatMoney(value: number) {
  return value.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

function formatDocument(value?: string | null) {
  const digits = String(value || "").replace(/\D/g, "");
  if (digits.length === 14) {
    return digits.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, "$1.$2.$3/$4-$5");
  }
  if (digits.length === 11) {
    return digits.replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/, "$1.$2.$3-$4");
  }
  return value || "Sem documento";
}

function fromSearchItem(item: SearchItem): SupplierItem {
  return {
    id: item.id,
    canonical_name: item.canonical_name,
    document: item.document,
    uploads_count: item.uploads_count,
    records_count: item.records_count,
    total_amount: item.total_amount,
    alerts_count: 0,
  };
}

export default function SuppliersPage() {
  const [items, setItems] = useState<SupplierItem[]>([]);
  const [query, setQuery] = useState("");
  const [sortMode, setSortMode] = useState<SortMode>("amount");
  const [onlyWithAlerts, setOnlyWithAlerts] = useState(false);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");
  const [sourceLabel, setSourceLabel] = useState("Principais fornecedores");

  async function loadSuppliers(searchTerm = "") {
    setLoading(true);
    setErrorMessage("");

    try {
      if (searchTerm.trim()) {
        const params = new URLSearchParams({
          q: searchTerm.trim(),
          entity_type: "supplier",
          limit: "50",
        });
        const response = await fetch(`${API_BASE}/entities/search?${params.toString()}`);
        const payload = (await response.json().catch(() => null)) as SearchPayload | null;
        if (!response.ok) throw new Error("Não foi possível buscar fornecedores agora.");

        const suppliers = [
          ...(payload?.results?.supplier || []),
          ...(payload?.results?.organization || []),
        ].map(fromSearchItem);
        setItems(suppliers);
        setSourceLabel("Resultado da busca");
        return;
      }

      const response = await fetch(`${API_BASE}/suppliers?limit=50`);
      const payload = (await response.json().catch(() => null)) as SuppliersPayload | null;
      if (!response.ok) throw new Error("Não foi possível carregar os fornecedores agora.");

      setItems(payload?.suppliers || payload?.items || []);
      setSourceLabel("Principais fornecedores");
    } catch (error: unknown) {
      setItems([]);
      setErrorMessage(error instanceof Error ? error.message : "Não foi possível carregar os fornecedores agora.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadSuppliers();
  }, []);

  function submitSearch(event: FormEvent) {
    event.preventDefault();
    loadSuppliers(query);
  }

  const visibleItems = useMemo(() => {
    const filtered = onlyWithAlerts ? items.filter((item) => item.alerts_count > 0) : items;
    return [...filtered].sort((a, b) => {
      if (sortMode === "records") return b.records_count - a.records_count || b.total_amount - a.total_amount;
      if (sortMode === "alerts") return b.alerts_count - a.alerts_count || b.total_amount - a.total_amount;
      if (sortMode === "name") return a.canonical_name.localeCompare(b.canonical_name, "pt-BR");
      return b.total_amount - a.total_amount || b.records_count - a.records_count;
    });
  }, [items, onlyWithAlerts, sortMode]);

  return (
    <div className="page-shell">
      <section className="page-header px-5 py-5 sm:px-6">
        <p className="invest-eyebrow">Fornecedores</p>
        <div className="mt-3 max-w-3xl">
          <h1 className="invest-title text-2xl sm:text-[2rem]">
            Fornecedores encontrados
          </h1>
          <p className="invest-subtitle mt-3 text-sm sm:text-base">
            Veja quem aparece nos arquivos analisados, por valor, quantidade de linhas e alertas.
          </p>
        </div>
      </section>

      <section className="invest-card p-5 sm:p-6">
        <form onSubmit={submitSearch} className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_220px_170px_160px]">
          <div>
            <label className="invest-label" htmlFor="supplier-query">
              Nome ou documento
            </label>
            <input
              id="supplier-query"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              className="invest-input"
              placeholder="Ex.: distribuidora completa"
            />
          </div>

          <div>
            <label className="invest-label" htmlFor="supplier-sort">
              Ordenar por
            </label>
            <select
              id="supplier-sort"
              value={sortMode}
              onChange={(event) => setSortMode(event.target.value as SortMode)}
              className="invest-select"
            >
              <option value="amount">Maior valor</option>
              <option value="records">Mais linhas</option>
              <option value="alerts">Mais alertas</option>
              <option value="name">Nome</option>
            </select>
          </div>

          <label className="flex items-end gap-2 pb-3 text-sm font-bold text-[var(--invest-heading)]">
            <input
              type="checkbox"
              checked={onlyWithAlerts}
              onChange={(event) => setOnlyWithAlerts(event.target.checked)}
              className="h-4 w-4"
            />
            Com alerta
          </label>

          <div className="flex items-end">
            <button type="submit" className="invest-button w-full px-4">
              Buscar
            </button>
          </div>
        </form>
        <div className="mt-4 flex flex-wrap gap-2">
          <button
            type="button"
            className="invest-button-secondary px-4"
            onClick={() => {
              setQuery("");
              loadSuppliers();
            }}
          >
            Ver principais
          </button>
          <Link href="/search?type=supplier" className="invest-button-secondary px-4">
            Abrir busca
          </Link>
        </div>
      </section>

      {loading ? (
        <section className="invest-card p-5">
          <SkeletonBlock lines={5} />
        </section>
      ) : null}

      {!loading && errorMessage ? (
        <section className="invest-card p-5">
          <p className="text-sm font-bold text-[var(--invest-danger)]">{errorMessage}</p>
          <button type="button" className="invest-button-secondary mt-4 px-4" onClick={() => loadSuppliers(query)}>
            Tentar novamente
          </button>
        </section>
      ) : null}

      {!loading && !errorMessage ? (
        <section className="invest-card p-5 sm:p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="invest-section-title">{sourceLabel}</p>
              <p className="mt-1 text-sm text-[var(--invest-muted)]">
                Dados carregados pela API principal de fornecedores.
              </p>
            </div>
            <StatusPill tone="muted">{visibleItems.length} fornecedor(es)</StatusPill>
          </div>

          <div className="mt-4 grid gap-4 xl:grid-cols-2">
            {visibleItems.length === 0 ? (
              <p className="text-sm text-[var(--invest-muted)]">
                Nenhum fornecedor encontrado com os filtros atuais.
              </p>
            ) : (
              visibleItems.map((item) => (
                <article key={item.id} className="invest-card-highlight p-5">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-lg font-black text-[var(--invest-heading)]">
                        {item.canonical_name}
                      </p>
                      <p className="mt-1 text-sm text-[var(--invest-muted)]">
                        {formatDocument(item.document)}
                      </p>
                    </div>
                    <StatusPill tone={item.alerts_count > 0 ? "warning" : "info"}>
                      {item.alerts_count > 0 ? "com alerta" : "fornecedor"}
                    </StatusPill>
                  </div>
                  <div className="mt-4 grid gap-2 sm:grid-cols-4">
                    <span className="app-chip">{formatMoney(item.total_amount)}</span>
                    <span className="app-chip">{item.uploads_count} arquivo(s)</span>
                    <span className="app-chip">{item.records_count} linha(s)</span>
                    <span className="app-chip">{item.alerts_count} alerta(s)</span>
                  </div>
                  <div className="mt-5 flex flex-wrap gap-2">
                    <Link href={`/fornecedores/${item.id}`} className="invest-button inline-flex px-4">
                      Abrir histórico
                    </Link>
                    <Link href={`/relatorios/fornecedor/${item.id}`} className="invest-button-secondary inline-flex px-4">
                      Abrir relatório
                    </Link>
                  </div>
                </article>
              ))
            )}
          </div>
        </section>
      ) : null}
    </div>
  );
}
