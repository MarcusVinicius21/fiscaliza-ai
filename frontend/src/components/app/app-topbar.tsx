"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSidebar } from "./sidebar-context";

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

function SidebarToggleIcon({ collapsed }: { collapsed: boolean }) {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 18 18"
      fill="none"
      aria-hidden="true"
      xmlns="http://www.w3.org/2000/svg"
    >
      {/* Outer panel border */}
      <rect
        x="1.5"
        y="1.5"
        width="15"
        height="15"
        rx="2.5"
        stroke="currentColor"
        strokeWidth="1.4"
      />
      {/* Vertical divider — the "sidebar" */}
      <line
        x1="6"
        y1="1.5"
        x2="6"
        y2="16.5"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
      />
      {/* Arrow chevron that flips direction via transform */}
      <g
        style={{
          transformOrigin: "11px 9px",
          transform: collapsed ? "scaleX(-1)" : "scaleX(1)",
          transition: "transform 300ms cubic-bezier(0.4, 0, 0.2, 1)",
        }}
      >
        <path
          d="M12.5 6.5L10 9L12.5 11.5"
          stroke="currentColor"
          strokeWidth="1.4"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </g>
    </svg>
  );
}

export function AppTopbar() {
  const pathname = usePathname();
  const firstSegment = pathname.split("/").filter(Boolean)[0] || "dashboard";
  const meta = pageMeta[firstSegment] || pageMeta.dashboard;
  const { collapsed, toggle } = useSidebar();

  return (
    <header className="sticky top-0 z-30 border-b border-[var(--invest-border)] bg-white/92 px-4 py-3 backdrop-blur-xl sm:px-6 lg:px-8 xl:px-10">
      <div className="mx-auto flex w-full max-w-[1500px] items-center justify-between gap-4">
        <div className="flex min-w-0 items-center gap-3">
          {/* Sidebar toggle — visible only on lg+ where sidebar exists */}
          <button
            type="button"
            onClick={toggle}
            aria-label={collapsed ? "Expandir menu lateral" : "Ocultar menu lateral"}
            title={collapsed ? "Expandir menu lateral" : "Ocultar menu lateral"}
            className="hidden h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-[var(--invest-border)] bg-white text-[var(--invest-muted)] transition duration-200 hover:border-[var(--invest-primary)] hover:bg-[#f2f5ff] hover:text-[var(--invest-primary)] focus:outline-none focus:ring-4 focus:ring-blue-100 lg:flex"
          >
            <SidebarToggleIcon collapsed={collapsed} />
          </button>

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
