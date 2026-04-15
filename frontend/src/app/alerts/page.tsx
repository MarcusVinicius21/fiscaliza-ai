"use client";

import { useEffect, useMemo, useState } from "react";
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
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
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

function severityClass(severity?: string | null) {
  const sev = String(severity || "").toLowerCase();

  if (sev.includes("alta")) return "bg-red-50 text-red-700 border-red-200";
  if (sev.includes("media") || sev.includes("média")) {
    return "bg-yellow-50 text-yellow-700 border-yellow-200";
  }

  return "bg-blue-50 text-blue-700 border-blue-200";
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

      setAlerts((data as AlertRecord[]) || []);
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

  if (loading) {
    return (
      <div className="p-6">
        <p className="text-sm text-gray-600">Carregando alertas...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <h1 className="text-2xl font-bold text-gray-900">Alertas</h1>
        <p className="text-sm text-gray-600">
          Lista enxuta dos alertas gerados pela Etapa 5.
        </p>
      </header>

      {errorMessage && (
        <div className="border border-red-200 bg-red-50 p-4 rounded text-sm text-red-700">
          {errorMessage}
        </div>
      )}

      <section className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar por título, explicação ou fornecedor"
          className="border rounded px-3 py-2 text-sm md:col-span-2"
        />

        <select
          value={severityFilter}
          onChange={(e) => setSeverityFilter(e.target.value)}
          className="border rounded px-3 py-2 text-sm"
        >
          <option value="">Todas as severidades</option>
          <option value="alta">Alta</option>
          <option value="media">Média</option>
          <option value="baixa">Baixa</option>
        </select>

        <select
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
          className="border rounded px-3 py-2 text-sm"
        >
          <option value="">Todas as categorias</option>
          {categories.map((item) => (
            <option key={item} value={item}>
              {categoryLabel(item)}
            </option>
          ))}
        </select>
      </section>

      <section className="text-sm text-gray-500">
        Exibindo {filteredAlerts.length} de {alerts.length} alertas.
      </section>

      <section className="space-y-3">
        {filteredAlerts.map((alert) => (
          <article
            key={alert.id}
            className="bg-white border rounded p-4 space-y-2"
          >
            <div className="flex flex-wrap items-center gap-2">
              <span
                className={`border rounded px-2 py-1 text-xs ${severityClass(
                  alert.severity
                )}`}
              >
                {alert.severity || "baixa"}
              </span>

              <span className="text-xs text-gray-500">
                {categoryLabel(alert.category)}
              </span>

              <span className="text-xs text-gray-500">
                {formatDate(alert.created_at)}
              </span>

              {alert.cities?.name && (
                <span className="text-xs text-gray-500">
                  {alert.cities.name}/{alert.cities.state}
                </span>
              )}
            </div>

            <h2 className="font-semibold text-gray-900">{alert.title}</h2>

            <p className="text-sm text-gray-700">
              {alert.explanation || "Sem explicação registrada."}
            </p>

            <div className="text-sm text-gray-600 flex flex-wrap gap-4">
              <span>
                <strong>Fornecedor:</strong>{" "}
                {alert.supplier_name || "Não informado"}
              </span>

              <span>
                <strong>Valor:</strong> {formatMoney(parseAmount(alert.amount))}
              </span>

              <span>
                <strong>Relatório:</strong>{" "}
                {alert.report_type || alert.report_label || "Não informado"}
              </span>
            </div>
          </article>
        ))}

        {filteredAlerts.length === 0 && (
          <div className="bg-white border rounded p-6 text-sm text-gray-500">
            Nenhum alerta encontrado para os filtros atuais.
          </div>
        )}
      </section>
    </div>
  );
}
