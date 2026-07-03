"use client";

import { StatusPill } from "@/components/app/status-pill";

type Tone = "info" | "warning" | "muted" | "success" | "danger";

export interface MetricItem {
  label: string;
  value: string | number;
  hint?: string;
  tone?: Tone;
}

export interface RankingItem {
  name: string;
  document?: string | null;
  amount?: number;
  count?: number;
  href?: string;
}

export interface SupportRecordItem {
  id: string;
  file_name?: string | null;
  category?: string | null;
  date?: string | null;
  amount?: number;
  supplier?: string | null;
  summary?: string | null;
}

export function formatCurrency(value: number | null | undefined) {
  if (typeof value !== "number" || Number.isNaN(value)) return "não informado";
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export function ExecutiveSummaryPanel({
  title,
  body,
  points,
}: {
  title: string;
  body: string;
  points: string[];
}) {
  return (
    <section className="invest-card p-5 sm:p-6">
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div>
          <p className="invest-eyebrow">Resumo executivo</p>
          <h2 className="mt-2 text-xl font-black text-[var(--invest-heading)]">{title}</h2>
          <p className="mt-3 text-sm leading-6 text-[var(--invest-muted)]">{body}</p>
        </div>
        <div className="space-y-2">
          {points.map((point) => (
            <div key={point} className="invest-card-solid px-4 py-3">
              <p className="text-sm font-bold leading-6 text-[var(--invest-heading)]">{point}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

export function DiagnosticCard({ title, items }: { title: string; items: MetricItem[] }) {
  return (
    <section className="invest-card p-5 sm:p-6">
      <p className="invest-section-title">{title}</p>
      <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {items.map((item) => (
          <article key={item.label} className="invest-card-highlight p-4">
            <p className="text-xs font-black uppercase tracking-[0.12em] text-[var(--invest-faint)]">
              {item.label}
            </p>
            <p className="mt-2 text-lg font-black text-[var(--invest-heading)]">{item.value}</p>
            {item.hint ? <p className="mt-2 text-xs leading-5 text-[var(--invest-muted)]">{item.hint}</p> : null}
            {item.tone ? (
              <div className="mt-3">
                <StatusPill tone={item.tone}>{item.tone === "warning" ? "ponto de atenção" : item.tone}</StatusPill>
              </div>
            ) : null}
          </article>
        ))}
      </div>
    </section>
  );
}

export function SupplierRanking({ title, items }: { title: string; items: RankingItem[] }) {
  return (
    <section className="invest-card p-5 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="invest-section-title">{title}</p>
          <p className="mt-1 text-sm text-[var(--invest-muted)]">Concentração observada no acervo atual.</p>
        </div>
        <StatusPill tone="muted">{items.length} item(ns)</StatusPill>
      </div>
      <div className="mt-4 space-y-3">
        {items.length === 0 ? (
          <EmptyStateWithReason reason="Não há fornecedor suficiente para montar ranking neste recorte." />
        ) : (
          items.map((item, index) => (
            <article key={`${item.name}-${index}`} className="invest-card-solid p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-black text-[var(--invest-heading)]">
                    {index + 1}. {item.name || "Fornecedor não informado"}
                  </p>
                  <p className="mt-1 text-xs text-[var(--invest-muted)]">{item.document || "documento não informado"}</p>
                </div>
                <div className="text-right text-sm">
                  <p className="font-black text-[var(--invest-heading)]">{formatCurrency(item.amount || 0)}</p>
                  <p className="mt-1 text-xs text-[var(--invest-muted)]">{item.count || 0} ocorrência(s)</p>
                </div>
              </div>
            </article>
          ))
        )}
      </div>
    </section>
  );
}

export function FactLinkStatusSummary({
  contracts,
  payments,
  bids,
}: {
  contracts: { total: number; unlinked: number };
  payments: { total: number; unlinked: number };
  bids: { total: number; unlinked: number };
}) {
  const hasMissingLinks = contracts.unlinked > 0 || payments.unlinked > 0 || bids.total === 0;
  return (
    <section className="invest-card p-5 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="invest-section-title">Status das ligações encontradas</p>
          <p className="mt-1 text-sm text-[var(--invest-muted)]">
            Quando não encontramos ligação automática, pode faltar informação no arquivo ou uma base relacionada ainda não foi carregada.
          </p>
        </div>
        <StatusPill tone={hasMissingLinks ? "warning" : "success"}>
          {hasMissingLinks ? "precisa de conferência" : "ligações encontradas"}
        </StatusPill>
      </div>
      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        <div className="invest-card-solid p-4">
          <p className="metric-label">Contratos</p>
          <p className="metric-value mt-2">{contracts.total}</p>
          <p className="mt-1 text-xs text-[var(--invest-muted)]">{contracts.unlinked} sem licitação ligada automaticamente</p>
        </div>
        <div className="invest-card-solid p-4">
          <p className="metric-label">Pagamentos</p>
          <p className="metric-value mt-2">{payments.total}</p>
          <p className="mt-1 text-xs text-[var(--invest-muted)]">{payments.unlinked} sem contrato ligado automaticamente</p>
        </div>
        <div className="invest-card-solid p-4">
          <p className="metric-label">Licitações</p>
          <p className="metric-value mt-2">{bids.total}</p>
          <p className="mt-1 text-xs text-[var(--invest-muted)]">{bids.total === 0 ? "arquivo de licitações adiado" : `${bids.unlinked} sem ligação`}</p>
        </div>
      </div>
    </section>
  );
}

export function AttentionPointCard({ title, body, tone = "warning" }: { title: string; body: string; tone?: Tone }) {
  return (
    <article className="evidence-card p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm font-black text-[var(--invest-heading)]">{title}</p>
          <p className="mt-2 text-sm leading-6 text-[var(--invest-muted)]">{body}</p>
        </div>
        <StatusPill tone={tone}>ponto de atenção</StatusPill>
      </div>
    </article>
  );
}

export function SupportRecordsTable({ records }: { records: SupportRecordItem[] }) {
  return (
    <section className="invest-card p-5 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="invest-section-title">Linhas de apoio</p>
          <p className="mt-1 text-sm text-[var(--invest-muted)]">
            Amostra das linhas usadas para contextualizar o recorte. Nao substitui conferencia documental.
          </p>
        </div>
        <StatusPill tone="muted">{records.length} linha(s)</StatusPill>
      </div>
      <div className="mt-4 overflow-x-auto">
        <table className="invest-table min-w-[820px]">
          <thead>
            <tr>
              <th>Origem</th>
              <th>Categoria</th>
              <th>Fornecedor</th>
              <th>Data</th>
              <th>Valor</th>
              <th>Resumo</th>
            </tr>
          </thead>
          <tbody>
            {records.length === 0 ? (
              <tr>
                <td colSpan={6}>Nenhuma linha de apoio disponivel neste recorte.</td>
              </tr>
            ) : (
              records.map((record) => (
                <tr key={record.id}>
                  <td>{record.file_name || "arquivo atual"}</td>
                  <td>{record.category || "nao informado"}</td>
                  <td>{record.supplier || "nao informado"}</td>
                  <td>{record.date || "nao informado"}</td>
                  <td>{formatCurrency(record.amount || 0)}</td>
                  <td>{record.summary || "nao informado"}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}

export function EmptyStateWithReason({ reason }: { reason: string }) {
  return (
    <div className="rounded-lg border border-dashed border-[var(--invest-border-strong)] bg-[var(--invest-surface-soft)] p-4">
      <p className="text-sm leading-6 text-[var(--invest-muted)]">{reason}</p>
    </div>
  );
}

export function PrintReportLayout({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children: React.ReactNode;
}) {
  return (
    <div className="page-shell report-shell print:bg-white">
      <section className="page-header report-cover px-5 py-5 sm:px-6 print:border-0 print:shadow-none">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="invest-eyebrow">Relatório para imprimir</p>
            <h1 className="invest-title mt-3 text-2xl sm:text-[2rem]">{title}</h1>
            <p className="invest-subtitle mt-3 text-sm sm:text-base">{subtitle}</p>
          </div>
          <button type="button" className="invest-button no-print px-4 py-2 print:hidden" onClick={() => window.print()}>
            Imprimir / Salvar como PDF
          </button>
        </div>
      </section>
      {children}
    </div>
  );
}
