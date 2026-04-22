"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { CrossRefCard, CrossRefCardItem } from "@/components/app/cross-ref-card";
import { SkeletonBlock } from "@/components/app/skeleton-block";
import { StatusPill } from "@/components/app/status-pill";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8000";

interface PersonOverviewPayload {
  status: string;
  person: {
    id: string;
    entity_type: string;
    canonical_name: string;
    document?: string | null;
    source_confidence?: number | null;
    aliases: string[];
  };
  summary: {
    uploads_count: number;
    cities_count: number;
    categories_count: number;
    records_count: number;
    total_amount: number;
    conflicts_detected: number;
  };
  categories: Array<{
    category: string;
    records_count: number;
    total_amount: number;
  }>;
  roles_observed: string[];
  timeline: Array<{
    period: string;
    records_count: number;
    total_amount: number;
  }>;
  uploads: Array<{
    upload_id: string;
    file_name?: string | null;
    report_type?: string | null;
    report_label?: string | null;
    category?: string | null;
    created_at?: string | null;
    records_count: number;
    total_amount: number;
  }>;
  cross_reference_summary: {
    total: number;
    conflicts_detected: number;
    totals_by_type: Record<string, number>;
    totals_by_confidence: Record<string, number>;
  };
}

interface AppearanceItem {
  record_id: string;
  upload_id: string;
  file_name?: string | null;
  category?: string | null;
  role_in_record?: string | null;
  data?: string | null;
  valor_bruto: number;
  city_name?: string | null;
  state?: string | null;
  summary: string;
}

interface AppearancesPayload {
  status: string;
  page: number;
  page_size: number;
  total: number;
  items: AppearanceItem[];
}

interface CrossReferencesPayload {
  status: string;
  totals_by_type: Record<string, number>;
  total: number;
  items: CrossRefCardItem[];
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

const CROSS_REF_TYPE_LABELS: Record<string, string> = {
  role_conflict: "Conflitos de papel",
  same_person_candidate: "Candidatos a mesma pessoa",
  homonym_candidate: "Homônimos",
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

function humanRole(value?: string | null) {
  const normalized = String(value || "").trim().toLowerCase();
  return ROLE_LABELS[normalized] || normalized || "—";
}

function safeDetail(payload: unknown, fallback: string) {
  const detail =
    payload &&
    typeof payload === "object" &&
    "detail" in payload &&
    typeof (payload as { detail?: unknown }).detail === "string"
      ? String((payload as { detail?: string }).detail).trim()
      : "";

  if (!detail) return fallback;
  if (/failed to fetch|remoteprotocolerror|server disconnected|traceback|httpx/i.test(detail)) {
    return fallback;
  }
  return detail;
}

function safeNetworkMessage(error: unknown, fallback: string) {
  if (error instanceof Error) {
    const message = String(error.message || "").trim();
    if (message && !/failed to fetch|remoteprotocolerror|server disconnected|traceback|httpx/i.test(message)) {
      return message;
    }
  }
  return fallback;
}

export default function PersonDetailPage() {
  const params = useParams<{ id: string }>();
  const personId = String(params?.id || "");

  const [overview, setOverview] = useState<PersonOverviewPayload | null>(null);
  const [crossRefs, setCrossRefs] = useState<CrossReferencesPayload | null>(null);
  const [appearances, setAppearances] = useState<AppearancesPayload | null>(null);
  const [loadingOverview, setLoadingOverview] = useState(true);
  const [loadingCrossRefs, setLoadingCrossRefs] = useState(true);
  const [loadingAppearances, setLoadingAppearances] = useState(true);
  const [overviewError, setOverviewError] = useState("");
  const [crossRefsError, setCrossRefsError] = useState("");
  const [appearancesError, setAppearancesError] = useState("");
  const [appearancesPage, setAppearancesPage] = useState(1);
  const [selectedUpload, setSelectedUpload] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("");
  const [selectedRole, setSelectedRole] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function loadOverview() {
      if (!personId) return;
      setLoadingOverview(true);
      setOverviewError("");

      try {
        const response = await fetch(`${API_BASE}/people/${personId}`);
        const payload = (await response.json().catch(() => null)) as PersonOverviewPayload | null;
        if (!response.ok) {
          throw new Error(
            safeDetail(payload, "Nao foi possivel carregar esta pessoa agora. Tente novamente em instantes.")
          );
        }
        if (!cancelled) {
          setOverview(payload);
        }
      } catch (error: unknown) {
        if (!cancelled) {
          setOverviewError(
            safeNetworkMessage(
              error,
              "Nao foi possivel carregar esta pessoa agora. Tente novamente em instantes."
            )
          );
        }
      } finally {
        if (!cancelled) {
          setLoadingOverview(false);
        }
      }
    }

    loadOverview();
    return () => {
      cancelled = true;
    };
  }, [personId]);

  useEffect(() => {
    let cancelled = false;

    async function loadCrossReferences() {
      if (!personId) return;
      setLoadingCrossRefs(true);
      setCrossRefsError("");

      try {
        const response = await fetch(`${API_BASE}/people/${personId}/cross-references`);
        const payload = (await response.json().catch(() => null)) as CrossReferencesPayload | null;
        if (!response.ok) {
          throw new Error(
            safeDetail(payload, "Nao foi possivel carregar os cruzamentos desta pessoa agora.")
          );
        }
        if (!cancelled) {
          setCrossRefs(payload);
        }
      } catch (error: unknown) {
        if (!cancelled) {
          setCrossRefsError(
            safeNetworkMessage(
              error,
              "Nao foi possivel carregar os cruzamentos desta pessoa agora. Tente novamente em instantes."
            )
          );
        }
      } finally {
        if (!cancelled) {
          setLoadingCrossRefs(false);
        }
      }
    }

    loadCrossReferences();
    return () => {
      cancelled = true;
    };
  }, [personId]);

  useEffect(() => {
    let cancelled = false;

    async function loadAppearances() {
      if (!personId) return;
      setLoadingAppearances(true);
      setAppearancesError("");

      try {
        const params = new URLSearchParams({
          page: String(appearancesPage),
          page_size: "20",
        });
        if (selectedUpload) params.set("upload_id", selectedUpload);
        if (selectedCategory) params.set("category", selectedCategory);
        if (selectedRole) params.set("role", selectedRole);

        const response = await fetch(`${API_BASE}/people/${personId}/appearances?${params.toString()}`);
        const payload = (await response.json().catch(() => null)) as AppearancesPayload | null;
        if (!response.ok) {
          throw new Error(
            safeDetail(payload, "Nao foi possivel carregar as aparicoes desta pessoa agora.")
          );
        }
        if (!cancelled) {
          setAppearances(payload);
        }
      } catch (error: unknown) {
        if (!cancelled) {
          setAppearancesError(
            safeNetworkMessage(
              error,
              "Nao foi possivel carregar as aparicoes desta pessoa agora. Tente novamente em instantes."
            )
          );
        }
      } finally {
        if (!cancelled) {
          setLoadingAppearances(false);
        }
      }
    }

    loadAppearances();
    return () => {
      cancelled = true;
    };
  }, [personId, appearancesPage, selectedUpload, selectedCategory, selectedRole]);

  useEffect(() => {
    setAppearancesPage(1);
  }, [selectedUpload, selectedCategory, selectedRole]);

  const maxTimelineAmount = useMemo(() => {
    return Math.max(...(overview?.timeline || []).map((item) => item.total_amount), 0);
  }, [overview]);

  const totalPages = useMemo(() => {
    if (!appearances) return 1;
    return Math.max(1, Math.ceil(appearances.total / appearances.page_size));
  }, [appearances]);

  const conflictItems = useMemo(() => {
    return (crossRefs?.items || []).filter((item) => item.cross_ref_type === "role_conflict");
  }, [crossRefs]);

  const matchItems = useMemo(() => {
    return (crossRefs?.items || []).filter((item) => item.cross_ref_type !== "role_conflict");
  }, [crossRefs]);

  if (loadingOverview) {
    return (
      <div className="page-shell">
        <section className="invest-card p-6">
          <SkeletonBlock lines={6} />
        </section>
      </div>
    );
  }

  if (overviewError && !overview) {
    return (
      <div className="page-shell">
        <section className="invest-card p-6">
          <p className="text-sm font-bold text-[var(--invest-danger)]">{overviewError}</p>
        </section>
      </div>
    );
  }

  if (!overview) {
    return null;
  }

  return (
    <div className="page-shell">
      <section className="page-header px-5 py-5 sm:px-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="max-w-3xl">
            <p className="invest-eyebrow">Visão por pessoa</p>
            <h1 className="invest-title mt-3 text-2xl sm:text-[2rem]">
              {overview.person.canonical_name}
            </h1>
            <p className="invest-subtitle mt-3 text-sm sm:text-base">
              Consolidação por entidade canônica com papéis observados, aparições e cruzamentos técnicos que pedem apuração humana.
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              <StatusPill tone={overview.person.entity_type === "server" ? "warning" : "info"}>
                {overview.person.entity_type === "server" ? "Servidor" : "Pessoa"}
              </StatusPill>
              <span className="app-chip">{formatDocument(overview.person.document)}</span>
              <span className="app-chip">
                {overview.cross_reference_summary.total} cruzamento(s)
              </span>
            </div>
          </div>

          <div className="flex flex-wrap gap-3">
            <Link href="/search" className="invest-button-secondary px-4">
              Voltar para busca
            </Link>
            <Link href="/investigacoes" className="invest-button-secondary px-4">
              Ver investigações
            </Link>
          </div>
        </div>

        {overview.person.aliases.length > 0 ? (
          <div className="mt-5 flex flex-wrap gap-2">
            {overview.person.aliases.slice(0, 6).map((alias) => (
              <span key={alias} className="app-chip">
                {alias}
              </span>
            ))}
          </div>
        ) : null}
      </section>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-6">
        <article className="metric-card">
          <p className="metric-label">Uploads</p>
          <p className="metric-value mt-2">{overview.summary.uploads_count}</p>
        </article>
        <article className="metric-card">
          <p className="metric-label">Linhas</p>
          <p className="metric-value mt-2">{overview.summary.records_count}</p>
        </article>
        <article className="metric-card">
          <p className="metric-label">Cidades</p>
          <p className="metric-value mt-2">{overview.summary.cities_count}</p>
        </article>
        <article className="metric-card">
          <p className="metric-label">Categorias</p>
          <p className="metric-value mt-2">{overview.summary.categories_count}</p>
        </article>
        <article className="metric-card">
          <p className="metric-label">Valor</p>
          <p className="metric-value mt-2">{formatMoney(overview.summary.total_amount)}</p>
        </article>
        <article className="metric-card">
          <p className="metric-label">Conflitos</p>
          <p className="metric-value mt-2">{overview.summary.conflicts_detected}</p>
        </article>
      </section>

      <section className="grid gap-5 xl:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
        <article className="invest-card p-5 sm:p-6">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="invest-section-title">Papéis observados</p>
              <p className="mt-1 text-sm text-[var(--invest-muted)]">
                O mesmo nome pode aparecer em bases e funções diferentes. Isso não é prova automática — só acende um sinal.
              </p>
            </div>
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            {overview.roles_observed.length === 0 ? (
              <p className="text-sm text-[var(--invest-muted)]">
                Nenhum papel observado com segurança até aqui.
              </p>
            ) : (
              overview.roles_observed.map((role) => (
                <span key={role} className="app-chip">
                  {humanRole(role)}
                </span>
              ))
            )}
          </div>

          <div className="mt-6">
            <p className="text-xs font-black uppercase tracking-[0.12em] text-[var(--invest-faint)]">
              Resumo de cruzamentos
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              {Object.entries(overview.cross_reference_summary.totals_by_type).map(([key, value]) => (
                <span key={key} className="app-chip">
                  {CROSS_REF_TYPE_LABELS[key] || key}: {value}
                </span>
              ))}
            </div>
          </div>
        </article>

        <article className="invest-card p-5 sm:p-6">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="invest-section-title">Linha do tempo</p>
              <p className="mt-1 text-sm text-[var(--invest-muted)]">
                Evolução mês a mês das aparições e dos valores relacionados.
              </p>
            </div>
          </div>

          <div className="mt-4 space-y-3">
            {overview.timeline.length === 0 ? (
              <p className="text-sm text-[var(--invest-muted)]">
                Ainda não há referência temporal confiável para montar a série mensal.
              </p>
            ) : (
              overview.timeline.map((item) => {
                const width =
                  maxTimelineAmount > 0
                    ? `${Math.max(10, (item.total_amount / maxTimelineAmount) * 100)}%`
                    : "10%";
                return (
                  <div key={item.period} className="space-y-2">
                    <div className="flex items-center justify-between gap-3 text-sm">
                      <span className="font-bold text-[var(--invest-heading)]">{item.period}</span>
                      <span className="text-[var(--invest-muted)]">
                        {formatMoney(item.total_amount)} · {item.records_count} linha(s)
                      </span>
                    </div>
                    <div className="h-2 rounded-full bg-[var(--invest-surface-soft)]">
                      <div className="h-2 rounded-full bg-[var(--invest-primary)]" style={{ width }} />
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </article>
      </section>

      <section className="grid gap-5 xl:grid-cols-2">
        <article className="invest-card p-5 sm:p-6">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="invest-section-title">Conflitos de papel</p>
              <p className="mt-1 text-sm text-[var(--invest-muted)]">
                Quando a mesma pessoa aparece como servidor e também ligada a fornecedor. Cada item precisa de verificação humana antes de virar denúncia.
              </p>
            </div>
            <StatusPill tone="warning">{conflictItems.length} item(ns)</StatusPill>
          </div>

          <div className="mt-4 space-y-4">
            {loadingCrossRefs ? (
              <SkeletonBlock lines={5} />
            ) : crossRefsError ? (
              <p className="text-sm font-bold text-[var(--invest-danger)]">{crossRefsError}</p>
            ) : conflictItems.length === 0 ? (
              <p className="text-sm text-[var(--invest-muted)]">
                Nenhum conflito de papel detectado para esta pessoa nos uploads analisados até aqui.
              </p>
            ) : (
              conflictItems.map((item) => (
                <CrossRefCard key={item.id} item={item} primaryEntityId={personId} />
              ))
            )}
          </div>
        </article>

        <article className="invest-card p-5 sm:p-6">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="invest-section-title">Outros indícios e homônimos</p>
              <p className="mt-1 text-sm text-[var(--invest-muted)]">
                Nome repetido não é prova. Aqui ele apenas acende luz para verificação humana.
              </p>
            </div>
            <StatusPill tone="muted">{matchItems.length} item(ns)</StatusPill>
          </div>

          <div className="mt-4 space-y-4">
            {loadingCrossRefs ? (
              <SkeletonBlock lines={5} />
            ) : crossRefsError ? (
              <p className="text-sm font-bold text-[var(--invest-danger)]">{crossRefsError}</p>
            ) : matchItems.length === 0 ? (
              <p className="text-sm text-[var(--invest-muted)]">
                Nenhum homônimo ou candidato a mesma pessoa apareceu com evidência suficiente até aqui.
              </p>
            ) : (
              matchItems.map((item) => (
                <CrossRefCard key={item.id} item={item} primaryEntityId={personId} />
              ))
            )}
          </div>
        </article>
      </section>

      <section className="invest-card p-5 sm:p-6">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="invest-section-title">Aparições em registros</p>
            <p className="mt-1 text-sm text-[var(--invest-muted)]">
              Cada linha é um registro padronizado em que esta pessoa aparece, com o papel que ocupava.
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <div>
              <label className="invest-label" htmlFor="person-upload-filter">
                Upload
              </label>
              <select
                id="person-upload-filter"
                className="invest-select min-w-[200px]"
                value={selectedUpload}
                onChange={(event) => setSelectedUpload(event.target.value)}
              >
                <option value="">Todos</option>
                {overview.uploads.map((upload) => (
                  <option key={upload.upload_id} value={upload.upload_id}>
                    {upload.file_name || upload.upload_id}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="invest-label" htmlFor="person-category-filter">
                Categoria
              </label>
              <select
                id="person-category-filter"
                className="invest-select min-w-[180px]"
                value={selectedCategory}
                onChange={(event) => setSelectedCategory(event.target.value)}
              >
                <option value="">Todas</option>
                {overview.categories.map((category) => (
                  <option key={category.category} value={category.category}>
                    {category.category || "Sem categoria"}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="invest-label" htmlFor="person-role-filter">
                Papel
              </label>
              <select
                id="person-role-filter"
                className="invest-select min-w-[180px]"
                value={selectedRole}
                onChange={(event) => setSelectedRole(event.target.value)}
              >
                <option value="">Todos</option>
                {overview.roles_observed.map((role) => (
                  <option key={role} value={role}>
                    {humanRole(role)}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        <div className="mt-5 overflow-hidden rounded-lg border border-[var(--invest-border)]">
          <div className="overflow-x-auto invest-soft-scroll">
            <table className="min-w-full border-collapse">
              <thead className="bg-[var(--invest-table-head)]">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-black uppercase tracking-[0.12em] text-[var(--invest-faint)]">
                    Data
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-black uppercase tracking-[0.12em] text-[var(--invest-faint)]">
                    Papel
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-black uppercase tracking-[0.12em] text-[var(--invest-faint)]">
                    Upload
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-black uppercase tracking-[0.12em] text-[var(--invest-faint)]">
                    Cidade
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-black uppercase tracking-[0.12em] text-[var(--invest-faint)]">
                    Resumo
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-black uppercase tracking-[0.12em] text-[var(--invest-faint)]">
                    Valor
                  </th>
                </tr>
              </thead>
              <tbody>
                {loadingAppearances ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-5">
                      <SkeletonBlock lines={4} />
                    </td>
                  </tr>
                ) : appearancesError ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-5 text-sm font-bold text-[var(--invest-danger)]">
                      {appearancesError}
                    </td>
                  </tr>
                ) : !appearances || appearances.items.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-5 text-sm text-[var(--invest-muted)]">
                      Nenhuma aparição encontrada com os filtros atuais. Tente limpar o upload, a categoria ou o papel acima.
                    </td>
                  </tr>
                ) : (
                  appearances.items.map((item) => (
                    <tr key={item.record_id} className="border-t border-[var(--invest-border)] align-top">
                      <td className="px-4 py-4 text-sm text-[var(--invest-heading)]">{item.data || "-"}</td>
                      <td className="px-4 py-4 text-sm text-[var(--invest-heading)]">{humanRole(item.role_in_record)}</td>
                      <td className="px-4 py-4 text-sm text-[var(--invest-muted)]">
                        <p className="font-bold text-[var(--invest-heading)]">{item.file_name || "Arquivo"}</p>
                        <p className="mt-1 text-xs">{item.category || "categoria"}</p>
                      </td>
                      <td className="px-4 py-4 text-sm text-[var(--invest-muted)]">
                        {item.city_name ? `${item.city_name}${item.state ? `/${item.state}` : ""}` : "-"}
                      </td>
                      <td className="px-4 py-4 text-sm leading-6 text-[var(--invest-muted)]">{item.summary}</td>
                      <td className="px-4 py-4 text-right text-sm font-bold text-[var(--invest-heading)]">
                        {formatMoney(item.valor_bruto || 0)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-[var(--invest-muted)]">
            Página {appearances?.page || 1} de {totalPages}
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              className="invest-button-secondary px-4"
              disabled={(appearances?.page || 1) <= 1}
              onClick={() => setAppearancesPage((current) => Math.max(1, current - 1))}
            >
              Anterior
            </button>
            <button
              type="button"
              className="invest-button-secondary px-4"
              disabled={(appearances?.page || 1) >= totalPages}
              onClick={() => setAppearancesPage((current) => current + 1)}
            >
              Próxima
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}
