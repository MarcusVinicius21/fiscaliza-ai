"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { SkeletonBlock } from "@/components/app/skeleton-block";
import { StatusPill } from "@/components/app/status-pill";
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

interface BidItem {
  id: string;
  number?: string | null;
  raw_number?: string | null;
  process_number?: string | null;
  modality?: string | null;
  winner_entity_name?: string | null;
  winner_canonical_name?: string | null;
  estimated_value?: number | null;
  awarded_value?: number | null;
  published_at?: string | null;
  contracts_count?: number | null;
}

interface BidsPayload {
  status?: string;
  total?: number;
  items: BidItem[];
}

const MODALITIES = [
  { value: "", label: "Todas" },
  { value: "pregao", label: "Pregão" },
  { value: "concorrencia", label: "Concorrência" },
  { value: "dispensa", label: "Dispensa" },
  { value: "inexigibilidade", label: "Inexigibilidade" },
  { value: "tomada_de_precos", label: "Tomada de preços" },
];

function money(value: number | null | undefined): string {
  if (typeof value !== "number") return "—";
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export default function LicitacoesPage() {
  const [uploadId, setUploadId] = useState("");
  const [cityId, setCityId] = useState("");
  const [modality, setModality] = useState("");

  const [cities, setCities] = useState<CityOption[]>([]);
  const [uploads, setUploads] = useState<UploadOption[]>([]);

  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");
  const [payload, setPayload] = useState<BidsPayload | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function loadMeta() {
      const citiesRes = await supabase
        .from("cities")
        .select("id, name, state")
        .order("name");
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
        if (modality) params.set("modality", modality);

        const response = await fetch(`${API_BASE}/bids?${params.toString()}`);
        const data = (await response.json().catch(() => null)) as BidsPayload | null;
        if (!response.ok) {
          throw new Error(
            safeDetail(
              data,
              "Não foi possível carregar as licitações agora. Tente novamente em instantes.",
            ),
          );
        }
        if (!cancelled) setPayload(data);
      } catch (error: unknown) {
        if (!cancelled) {
          setErrorMessage(
            safeNetworkMessage(
              error,
              "Não foi possível carregar as licitações agora. Tente novamente em instantes.",
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
  }, [uploadId, cityId, modality]);

  const items = payload?.items || [];

  return (
    <div className="page-shell">
      <section className="page-header px-5 py-5 sm:px-6">
        <p className="invest-eyebrow">Cadeia do gasto</p>
        <div className="mt-3 max-w-3xl">
          <h1 className="invest-title text-2xl sm:text-[2rem]">Licitações</h1>
          <p className="invest-subtitle mt-3 text-sm sm:text-base">
            Origem das contratações. Cruze processo, modalidade e vencedor para entender como cada contrato foi motivado.
          </p>
        </div>
      </section>

      <section className="invest-card p-5 sm:p-6">
        <div className="grid gap-4 lg:grid-cols-3">
          <div>
            <label className="invest-label" htmlFor="bids-upload">Upload</label>
            <select
              id="bids-upload"
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
            <label className="invest-label" htmlFor="bids-city">Cidade</label>
            <select
              id="bids-city"
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
            <label className="invest-label" htmlFor="bids-modality">Modalidade</label>
            <select
              id="bids-modality"
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
        </div>
      </section>

      <section className="invest-card p-5 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="invest-section-title">Licitações encontradas</p>
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
              Nenhuma licitação encontrada com os filtros atuais. Amplie a busca ou confirme se o upload correto foi selecionado.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-sm">
                <thead>
                  <tr className="text-left text-xs font-black uppercase tracking-[0.12em] text-[var(--invest-faint)]">
                    <th className="border-b border-[var(--invest-border)] py-2 pr-3">Número</th>
                    <th className="border-b border-[var(--invest-border)] py-2 pr-3">Processo</th>
                    <th className="border-b border-[var(--invest-border)] py-2 pr-3">Modalidade</th>
                    <th className="border-b border-[var(--invest-border)] py-2 pr-3">Vencedor</th>
                    <th className="border-b border-[var(--invest-border)] py-2 pr-3">Valor</th>
                    <th className="border-b border-[var(--invest-border)] py-2 pr-3">Publicação</th>
                    <th className="border-b border-[var(--invest-border)] py-2 pr-3">Contratos</th>
                    <th className="border-b border-[var(--invest-border)] py-2">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item) => {
                    const value =
                      typeof item.awarded_value === "number"
                        ? item.awarded_value
                        : item.estimated_value;
                    return (
                      <tr key={item.id}>
                        <td className="border-b border-[var(--invest-border)] py-2 pr-3 font-mono text-xs text-[var(--invest-heading)]">
                          {item.raw_number || item.number || item.id.slice(0, 8)}
                        </td>
                        <td className="border-b border-[var(--invest-border)] py-2 pr-3 font-mono text-xs text-[var(--invest-muted)]">
                          {item.process_number || "—"}
                        </td>
                        <td className="border-b border-[var(--invest-border)] py-2 pr-3 text-[var(--invest-muted)]">
                          {item.modality || "—"}
                        </td>
                        <td className="border-b border-[var(--invest-border)] py-2 pr-3 text-[var(--invest-heading)]">
                          {item.winner_canonical_name || item.winner_entity_name || "—"}
                        </td>
                        <td className="border-b border-[var(--invest-border)] py-2 pr-3 text-[var(--invest-heading)]">
                          {money(value)}
                        </td>
                        <td className="border-b border-[var(--invest-border)] py-2 pr-3 text-[var(--invest-muted)]">
                          {item.published_at || "—"}
                        </td>
                        <td className="border-b border-[var(--invest-border)] py-2 pr-3 text-[var(--invest-muted)]">
                          {typeof item.contracts_count === "number" ? item.contracts_count : "—"}
                        </td>
                        <td className="border-b border-[var(--invest-border)] py-2">
                          <Link href={`/licitacoes/${item.id}`} className="invest-button inline-flex px-3 py-1 text-xs">
                            Abrir
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
