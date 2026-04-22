"use client";

import { FormEvent, useMemo, useState } from "react";
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

const FILTERS: Array<{ value: EntityType; label: string }> = [
  { value: "all", label: "Todos" },
  { value: "supplier", label: "Fornecedor" },
  { value: "organization", label: "Organizacao" },
  { value: "person", label: "Pessoa" },
  { value: "server", label: "Servidor" },
];

const GROUP_LABELS: Record<string, string> = {
  supplier: "Fornecedores",
  organization: "Organizacoes",
  person: "Pessoas",
  server: "Servidores",
  other: "Outros",
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

export default function SearchPage() {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<EntityType>("all");
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [payload, setPayload] = useState<SearchPayload | null>(null);
  const [hasSearched, setHasSearched] = useState(false);

  async function handleSearch(event?: FormEvent) {
    event?.preventDefault();
    const trimmed = query.trim();
    if (!trimmed) return;

    setLoading(true);
    setErrorMessage("");
    setHasSearched(true);

    try {
      const params = new URLSearchParams({
        q: trimmed,
        entity_type: filter,
        limit: "20",
      });
      const response = await fetch(`${API_BASE}/entities/search?${params.toString()}`);
      const data = (await response.json().catch(() => null)) as SearchPayload | { detail?: string } | null;

      if (!response.ok) {
        throw new Error((data as { detail?: string } | null)?.detail || "Falha ao buscar entidades.");
      }

      setPayload(data as SearchPayload);
    } catch (error: unknown) {
      setPayload(null);
      setErrorMessage(
        error instanceof Error ? error.message : "Falha ao buscar entidades."
      );
    } finally {
      setLoading(false);
    }
  }

  const groups = useMemo(() => {
    const source = payload?.results || {};
    return Object.entries(source).filter(([, items]) => Array.isArray(items) && items.length > 0);
  }, [payload]);

  return (
    <div className="page-shell">
      <section className="page-header px-5 py-5 sm:px-6">
        <p className="invest-eyebrow">Camada de entidades</p>
        <div className="mt-3 max-w-3xl">
          <h1 className="invest-title text-2xl sm:text-[2rem]">
            Buscar fornecedor, pessoa ou documento
          </h1>
          <p className="invest-subtitle mt-3 text-sm sm:text-base">
            A busca amplia a camada de entidades sem reabrir o nucleo factual. Procure por nome canonico, alias ou documento.
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
              A busca olha nome canonico, alias e documento.
            </p>
          </div>

          <div>
            <label className="invest-label" htmlFor="search-filter">
              Tipo
            </label>
            <select
              id="search-filter"
              value={filter}
              onChange={(event) => setFilter(event.target.value as EntityType)}
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
      </section>

      {loading ? (
        <section className="invest-card p-5">
          <SkeletonBlock lines={5} />
        </section>
      ) : null}

      {!loading && errorMessage ? (
        <section className="invest-card p-5">
          <p className="text-sm font-bold text-[var(--invest-danger)]">{errorMessage}</p>
        </section>
      ) : null}

      {!loading && !hasSearched ? (
        <section className="invest-card p-5">
          <p className="text-sm font-bold text-[var(--invest-heading)]">
            Nenhuma busca iniciada
          </p>
          <p className="mt-2 text-sm leading-6 text-[var(--invest-muted)]">
            Comece por um fornecedor, uma pessoa, um alias visto no arquivo ou um documento.
          </p>
        </section>
      ) : null}

      {!loading && hasSearched && !errorMessage && groups.length === 0 ? (
        <section className="invest-card p-5">
          <p className="text-sm font-bold text-[var(--invest-heading)]">
            Nenhuma entidade encontrada
          </p>
          <p className="mt-2 text-sm leading-6 text-[var(--invest-muted)]">
            Tente outra grafia, um alias observado no arquivo ou o documento sem pontuacao.
          </p>
        </section>
      ) : null}

      {!loading && groups.length > 0 ? (
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
                  const isSupplier =
                    item.entity_type === "supplier" || item.entity_type === "organization";
                  const isPerson =
                    item.entity_type === "person" || item.entity_type === "server";
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
                        <span className="app-chip">{item.uploads_count} uploads</span>
                        <span className="app-chip">{item.records_count} linhas</span>
                        <span className="app-chip">{formatMoney(item.total_amount)}</span>
                        {(item.cross_reference_counts?.role_conflict || 0) > 0 ? (
                          <StatusPill tone="warning">
                            {item.cross_reference_counts?.role_conflict} conflito(s)
                          </StatusPill>
                        ) : null}
                      </div>

                      {item.roles_observed && item.roles_observed.length > 0 ? (
                        <div className="mt-4">
                          <p className="text-xs font-black uppercase tracking-[0.12em] text-[var(--invest-faint)]">
                            Papeis observados
                          </p>
                          <div className="mt-2 flex flex-wrap gap-2">
                            {item.roles_observed.slice(0, 5).map((role) => (
                              <span key={role} className="app-chip">
                                {role}
                              </span>
                            ))}
                          </div>
                        </div>
                      ) : null}

                      {item.aliases.length > 0 ? (
                        <div className="mt-4">
                          <p className="text-xs font-black uppercase tracking-[0.12em] text-[var(--invest-faint)]">
                            Aliases observados
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
                          <Link href={href} className="invest-button inline-flex px-4">
                            {isPerson ? "Abrir pessoa" : "Abrir historico"}
                          </Link>
                        ) : (
                          <span className="app-chip">
                            Detalhe completo desta entidade entra nas proximas etapas
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
