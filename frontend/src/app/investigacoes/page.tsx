"use client";

import { useEffect, useState } from "react";
import { CrossRefCard, CrossRefCardItem } from "@/components/app/cross-ref-card";
import { SkeletonBlock } from "@/components/app/skeleton-block";
import { StatusPill } from "@/components/app/status-pill";
import { supabase } from "@/lib/supabase";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8000";

interface InvestigationPayload {
  status: string;
  page: number;
  page_size: number;
  total: number;
  items: CrossRefCardItem[];
}

interface CityOption {
  id: string;
  name: string;
  state?: string | null;
}

function safeDetail(payload: unknown, fallback: string) {
  const detail =
    payload &&
    typeof payload === "object" &&
    "detail" in payload &&
    typeof (payload as { detail?: unknown }).detail === "string"
      ? String((payload as { detail?: string }).detail).trim()
      : "";
  return detail || fallback;
}

export default function InvestigationsPage() {
  const [confidence, setConfidence] = useState("");
  const [crossRefType, setCrossRefType] = useState("");
  const [cityId, setCityId] = useState("");
  const [cities, setCities] = useState<CityOption[]>([]);
  const [loadingLinks, setLoadingLinks] = useState(true);
  const [loadingNames, setLoadingNames] = useState(true);
  const [linksError, setLinksError] = useState("");
  const [namesError, setNamesError] = useState("");
  const [linksPayload, setLinksPayload] = useState<InvestigationPayload | null>(null);
  const [namesPayload, setNamesPayload] = useState<InvestigationPayload | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function loadCities() {
      const { data } = await supabase.from("cities").select("id, name, state").order("name");
      if (!cancelled) {
        setCities((data || []) as CityOption[]);
      }
    }
    loadCities();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function loadLinks() {
      setLoadingLinks(true);
      setLinksError("");
      try {
        const params = new URLSearchParams({
          page: "1",
          page_size: "20",
        });
        if (confidence) params.set("confidence_level", confidence);
        if (cityId) params.set("city_id", cityId);

        const response = await fetch(`${API_BASE}/investigations/server-supplier-links?${params.toString()}`);
        const payload = (await response.json().catch(() => null)) as InvestigationPayload | null;
        if (!response.ok) {
          throw new Error(safeDetail(payload, "Nao foi possivel carregar os conflitos de papel agora."));
        }
        if (!cancelled) {
          setLinksPayload(payload);
        }
      } catch (error: unknown) {
        if (!cancelled) {
          setLinksError(error instanceof Error ? error.message : "Nao foi possivel carregar os conflitos de papel agora.");
        }
      } finally {
        if (!cancelled) {
          setLoadingLinks(false);
        }
      }
    }

    loadLinks();
    return () => {
      cancelled = true;
    };
  }, [confidence, cityId]);

  useEffect(() => {
    let cancelled = false;

    async function loadNames() {
      setLoadingNames(true);
      setNamesError("");
      try {
        const params = new URLSearchParams({
          page: "1",
          page_size: "20",
        });
        if (confidence) params.set("confidence_level", confidence);
        if (crossRefType) params.set("cross_ref_type", crossRefType);

        const response = await fetch(`${API_BASE}/investigations/name-matches?${params.toString()}`);
        const payload = (await response.json().catch(() => null)) as InvestigationPayload | null;
        if (!response.ok) {
          throw new Error(safeDetail(payload, "Nao foi possivel carregar os matches de nome agora."));
        }
        if (!cancelled) {
          setNamesPayload(payload);
        }
      } catch (error: unknown) {
        if (!cancelled) {
          setNamesError(error instanceof Error ? error.message : "Nao foi possivel carregar os matches de nome agora.");
        }
      } finally {
        if (!cancelled) {
          setLoadingNames(false);
        }
      }
    }

    loadNames();
    return () => {
      cancelled = true;
    };
  }, [confidence, crossRefType]);

  return (
    <div className="page-shell">
      <section className="page-header px-5 py-5 sm:px-6">
        <p className="invest-eyebrow">Hub investigativo</p>
        <div className="mt-3 max-w-3xl">
          <h1 className="invest-title text-2xl sm:text-[2rem]">
            Investigacoes transversais
          </h1>
          <p className="invest-subtitle mt-3 text-sm sm:text-base">
            Cruzamentos tecnicos para orientar apuracao humana, sem tratar nome parecido como prova automatica.
          </p>
        </div>
      </section>

      <section className="invest-card p-5 sm:p-6">
        <div className="grid gap-4 lg:grid-cols-3">
          <div>
            <label className="invest-label" htmlFor="investigations-confidence">
              Confianca
            </label>
            <select
              id="investigations-confidence"
              className="invest-select"
              value={confidence}
              onChange={(event) => setConfidence(event.target.value)}
            >
              <option value="">Todas</option>
              <option value="indicative">Indicio</option>
              <option value="probable">Vinculo provavel</option>
              <option value="confirmed">Vinculo confirmado</option>
            </select>
          </div>

          <div>
            <label className="invest-label" htmlFor="investigations-type">
              Match de nome
            </label>
            <select
              id="investigations-type"
              className="invest-select"
              value={crossRefType}
              onChange={(event) => setCrossRefType(event.target.value)}
            >
              <option value="">Todos</option>
              <option value="same_person_candidate">Mesma pessoa</option>
              <option value="homonym_candidate">Homonimo</option>
            </select>
          </div>

          <div>
            <label className="invest-label" htmlFor="investigations-city">
              Cidade
            </label>
            <select
              id="investigations-city"
              className="invest-select"
              value={cityId}
              onChange={(event) => setCityId(event.target.value)}
            >
              <option value="">Todas</option>
              {cities.map((city) => (
                <option key={city.id} value={city.id}>
                  {city.name}
                  {city.state ? `/${city.state}` : ""}
                </option>
              ))}
            </select>
          </div>
        </div>
      </section>

      <section className="invest-card p-5 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="invest-section-title">Conflitos servidor x fornecedor</p>
            <p className="mt-1 text-sm text-[var(--invest-muted)]">
              Relacoes tecnicas em que um mesmo nome, documento ou contexto pede verificacao de papel.
            </p>
          </div>
          <StatusPill tone="warning">{linksPayload?.total || 0} item(ns)</StatusPill>
        </div>

        <div className="mt-4 space-y-4">
          {loadingLinks ? (
            <SkeletonBlock lines={6} />
          ) : linksError ? (
            <p className="text-sm font-bold text-[var(--invest-danger)]">{linksError}</p>
          ) : !linksPayload || linksPayload.items.length === 0 ? (
            <p className="text-sm text-[var(--invest-muted)]">
              Nenhum conflito de papel encontrado com os filtros atuais.
            </p>
          ) : (
            linksPayload.items.map((item) => <CrossRefCard key={item.id} item={item} />)
          )}
        </div>
      </section>

      <section className="invest-card p-5 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="invest-section-title">Homonimos e matches de nome</p>
            <p className="mt-1 text-sm text-[var(--invest-muted)]">
              Nome repetido nao e bug. Ele acende uma luz para apuracao humana e checagem de documento.
            </p>
          </div>
          <StatusPill tone="muted">{namesPayload?.total || 0} item(ns)</StatusPill>
        </div>

        <div className="mt-4 space-y-4">
          {loadingNames ? (
            <SkeletonBlock lines={6} />
          ) : namesError ? (
            <p className="text-sm font-bold text-[var(--invest-danger)]">{namesError}</p>
          ) : !namesPayload || namesPayload.items.length === 0 ? (
            <p className="text-sm text-[var(--invest-muted)]">
              Nenhum match de nome relevante apareceu com os filtros atuais.
            </p>
          ) : (
            namesPayload.items.map((item) => <CrossRefCard key={item.id} item={item} />)
          )}
        </div>
      </section>
    </div>
  );
}
