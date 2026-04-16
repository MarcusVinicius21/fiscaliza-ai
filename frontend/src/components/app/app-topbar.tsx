"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const pageMeta: Record<string, { eyebrow: string; title: string; note: string }> = {
  dashboard: {
    eyebrow: "Painel executivo",
    title: "Centro de leitura investigativa",
    note: "Acompanhe uploads, análises e alertas com rastreabilidade.",
  },
  uploads: {
    eyebrow: "Entrada de dados",
    title: "Wizard de upload público",
    note: "Envie bases com contexto e preserve o ETL validado.",
  },
  alerts: {
    eyebrow: "Evidências",
    title: "Fila de pontos de atenção",
    note: "Filtre, abra detalhes e mantenha leitura responsável.",
  },
  creatives: {
    eyebrow: "Comunicação",
    title: "Ateliê de artes públicas",
    note: "Transforme alertas validados em peças rastreáveis.",
  },
  clients: {
    eyebrow: "Gestão local",
    title: "Carteira institucional",
    note: "Organize responsáveis e bases monitoradas.",
  },
  cities: {
    eyebrow: "Territórios",
    title: "Cidades monitoradas",
    note: "Mantenha portais e vínculos prontos para importação.",
  },
};

export function AppTopbar() {
  const pathname = usePathname();
  const firstSegment = pathname.split("/").filter(Boolean)[0] || "dashboard";
  const meta = pageMeta[firstSegment] || pageMeta.dashboard;

  return (
    <header className="sticky top-0 z-30 border-b border-[var(--invest-border)] bg-[#070a0f]/82 px-4 py-3 backdrop-blur-xl sm:px-6 lg:px-8 xl:px-10">
      <div className="mx-auto flex w-full max-w-[1540px] items-center justify-between gap-4">
        <div className="min-w-0">
          <Link href="/dashboard" className="mb-2 block text-sm font-black text-white lg:hidden">
            Fiscaliza.AI
          </Link>
          <p className="invest-eyebrow">{meta.eyebrow}</p>
          <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1">
            <h2 className="truncate text-base font-black text-white sm:text-lg">
              {meta.title}
            </h2>
            <span className="hidden h-1 w-1 rounded-full bg-[var(--invest-faint)] sm:block" />
            <p className="truncate text-sm text-[var(--invest-muted)]">
              {meta.note}
            </p>
          </div>
        </div>

        <div className="hidden min-w-[280px] items-center justify-between gap-3 rounded-lg border border-[var(--invest-border)] bg-[rgba(16,24,39,0.72)] px-3 py-2 shadow-[0_12px_34px_rgba(0,0,0,0.18)] md:flex">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.12em] text-[var(--invest-faint)]">
              Sessão local
            </p>
            <p className="text-sm font-bold text-white">Usuário técnico</p>
          </div>
          <div className="flex h-10 w-10 items-center justify-center rounded-md bg-[linear-gradient(135deg,#4EA8DE,#7DD3FC)] text-sm font-black text-[#06111c]">
            U
          </div>
        </div>
      </div>
    </header>
  );
}
