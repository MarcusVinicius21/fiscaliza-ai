"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { StatusPill } from "@/components/app/status-pill";
import { SkeletonBlock } from "@/components/app/skeleton-block";
import { supabase } from "@/lib/supabase";

interface AlertRecord {
  id: string;
  upload_id: string;
  city_id?: string | null;
  category?: string | null;
  report_type?: string | null;
  report_label?: string | null;
  title: string;
  explanation?: string | null;
  severity?: string | null;
  amount?: number | string | null;
  supplier_name?: string | null;
  created_at?: string | null;
  cities?: { name: string; state: string } | null;
}

type StatusTone = "info" | "danger" | "success" | "muted" | "warning";

function parseAmount(value: unknown) {
  if (value === null || value === undefined || value === "") return 0;
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;

  const normalized = String(value)
    .replace("R$", "")
    .replace(/\s/g, "")
    .replace(/\./g, "")
    .replace(",", ".");

  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
}

function formatMoney(value: number) {
  return value.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

function formatDate(value?: string | null) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleDateString("pt-BR");
}

function categoryLabel(value: string | null | undefined) {
  const map: Record<string, string> = {
    payroll: "Pessoal / RH",
    contracts: "Contratos",
    expenses: "Despesas / Pagamentos",
    bids: "Licitações",
    others: "Outros",
  };

  return map[String(value || "")] || String(value || "Não informado");
}

function severityTone(severity?: string | null): StatusTone {
  const sev = String(severity || "").toLowerCase();

  if (sev.includes("alta")) return "danger";
  if (sev.includes("media") || sev.includes("média")) return "warning";

  return "info";
}

export default function AlertsPage() {
  const [alerts, setAlerts] = useState<AlertRecord[]>([]);
  const [severityFilter, setSeverityFilter] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    fetchAlerts();
  }, []);

  async function fetchAlerts() {
    setLoading(true);
    setErrorMessage("");

    try {
      const { data, error } = await supabase
        .from("alerts")
        .select("id, upload_id, city_id, category, report_type, report_label, title, explanation, severity, amount, supplier_name, created_at, cities(name, state)")
        .order("created_at", { ascending: false })
        .limit(500);

      if (error) throw new Error(error.message);

      setAlerts((data as unknown as AlertRecord[]) || []);
    } catch (error: unknown) {
      setErrorMessage(
        error instanceof Error ? error.message : "Falha ao carregar alertas."
      );
    } finally {
      setLoading(false);
    }
  }

  const categories = useMemo(() => {
    return Array.from(
      new Set(alerts.map((item) => item.category).filter(Boolean))
    ) as string[];
  }, [alerts]);

  const filteredAlerts = useMemo(() => {
    return alerts.filter((alert) => {
      const matchSeverity =
        !severityFilter || alert.severity === severityFilter;

      const matchCategory =
        !categoryFilter || alert.category === categoryFilter;

      const haystack = [
        alert.title,
        alert.explanation,
        alert.supplier_name,
        alert.report_type,
        alert.report_label,
      ]
        .join(" ")
        .toLowerCase();

      const matchSearch = !search || haystack.includes(search.toLowerCase());

      return matchSeverity && matchCategory && matchSearch;
    });
  }, [alerts, severityFilter, categoryFilter, search]);

  const highCount = alerts.filter((alert) =>
    String(alert.severity || "").toLowerCase().includes("alta")
  ).length;

  const totalAmount = alerts.reduce(
    (sum, alert) => sum + parseAmount(alert.amount),
    0
  );

  const topAlert = filteredAlerts
    .slice()
    .sort((a, b) => parseAmount(b.amount) - parseAmount(a.amount))[0];

  if (loading) {
    return (
      <div className="page-shell">
        <section className="page-header p-6">
          <p className="invest-eyebrow">Alertas</p>
          <h1 className="invest-title mt-3 text-3xl">Carregando sinais</h1>
          <div className="mt-6 max-w-xl">
            <SkeletonBlock lines={4} />
          </div>
        </section>
      </div>
    );
  }

  return (
    <div className="page-shell">
      <section className="page-header p-6 md:p-8">
        <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_440px]">
          <div>
            <p className="invest-eyebrow">Fila de alertas</p>
            <h1 className="invest-title mt-3 max-w-4xl text-3xl md:text-5xl">
              Veja primeiro o que exige explicação.
            </h1>
            <p className="invest-subtitle mt-4 max-w-3xl text-base">
              Os alertas vêm da Etapa 5. Esta página organiza a leitura sem
              afirmar crime e sem recalcular análise.
            </p>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="metric-card">
              <p className="metric-label">Total</p>
              <p className="metric-value mt-3">{alerts.length}</p>
            </div>
            <div className="metric-card">
              <p className="metric-label">Filtrados</p>
              <p className="metric-value mt-3">{filteredAlerts.length}</p>
            </div>
            <div className="metric-card">
              <p className="metric-label">Alta</p>
              <p className="metric-value mt-3">{highCount}</p>
            </div>
          </div>
        </div>
      </section>

      {errorMessage && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {errorMessage}
        </div>
      )}

      <section className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="rounded-lg border border-[var(--invest-border)] bg-white p-4 shadow-[var(--invest-shadow-soft)]">
          <div className="grid grid-cols-1 gap-3 lg:grid-cols-[minmax(0,1fr)_220px_220px]">
            <div>
              <label className="invest-label">Buscar</label>
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Título, explicação ou fornecedor"
                className="invest-input"
              />
            </div>

            <div>
              <label className="invest-label">Severidade</label>
              <select
                value={severityFilter}
                onChange={(e) => setSeverityFilter(e.target.value)}
                className="invest-select"
              >
                <option value="">Todas</option>
                <option value="alta">Alta</option>
                <option value="media">Média</option>
                <option value="baixa">Baixa</option>
              </select>
            </div>

            <div>
              <label className="invest-label">Categoria</label>
              <select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                className="invest-select"
              >
                <option value="">Todas</option>
                {categories.map((item) => (
                  <option key={item} value={item}>
                    {categoryLabel(item)}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        <aside className="rounded-lg border border-[var(--invest-border)] bg-white p-5 shadow-[var(--invest-shadow-soft)]">
          <p className="invest-eyebrow">Maior valor filtrado</p>
          <h2 className="mt-2 text-lg font-black text-[var(--invest-heading)]">
            {topAlert?.title || "Nenhum alerta no filtro"}
          </h2>
          <p className="invest-number mt-4 text-3xl font-black text-[var(--invest-heading)]">
            {formatMoney(parseAmount(topAlert?.amount))}
          </p>
          <p className="mt-3 text-sm text-[var(--invest-muted)]">
            Total bruto nos alertas carregados: {formatMoney(totalAmount)}.
          </p>
        </aside>
      </section>

      <section className="grid grid-cols-1 gap-4">
        {filteredAlerts.map((alert) => (
          <article
            key={alert.id}
            className="group grid gap-5 rounded-lg border border-[var(--invest-border)] bg-white p-5 shadow-[var(--invest-shadow-soft)] transition duration-200 hover:border-[rgba(49,92,255,0.32)] hover:shadow-[var(--invest-shadow)] xl:grid-cols-[180px_minmax(0,1fr)_230px]"
          >
            <div className="space-y-3">
              <StatusPill tone={severityTone(alert.severity)}>
                {alert.severity || "baixa"}
              </StatusPill>
              <div className="space-y-2 text-xs text-[var(--invest-muted)]">
                <p>{categoryLabel(alert.category)}</p>
                <p>{formatDate(alert.created_at)}</p>
                {alert.cities?.name && (
                  <p>
                    {alert.cities.name}/{alert.cities.state}
                  </p>
                )}
              </div>
            </div>

            <div>
              <h2 className="text-xl font-black leading-tight text-[var(--invest-heading)]">
                {alert.title}
              </h2>

              <p className="mt-3 max-w-4xl text-sm leading-7 text-[var(--invest-muted)]">
                {alert.explanation || "Sem explicação registrada."}
              </p>

              <div className="mt-4 flex flex-wrap gap-2">
                <span className="app-chip">
                  Fornecedor: {alert.supplier_name || "Não informado"}
                </span>
                <span className="app-chip">
                  Documento: {alert.report_type || alert.report_label || "Não informado"}
                </span>
              </div>
            </div>

            <div className="flex flex-col items-start justify-between gap-4 xl:items-end">
              <p className="invest-number text-2xl font-black text-[var(--invest-heading)]">
                {formatMoney(parseAmount(alert.amount))}
              </p>
              <Link
                href={`/alerts/${alert.id}`}
                className="invest-button-secondary px-4 py-2 text-sm"
              >
                Ver detalhe
              </Link>
            </div>
          </article>
        ))}

        {filteredAlerts.length === 0 && (
          <div className="rounded-lg border border-[var(--invest-border)] bg-white p-8 text-center text-sm text-[var(--invest-muted)]">
            Nenhum alerta encontrado para os filtros atuais.
          </div>
        )}
      </section>
    </div>
  );
}
