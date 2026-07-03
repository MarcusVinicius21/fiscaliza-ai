"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { SkeletonBlock } from "@/components/app/skeleton-block";
import { StatusPill } from "@/components/app/status-pill";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8000";

type EntityType = "all" | "supplier" | "organization" | "person" | "server" | "other";

interface SearchItem {
  id: string;
  entity_type: string;
  canonical_name: string;
  document?: string | null;
  aliases: string[];
  uploads_count: number;
  records_count: number;
  total_amount: number;
  roles_observed?: string[];
  cross_reference_counts?: {
    total: number;
    role_conflict: number;
    same_person_candidate: number;
    homonym_candidate: number;
  };
}

interface SearchPayload {
  status: string;
  query: string;
  results: Record<string, SearchItem[]>;
  counts: Record<string, number>;
}

interface SupplierDirectoryItem {
  id: string;
  canonical_name: string;
  document?: string | null;
  uploads_count: number;
  records_count: number;
  total_amount: number;
  alerts_count: number;
}

interface SupplierDirectoryPayload {
  status: string;
  count?: number;
  suppliers?: SupplierDirectoryItem[];
  total?: number;
  items?: SupplierDirectoryItem[];
}

const FILTERS: Array<{ value: EntityType; label: string }> = [
  { value: "all", label: "Todos" },
  { value: "supplier", label: "Fornecedores" },
  { value: "organization", label: "Organização" },
  { value: "person", label: "Pessoa" },
  { value: "server", label: "Servidor" },
];

const GROUP_LABELS: Record<string, string> = {
  supplier: "Fornecedores",
  organization: "Organizações",
  person: "Pessoas",
  server: "Servidores",
  other: "Outros",
};

const ROLE_LABELS: Record<string, string> = {
  supplier: "fornecedor",
  creditor: "credor",
  contracted_party: "contratado",
  beneficiary: "beneficiário",
  server: "servidor",
  person: "pessoa",
  other: "outro",
};

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

function supplierFromSearchItem(item: SearchItem): SupplierDirectoryItem {
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

export default function SearchPage() {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<EntityType>("all");
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [payload, setPayload] = useState<SearchPayload | null>(null);
  const [hasSearched, setHasSearched] = useState(false);
  const [supplierDirectory, setSupplierDirectory] = useState<SupplierDirectoryItem[]>([]);
  const [directoryMode, setDirectoryMode] = useState(false);

  async function loadSupplierDirectory() {
    setLoading(true);
    setErrorMessage("");
    setPayload(null);
    setHasSearched(true);
    setDirectoryMode(true);

    try {
      const response = await fetch(`${API_BASE}/suppliers?limit=12`);
      const data = (await response.json().catch(() => null)) as SupplierDirectoryPayload | null;

      if (!response.ok) {
        throw new Error("Não foi possível carregar os fornecedores agora.");
      }

      const suppliers = data?.suppliers || data?.items || [];
      setSupplierDirectory(
        suppliers
          .filter((item) => item.records_count > 0 || item.total_amount > 0 || item.alerts_count > 0)
          .sort((a, b) => b.total_amount - a.total_amount || b.records_count - a.records_count),
      );
    } catch (error: unknown) {
      setSupplierDirectory([]);
      setErrorMessage(error instanceof Error ? error.message : "Não foi possível carregar os fornecedores agora.");
    } finally {
      setLoading(false);
    }
  }

  async function handleSearch(event?: FormEvent) {
    event?.preventDefault();
    const trimmed = query.trim();
    if (!trimmed && (filter === "supplier" || filter === "organization")) {
      await loadSupplierDirectory();
      return;
    }
    if (!trimmed) return;

    setLoading(true);
    setErrorMessage("");
    setHasSearched(true);
    setDirectoryMode(false);
    setSupplierDirectory([]);

    try {
      const params = new URLSearchParams({
        q: trimmed,
        entity_type: filter,
        limit: "20",
      });
      const response = await fetch(`${API_BASE}/entities/search?${params.toString()}`);
      const data = (await response.json().catch(() => null)) as SearchPayload | { detail?: string } | null;

      if (!response.ok) {
        throw new Error((data as { detail?: string } | null)?.detail || "Não foi possível buscar agora.");
      }

      setPayload(data as SearchPayload);
    } catch (error: unknown) {
      setPayload(null);
      setErrorMessage(error instanceof Error ? error.message : "Não foi possível buscar agora.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const initialType = params.get("type") || params.get("entity_type");
    const initialQuery = params.get("q") || "";

    if (initialQuery) {
      setQuery(initialQuery);
    }
    if (initialType === "supplier" || initialType === "organization") {
      setFilter(initialType);
      if (!initialQuery) {
        loadSupplierDirectory();
      }
    }
  }, []);

  const groups = useMemo(() => {
    const source = payload?.results || {};
    return Object.entries(source).filter(([, items]) => Array.isArray(items) && items.length > 0);
  }, [payload]);

  const supplierSearchResults = useMemo(() => {
    if (!payload?.results) return [];
    return [
      ...(payload.results.supplier || []),
      ...(payload.results.organization || []),
    ].map(supplierFromSearchItem);
  }, [payload]);

  const retry = () => {
    if (directoryMode || filter === "supplier" || filter === "organization") {
      loadSupplierDirectory();
    } else {
      handleSearch();
    }
  };

  return (
    <div className="page-shell">
      <section className="page-header px-5 py-5 sm:px-6">
        <p className="invest-eyebrow">Busca</p>
        <div className="mt-3 max-w-3xl">
          <h1 className="invest-title text-2xl sm:text-[2rem]">
            Buscar fornecedor, pessoa ou documento
          </h1>
          <p className="invest-subtitle mt-3 text-sm sm:text-base">
            Procure por nome principal, nome encontrado no arquivo ou documento (CPF / CNPJ).
          </p>
        </div>
      </section>

      <section className="invest-card p-5 sm:p-6">
        <form
          onSubmit={handleSearch}
          className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_220px_160px]"
        >
          <div>
            <label className="invest-label" htmlFor="search-query">
              Termo de busca
            </label>
            <input
              id="search-query"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              className="invest-input"
              placeholder="Ex.: distribuidora completa, rafael cornelio, 12345678000199"
            />
            <p className="invest-helper">
              A busca olha nome principal, nomes encontrados no arquivo e documento.
            </p>
          </div>

          <div>
            <label className="invest-label" htmlFor="search-filter">
              Tipo
            </label>
            <select
              id="search-filter"
              value={filter}
              onChange={(event) => {
                const nextFilter = event.target.value as EntityType;
                setFilter(nextFilter);
                if ((nextFilter === "supplier" || nextFilter === "organization") && !query.trim()) {
                  loadSupplierDirectory();
                }
              }}
              className="invest-select"
            >
              {FILTERS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-end">
            <button type="submit" className="invest-button w-full px-4">
              {loading ? "Buscando..." : "Buscar"}
            </button>
          </div>
        </form>
        <div className="mt-4 flex flex-wrap gap-2">
          <button
            type="button"
            className="invest-button-secondary px-4 py-2 text-sm"
            onClick={() => {
              setFilter("supplier");
              setQuery("");
              loadSupplierDirectory();
            }}
          >
            Principais fornecedores
          </button>
          <Link href="/fornecedores" className="invest-button-secondary px-4 py-2 text-sm">
            Ver todos os fornecedores
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
          <button type="button" className="invest-button-secondary mt-4 px-4" onClick={retry}>
            Tentar novamente
          </button>
        </section>
      ) : null}

      {!loading && !hasSearched ? (
        <section className="invest-card p-5">
          <p className="text-sm font-bold text-[var(--invest-heading)]">
            Nenhuma busca iniciada
          </p>
          <p className="mt-2 text-sm leading-6 text-[var(--invest-muted)]">
            Comece digitando um fornecedor, uma pessoa, um nome visto no arquivo ou um documento.
          </p>
        </section>
      ) : null}

      {!loading && directoryMode && !errorMessage ? (
        <SupplierCardsSection
          title="Principais fornecedores"
          description="Fornecedores encontrados nos arquivos já analisados, ordenados por valor total encontrado."
          suppliers={supplierDirectory}
        />
      ) : null}

      {!loading && hasSearched && !directoryMode && !errorMessage && groups.length === 0 ? (
        <section className="invest-card p-5">
          <p className="text-sm font-bold text-[var(--invest-heading)]">
            Nenhum resultado encontrado
          </p>
          <p className="mt-2 text-sm leading-6 text-[var(--invest-muted)]">
            Tente outra grafia, um nome encontrado no arquivo ou o documento sem pontuação.
          </p>
        </section>
      ) : null}

      {!loading && !directoryMode && supplierSearchResults.length > 0 ? (
        <SupplierCardsSection
          title="Fornecedores encontrados"
          description="Resultado da busca usando a API principal do Fiscaliza.AI."
          suppliers={supplierSearchResults}
        />
      ) : null}

      {!loading && !directoryMode && groups.length > 0 ? (
        <div className="space-y-5">
          {groups.map(([groupKey, items]) => (
            <section key={groupKey} className="invest-card p-5 sm:p-6">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="invest-section-title">{GROUP_LABELS[groupKey] || groupKey}</p>
                  <p className="mt-1 text-sm text-[var(--invest-muted)]">
                    {items.length} resultado(s) nesta categoria.
                  </p>
                </div>
                <StatusPill tone="muted">{payload?.counts?.[groupKey] || items.length}</StatusPill>
              </div>

              <div className="mt-4 grid gap-4 lg:grid-cols-2">
                {items.map((item) => {
                  const isSupplier = item.entity_type === "supplier" || item.entity_type === "organization";
                  const isPerson = item.entity_type === "person" || item.entity_type === "server";
                  const href = isSupplier
                    ? `/fornecedores/${item.id}`
                    : isPerson
                      ? `/pessoas/${item.id}`
                      : "";

                  return (
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
                        <StatusPill tone={isSupplier ? "info" : isPerson ? "warning" : "muted"}>
                          {GROUP_LABELS[item.entity_type] || item.entity_type}
                        </StatusPill>
                      </div>

                      <div className="mt-4 flex flex-wrap gap-2">
                        <span className="app-chip">{item.uploads_count} arquivo(s)</span>
                        <span className="app-chip">{item.records_count} linha(s)</span>
                        <span className="app-chip">{formatMoney(item.total_amount)}</span>
                        {(item.cross_reference_counts?.role_conflict || 0) > 0 ? (
                          <StatusPill tone="warning">
                            {item.cross_reference_counts?.role_conflict} ponto(s) para conferir
                          </StatusPill>
                        ) : null}
                      </div>

                      {item.roles_observed && item.roles_observed.length > 0 ? (
                        <div className="mt-4">
                          <p className="text-xs font-black uppercase tracking-[0.12em] text-[var(--invest-faint)]">
                            Como aparece
                          </p>
                          <div className="mt-2 flex flex-wrap gap-2">
                            {item.roles_observed.slice(0, 5).map((role) => (
                              <span key={role} className="app-chip">
                                {ROLE_LABELS[role.toLowerCase()] || role}
                              </span>
                            ))}
                          </div>
                        </div>
                      ) : null}

                      {item.aliases.length > 0 ? (
                        <div className="mt-4">
                          <p className="text-xs font-black uppercase tracking-[0.12em] text-[var(--invest-faint)]">
                            Nomes encontrados no arquivo
                          </p>
                          <div className="mt-2 flex flex-wrap gap-2">
                            {item.aliases.map((alias) => (
                              <span key={alias} className="app-chip">
                                {alias}
                              </span>
                            ))}
                          </div>
                        </div>
                      ) : null}

                      <div className="mt-5">
                        {href ? (
                          <div className="flex flex-wrap gap-2">
                            <Link href={href} className="invest-button inline-flex px-4">
                              {isPerson ? "Abrir pessoa" : "Abrir histórico"}
                            </Link>
                            {isSupplier ? (
                              <Link href={`/relatorios/fornecedor/${item.id}`} className="invest-button-secondary inline-flex px-4">
                                Abrir relatório
                              </Link>
                            ) : null}
                          </div>
                        ) : (
                          <span className="app-chip">
                            Detalhe completo entra nas próximas etapas
                          </span>
                        )}
                      </div>
                    </article>
                  );
                })}
              </div>
            </section>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function SupplierCardsSection({
  title,
  description,
  suppliers,
}: {
  title: string;
  description: string;
  suppliers: SupplierDirectoryItem[];
}) {
  return (
    <section className="invest-card p-5 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="invest-section-title">{title}</p>
          <p className="mt-1 text-sm text-[var(--invest-muted)]">
            {description}
          </p>
        </div>
        <StatusPill tone="muted">{suppliers.length} fornecedor(es)</StatusPill>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        {suppliers.length === 0 ? (
          <p className="text-sm text-[var(--invest-muted)]">
            Nenhum fornecedor com linhas ligadas foi encontrado neste momento.
          </p>
        ) : (
          suppliers.map((item) => (
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
                <StatusPill tone="info">Fornecedor</StatusPill>
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
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
  );
}
