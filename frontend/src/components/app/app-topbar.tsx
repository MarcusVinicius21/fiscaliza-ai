"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSidebar } from "./sidebar-context";
import { useTheme } from "./theme-context";

const pageMeta: Record<string, { title: string; note: string }> = {
  dashboard: {
    title: "Dashboard",
    note: "Veja primeiro o que mais chama atencao.",
  },
  uploads: {
    title: "Enviar arquivo",
    note: "Importe dados com categoria clara.",
  },
  search: {
    title: "Busca",
    note: "Procure fornecedores, pessoas, aliases e documentos.",
  },
  investigacoes: {
    title: "Investigacoes",
    note: "Cruze sinais tecnicos sem transformar hipotese em prova.",
  },
  contratos: {
    title: "Contratos",
    note: "Siga o contrato, a licitacao de origem e os pagamentos vinculados.",
  },
  licitacoes: {
    title: "Licitacoes",
    note: "Entenda a origem factual das contratacoes.",
  },
  pagamentos: {
    title: "Pagamentos",
    note: "Veja a execucao financeira e o contrato ligado.",
  },
  pessoas: {
    title: "Pessoa",
    note: "Veja aparicoes, papeis e cruzamentos desta entidade.",
  },
  records: {
    title: "Linhas",
    note: "Consulte os registros carregados e seus vinculos com alertas.",
  },
  alerts: {
    title: "Alertas",
    note: "Filtre sinais que exigem explicacao.",
  },
  creatives: {
    title: "Artes",
    note: "Comunique achados com rastreabilidade.",
  },
  clients: {
    title: "Clientes",
    note: "Organize responsaveis locais.",
  },
  cities: {
    title: "Cidades",
    note: "Mantenha bases monitoradas.",
  },
  fornecedores: {
    title: "Fornecedor",
    note: "Veja o historico consolidado desta entidade.",
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
      <rect
        x="1.5"
        y="1.5"
        width="15"
        height="15"
        rx="2.5"
        stroke="currentColor"
        strokeWidth="1.4"
      />
      <line
        x1="6"
        y1="1.5"
        x2="6"
        y2="16.5"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
      />
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

function ThemeToggleIcon({ dark }: { dark: boolean }) {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 18 18"
      fill="none"
      aria-hidden="true"
      xmlns="http://www.w3.org/2000/svg"
    >
      {dark ? (
        <path
          d="M14.42 11.22A6.1 6.1 0 0 1 6.78 3.58 6.1 6.1 0 1 0 14.42 11.22Z"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      ) : (
        <>
          <circle cx="9" cy="9" r="3.2" stroke="currentColor" strokeWidth="1.5" />
          <path
            d="M9 1.8V3.2M9 14.8V16.2M3.9 3.9L4.9 4.9M13.1 13.1L14.1 14.1M1.8 9H3.2M14.8 9H16.2M3.9 14.1L4.9 13.1M13.1 4.9L14.1 3.9"
            stroke="currentColor"
            strokeWidth="1.4"
            strokeLinecap="round"
          />
        </>
      )}
    </svg>
  );
}

export function AppTopbar() {
  const pathname = usePathname();
  const firstSegment = pathname.split("/").filter(Boolean)[0] || "dashboard";
  const meta = pageMeta[firstSegment] || pageMeta.dashboard;
  const { collapsed, toggle } = useSidebar();
  const { theme, mounted, toggleTheme } = useTheme();
  const isDark = theme === "dark";
  const themeButtonLabel = mounted
    ? isDark
      ? "Ativar modo claro"
      : "Ativar modo escuro"
    : "Alternar tema";

  return (
    <header className="sticky top-0 z-30 border-b border-[var(--invest-border)] bg-white/92 px-4 py-3 backdrop-blur-xl sm:px-6 lg:px-8 xl:px-10">
      <div className="mx-auto flex w-full max-w-[1500px] items-center justify-between gap-4">
        <div className="flex min-w-0 items-center gap-3">
          <button
            type="button"
            onClick={toggle}
            aria-label={collapsed ? "Expandir menu lateral" : "Ocultar menu lateral"}
            title={collapsed ? "Expandir menu lateral" : "Ocultar menu lateral"}
            className="hidden h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-[var(--invest-border)] bg-[var(--invest-surface)] text-[var(--invest-muted)] transition duration-200 hover:border-[var(--invest-primary)] hover:bg-[var(--invest-surface-soft)] hover:text-[var(--invest-primary)] focus:outline-none focus:ring-4 focus:ring-[var(--invest-focus-ring)] lg:flex"
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

        <div className="flex shrink-0 items-center gap-3">
          <button
            type="button"
            onClick={toggleTheme}
            aria-label={themeButtonLabel}
            title={themeButtonLabel}
            className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-[var(--invest-border)] bg-[var(--invest-surface)] text-[var(--invest-muted)] transition duration-200 hover:border-[var(--invest-primary)] hover:bg-[var(--invest-surface-soft)] hover:text-[var(--invest-primary)] focus:outline-none focus:ring-4 focus:ring-[var(--invest-focus-ring)]"
          >
            <ThemeToggleIcon dark={mounted ? isDark : false} />
          </button>
          <div className="hidden items-center gap-3 rounded-lg border border-[var(--invest-border)] bg-[var(--invest-surface-soft)] px-3 py-2 md:flex">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[var(--invest-primary)] text-sm font-black text-white">
              U
            </div>
            <div>
              <p className="text-sm font-bold text-[var(--invest-heading)]">
                Usuario tecnico
              </p>
              <p className="text-xs text-[var(--invest-muted)]">Sessao local</p>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
