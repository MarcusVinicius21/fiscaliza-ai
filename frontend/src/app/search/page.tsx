"use client";

import { FormEvent, useMemo, useState } from "react";
import Link from "next/link";
import { SkeletonBlock } from "@/components/app/skeleton-block";
import { StatusPill } from "@/components/app/status-pill";
import { parseMoney } from "@/lib/product-diagnostics";
import { supabase } from "@/lib/supabase";

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

interface SupplierOverviewLite {
  supplier?: {
    canonical_name?: string | null;
    document?: string | null;
  };
  summary?: {
    uploads_count?: number;
    records_count?: number;
    total_amount?: number;
    alerts_count?: number;
  };
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
      const directoryResponse = await fetch(`${API_BASE}/suppliers?limit=12`);
      if (directoryResponse.ok) {
        const directoryPayload = (await directoryResponse.json()) as SupplierDirectoryPayload;
        const suppliers = directoryPayload.suppliers || directoryPayload.items || [];
        setSupplierDirectory(
          suppliers
            .filter((item) => item.records_count > 0 || item.total_amount > 0 || item.alerts_count > 0)
            .sort((a, b) => b.total_amount - a.total_amount || b.records_count - a.records_count),
        );
        return;
      }

      const entitiesRes = await supabase
        .from("entities")
        .select("id, canonical_name, document, entity_type")
        .in("entity_type", ["supplier", "organization"])
        .order("canonical_name")
        .limit(80);

      if (entitiesRes.error) throw new Error(entitiesRes.error.message);
      const entities = (entitiesRes.data || []) as Array<{
        id: string;
        canonical_name?: string | null;
        document?: string | null;
      }>;
      const entityIds = entities.map((item) => item.id);

      if (entityIds.length === 0) {
        setSupplierDirectory([]);
        return;
      }

      const linksRes = await supabase
        .from("record_entity_links")
        .select("entity_id, standardized_record_id")
        .in("entity_id", entityIds)
        .limit(5000);

      if (linksRes.error) throw new Error(linksRes.error.message);
      const links = (linksRes.data || []) as Array<{ entity_id: string; standardized_record_id: string }>;
      const recordIds = Array.from(new Set(links.map((link) => link.standardized_record_id).filter(Boolean)));
      const recordsRes = recordIds.length
        ? await supabase
            .from("standardized_records")
            .select("id, upload_id, valor_bruto")
            .in("id", recordIds)
            .limit(5000)
        : { data: [], error: null };

      if (recordsRes.error) throw new Error(recordsRes.error.message);
      const recordsById = new Map(
        ((recordsRes.data || []) as Array<{ id: string; upload_id?: string | null; valor_bruto?: number | string | null }>).map((record) => [
          record.id,
          record,
        ]),
      );

      const stats = new Map<string, { records: number; uploads: Set<string>; amount: number }>();
      for (const link of links) {
        const record = recordsById.get(link.standardized_record_id);
        const current = stats.get(link.entity_id) || { records: 0, uploads: new Set<string>(), amount: 0 };
        current.records += 1;
        if (record?.upload_id) current.uploads.add(record.upload_id);
        current.amount += parseMoney(record?.valor_bruto || 0);
        stats.set(link.entity_id, current);
      }

      const initialItems = entities
        .map((entity) => {
          const current = stats.get(entity.id);
          return {
            id: entity.id,
            canonical_name: entity.canonical_name || "Fornecedor não informado",
            document: entity.document,
            uploads_count: current?.uploads.size || 0,
            records_count: current?.records || 0,
            total_amount: current?.amount || 0,
            alerts_count: 0,
          };
        })
        .sort((a, b) => b.total_amount - a.total_amount || b.records_count - a.records_count)
        .slice(0, 24);

      const enriched = await Promise.all(
        initialItems.map(async (item) => {
          try {
            const response = await fetch(`${API_BASE}/suppliers/${item.id}`);
            if (!response.ok) return item;
            const overview = (await response.json()) as SupplierOverviewLite;
            return {
              ...item,
              canonical_name: overview.supplier?.canonical_name || item.canonical_name,
              document: overview.supplier?.document ?? item.document,
              uploads_count: overview.summary?.uploads_count ?? item.uploads_count,
              records_count: overview.summary?.records_count ?? item.records_count,
              total_amount: overview.summary?.total_amount ?? item.total_amount,
              alerts_count: overview.summary?.alerts_count ?? item.alerts_count,
            };
          } catch {
            return item;
          }
        }),
      );

      setSupplierDirectory(
        enriched
          .filter((item) => item.records_count > 0 || item.total_amount > 0 || item.alerts_count > 0)
          .sort((a, b) => b.total_amount - a.total_amount || b.records_count - a.records_count)
          .slice(0, 12),
      );
    } catch (error: unknown) {
      setSupplierDirectory([]);
      setErrorMessage(error instanceof Error ? error.message : "Falha ao carregar fornecedores.");
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
            Procure por nome canônico, alias observado no arquivo ou documento (CPF / CNPJ). A busca amplia a camada de entidades sem reabrir o núcleo factual.
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
              A busca olha nome canônico, alias observado no arquivo e documento.
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
                if (nextFilter === "supplier" && !query.trim()) {
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
          <button
            type="button"
            className="invest-button-secondary px-4 py-2 text-sm"
            onClick={() => setFilter("supplier")}
          >
            Buscar fornecedores
          </button>
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
        </section>
      ) : null}

      {!loading && !hasSearched ? (
        <section className="invest-card p-5">
          <p className="text-sm font-bold text-[var(--invest-heading)]">
            Nenhuma busca iniciada
          </p>
          <p className="mt-2 text-sm leading-6 text-[var(--invest-muted)]">
            Comece digitando um fornecedor, uma pessoa, um alias visto no arquivo ou um documento (CPF ou CNPJ, com ou sem pontuação).
          </p>
        </section>
      ) : null}

      {!loading && directoryMode && !errorMessage ? (
        <section className="invest-card p-5 sm:p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="invest-section-title">Principais fornecedores</p>
              <p className="mt-1 text-sm text-[var(--invest-muted)]">
                Fornecedores encontrados nos registros já processados, ordenados por valor consolidado.
              </p>
            </div>
            <StatusPill tone="muted">{supplierDirectory.length} fornecedor(es)</StatusPill>
          </div>

          <div className="mt-4 grid gap-4 lg:grid-cols-2">
            {supplierDirectory.length === 0 ? (
              <p className="text-sm text-[var(--invest-muted)]">
                Nenhum fornecedor com registros vinculados foi encontrado neste momento.
              </p>
            ) : (
              supplierDirectory.map((item) => (
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
                    <span className="app-chip">{item.uploads_count} upload(s)</span>
                    <span className="app-chip">{item.records_count} linha(s)</span>
                    <span className="app-chip">{item.alerts_count} alerta(s)</span>
                  </div>
                  <div className="mt-5 flex flex-wrap gap-2">
                    <Link href={`/fornecedores/${item.id}`} className="invest-button inline-flex px-4">
                      Abrir histórico
                    </Link>
                    <Link href={`/relatorios/fornecedor/${item.id}`} className="invest-button-secondary inline-flex px-4">
                      Abrir dossiê
                    </Link>
                  </div>
                </article>
              ))
            )}
          </div>
        </section>
      ) : null}

      {!loading && hasSearched && !directoryMode && !errorMessage && groups.length === 0 ? (
        <section className="invest-card p-5">
          <p className="text-sm font-bold text-[var(--invest-heading)]">
            Nenhuma entidade encontrada
          </p>
          <p className="mt-2 text-sm leading-6 text-[var(--invest-muted)]">
            Tente outra grafia, um alias observado no arquivo ou o documento sem pontuação. A busca usa nome canônico, aliases e documento.
          </p>
        </section>
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
                            Papéis observados
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
                          <div className="flex flex-wrap gap-2">
                            <Link href={href} className="invest-button inline-flex px-4">
                              {isPerson ? "Abrir pessoa" : "Abrir histórico"}
                            </Link>
                            {isSupplier ? (
                              <Link href={`/relatorios/fornecedor/${item.id}`} className="invest-button-secondary inline-flex px-4">
                                Abrir dossiê
                              </Link>
                            ) : null}
                          </div>
                        ) : (
                          <span className="app-chip">
                            Detalhe completo desta entidade entra nas próximas etapas
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
