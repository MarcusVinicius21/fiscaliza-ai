"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const pageMeta: Record<string, { title: string; note: string }> = {
  dashboard: {
    title: "Dashboard",
    note: "Veja primeiro o que mais chama atenção.",
  },
  uploads: {
    title: "Enviar arquivo",
    note: "Importe dados com categoria clara.",
  },
  records: {
    title: "Linhas",
    note: "Consulte os registros carregados e seus vínculos com alertas.",
  },
  alerts: {
    title: "Alertas",
    note: "Filtre sinais que exigem explicação.",
  },
  creatives: {
    title: "Artes",
    note: "Comunique achados com rastreabilidade.",
  },
  clients: {
    title: "Clientes",
    note: "Organize responsáveis locais.",
  },
  cities: {
    title: "Cidades",
    note: "Mantenha bases monitoradas.",
  },
};

export function AppTopbar() {
  const pathname = usePathname();
  const firstSegment = pathname.split("/").filter(Boolean)[0] || "dashboard";
  const meta = pageMeta[firstSegment] || pageMeta.dashboard;

  return (
    <header className="sticky top-0 z-30 border-b border-[var(--invest-border)] bg-white/92 px-4 py-3 backdrop-blur-xl sm:px-6 lg:px-8 xl:px-10">
      <div className="mx-auto flex w-full max-w-[1500px] items-center justify-between gap-4">
        <div className="min-w-0">
          <Link
            href="/dashboard"
            className="mb-1 block text-sm font-black text-[var(--invest-primary)] lg:hidden"
          >
            fiscaliza.ai
          </Link>
          <p className="text-xs font-black uppercase tracking-[0.14em] text-[var(--invest-primary)]">
            Fiscaliza.AI
          </p>
          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1">
            <h2 className="truncate text-base font-black text-[var(--invest-heading)] sm:text-lg">
              {meta.title}
            </h2>
            <span className="hidden h-1 w-1 rounded-full bg-[var(--invest-faint)] sm:block" />
            <p className="truncate text-sm text-[var(--invest-muted)]">
              {meta.note}
            </p>
          </div>
        </div>

        <div className="hidden items-center gap-3 rounded-lg border border-[var(--invest-border)] bg-[#f8fafc] px-3 py-2 md:flex">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[var(--invest-primary)] text-sm font-black text-white">
            U
          </div>
          <div>
            <p className="text-sm font-bold text-[var(--invest-heading)]">
              Usuário técnico
            </p>
            <p className="text-xs text-[var(--invest-muted)]">Sessão local</p>
          </div>
        </div>
      </div>
    </header>
  );
}
