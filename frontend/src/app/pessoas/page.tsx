"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { SkeletonBlock } from "@/components/app/skeleton-block";
import { StatusPill } from "@/components/app/status-pill";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8000";

type PersonType = "all" | "person" | "server";

interface SearchEntity {
  id: string;
  entity_type: string;
  canonical_name: string;
  document?: string | null;
  aliases?: string[];
  uploads_count?: number;
  records_count?: number;
  total_amount?: number;
  cross_reference_counts?: {
    total?: number;
    role_conflict?: number;
    same_person_candidate?: number;
    homonym_candidate?: number;
  };
}

interface SearchPayload {
  status: string;
  results?: Record<string, SearchEntity[]>;
}

function formatDocument(value?: string | null) {
  const digits = String(value || "").replace(/\D/g, "");
  if (digits.length === 11) {
    return digits.replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/, "$1.$2.$3-$4");
  }
  if (digits.length === 14) {
    return digits.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, "$1.$2.$3/$4-$5");
  }
  return value || "Sem documento";
}

function personTypeLabel(value?: string | null) {
  if (value === "server") return "Servidor";
  return "Pessoa";
}

function safeMessage(error: unknown) {
  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }
  return "Não foi possível procurar pessoas e servidores agora.";
}

export default function PeoplePage() {
  const [query, setQuery] = useState("");
  const [personType, setPersonType] = useState<PersonType>("all");
  const [items, setItems] = useState<SearchEntity[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const resultLabel = useMemo(() => {
    if (!searched) return "Digite um nome ou documento para começar.";
    if (items.length === 1) return "1 pessoa ou servidor encontrado";
    return `${items.length} pessoas ou servidores encontrados`;
  }, [items.length, searched]);

  async function runSearch() {
    const cleanQuery = query.trim();
    if (!cleanQuery) {
      setSearched(false);
      setItems([]);
      setErrorMessage("");
      return;
    }

    setLoading(true);
    setSearched(true);
    setErrorMessage("");

    try {
      const types = personType === "all" ? ["person", "server"] : [personType];
      const responses = await Promise.all(
        types.map(async (type) => {
          const params = new URLSearchParams({
            q: cleanQuery,
            entity_type: type,
            limit: "25",
          });
          const response = await fetch(`${API_BASE}/entities/search?${params.toString()}`);
          const payload = (await response.json().catch(() => null)) as SearchPayload | null;
          if (!response.ok) {
            throw new Error("Não foi possível carregar esta busca agora.");
          }
          return payload?.results?.[type] || [];
        })
      );

      const seen = new Set<string>();
      const merged = responses.flat().filter((item) => {
        if (seen.has(item.id)) return false;
        seen.add(item.id);
        return true;
      });
      setItems(merged);
    } catch (error) {
      setErrorMessage(safeMessage(error));
      setItems([]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="page-shell">
      <section className="page-header px-5 py-5 sm:px-6">
        <p className="invest-eyebrow">Pessoas e servidores</p>
        <div className="mt-3 max-w-3xl">
          <h1 className="invest-title text-2xl sm:text-[2rem]">
            Pessoas e servidores encontrados
          </h1>
          <p className="invest-subtitle mt-3 text-sm sm:text-base">
            Procure nomes, documentos e aparições nos arquivos analisados. Use os resultados como informação de apoio.
          </p>
        </div>
      </section>

      <section className="invest-card p-5 sm:p-6">
        <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_220px_auto]">
          <div>
            <label className="invest-label" htmlFor="people-query">
              Nome ou documento
            </label>
            <input
              id="people-query"
              className="invest-input"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") runSearch();
              }}
              placeholder="Digite pelo menos parte do nome"
            />
          </div>

          <div>
            <label className="invest-label" htmlFor="people-type">
              Tipo
            </label>
            <select
              id="people-type"
              className="invest-select"
              value={personType}
              onChange={(event) => setPersonType(event.target.value as PersonType)}
            >
              <option value="all">Todos</option>
              <option value="person">Pessoa</option>
              <option value="server">Servidor</option>
            </select>
          </div>

          <button type="button" className="invest-button self-end px-5" onClick={runSearch}>
            Buscar
          </button>
        </div>

        <p className="mt-4 text-sm text-[var(--invest-muted)]">{resultLabel}</p>
      </section>

      <section className="invest-card p-5 sm:p-6">
        {loading ? (
          <SkeletonBlock lines={6} />
        ) : errorMessage ? (
          <p className="text-sm font-bold text-[var(--invest-danger)]">{errorMessage}</p>
        ) : !searched ? (
          <p className="text-sm text-[var(--invest-muted)]">
            Digite um nome ou documento para procurar pessoas e servidores.
          </p>
        ) : items.length === 0 ? (
          <p className="text-sm text-[var(--invest-muted)]">
            Nenhuma pessoa ou servidor encontrado com os filtros atuais.
          </p>
        ) : (
          <div className="grid gap-4 lg:grid-cols-2">
            {items.map((item) => (
              <article key={item.id} className="invest-card-solid p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-black text-[var(--invest-heading)]">
                      {item.canonical_name}
                    </p>
                    <p className="mt-1 text-xs text-[var(--invest-muted)]">
                      {formatDocument(item.document)}
                    </p>
                  </div>
                  <StatusPill tone={item.entity_type === "server" ? "warning" : "info"}>
                    {personTypeLabel(item.entity_type)}
                  </StatusPill>
                </div>

                <div className="mt-3 flex flex-wrap gap-2">
                  <span className="app-chip">{item.uploads_count || 0} arquivo(s)</span>
                  <span className="app-chip">{item.records_count || 0} linha(s)</span>
                  <span className="app-chip">
                    {item.cross_reference_counts?.total || 0} possível(is) ligação(ões)
                  </span>
                </div>

                {item.aliases && item.aliases.length > 0 ? (
                  <p className="mt-3 text-xs leading-5 text-[var(--invest-muted)]">
                    Nome encontrado no arquivo: {item.aliases.slice(0, 2).join(", ")}
                  </p>
                ) : null}

                <Link href={`/pessoas/${item.id}`} className="invest-button-secondary mt-4 px-4">
                  Abrir histórico
                </Link>
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
