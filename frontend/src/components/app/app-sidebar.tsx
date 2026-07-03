"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSidebar } from "./sidebar-context";

type SidebarIconName =
  | "dashboard"
  | "upload"
  | "search"
  | "investigation"
  | "records"
  | "alerts"
  | "contracts"
  | "bids"
  | "payments"
  | "creatives"
  | "clients"
  | "cities";

interface SidebarItem {
  href: string;
  label: string;
  description: string;
  icon: SidebarIconName;
}

const navGroups = [
  {
    title: "Investigar",
    items: [
      { href: "/dashboard", label: "Dashboard", description: "Visao geral", icon: "dashboard" },
      { href: "/uploads", label: "Uploads", description: "Importar dados", icon: "upload" },
      { href: "/search", label: "Busca", description: "Pessoas e fornecedores", icon: "search" },
      { href: "/fornecedores", label: "Fornecedores", description: "Quem aparece", icon: "search" },
      { href: "/investigacoes", label: "Investigacoes", description: "Pessoas e fornecedores", icon: "investigation" },
      { href: "/records", label: "Linhas", description: "Base carregada", icon: "records" },
      { href: "/alerts", label: "Alertas", description: "O que exige atencao", icon: "alerts" },
    ],
  },
  {
    title: "Caminho do gasto",
    items: [
      { href: "/contratos", label: "Contratos", description: "Contratos encontrados", icon: "contracts" },
      { href: "/licitacoes", label: "Licitacoes", description: "Licitacoes encontradas", icon: "bids" },
      { href: "/pagamentos", label: "Pagamentos", description: "Pagamentos encontrados", icon: "payments" },
    ],
  },
  {
    title: "Comunicar",
    items: [
      { href: "/creatives", label: "Artes", description: "Relatorios e artes", icon: "creatives" },
    ],
  },
  {
    title: "Organizar",
    items: [
      { href: "/clients", label: "Clientes", description: "Responsaveis", icon: "clients" },
      { href: "/cities", label: "Cidades", description: "Cidades acompanhadas", icon: "cities" },
    ],
  },
] satisfies Array<{ title: string; items: SidebarItem[] }>;

function SidebarIcon({ name }: { name: SidebarIconName }) {
  const common = {
    width: 18,
    height: 18,
    viewBox: "0 0 24 24",
    fill: "none",
    "aria-hidden": true,
    xmlns: "http://www.w3.org/2000/svg",
  };

  switch (name) {
    case "dashboard":
      return (
        <svg {...common}>
          <path d="M4 13h6V4H4v9ZM14 20h6V4h-6v16ZM4 20h6v-3H4v3Z" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      );
    case "upload":
      return (
        <svg {...common}>
          <path d="M12 16V5M8 9l4-4 4 4M5 19h14" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      );
    case "search":
      return (
        <svg {...common}>
          <circle cx="11" cy="11" r="6" stroke="currentColor" strokeWidth="1.8" />
          <path d="M16 16l4 4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        </svg>
      );
    case "investigation":
      return (
        <svg {...common}>
          <path d="M12 12a4 4 0 1 0-4-4 4 4 0 0 0 4 4ZM4 21a8 8 0 0 1 16 0" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        </svg>
      );
    case "records":
      return (
        <svg {...common}>
          <path d="M7 5h10M7 12h10M7 19h10M4 5h.01M4 12h.01M4 19h.01" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        </svg>
      );
    case "alerts":
      return (
        <svg {...common}>
          <path d="M12 3 3 20h18L12 3Z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
          <path d="M12 9v4M12 17h.01" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        </svg>
      );
    case "contracts":
      return (
        <svg {...common}>
          <path d="M7 3h7l4 4v14H7V3Z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
          <path d="M14 3v5h5M9 13h6M9 17h6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        </svg>
      );
    case "bids":
      return (
        <svg {...common}>
          <path d="M6 20h12M8 16h8M9 4h6l2 5H7l2-5ZM7 9v7h10V9" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      );
    case "payments":
      return (
        <svg {...common}>
          <path d="M4 7h16v10H4V7Z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
          <path d="M8 12h.01M16 12h.01M12 9v6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        </svg>
      );
    case "creatives":
      return (
        <svg {...common}>
          <path d="M4 16s3-8 8-8 8 8 8 8M8 16a4 4 0 0 0 8 0" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
          <circle cx="12" cy="12" r="2" stroke="currentColor" strokeWidth="1.8" />
        </svg>
      );
    case "clients":
      return (
        <svg {...common}>
          <path d="M8 11a4 4 0 1 1 8 0M4 21a8 8 0 0 1 16 0" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        </svg>
      );
    case "cities":
      return (
        <svg {...common}>
          <path d="M4 21V8l5-3 5 3v13M14 21V11l6-3v13M7 12h2M7 16h2M16 14h2M16 18h2" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      );
    default:
      return null;
  }
}

export function AppSidebar() {
  const pathname = usePathname();
  const { collapsed } = useSidebar();

  return (
    <aside
      style={{
        width: collapsed ? 0 : 268,
        transition: "width 300ms cubic-bezier(0.4, 0, 0.2, 1)",
      }}
      className="fiscaliza-sidebar-light hidden min-h-dvh shrink-0 overflow-hidden border-r border-[var(--invest-border)] bg-[var(--invest-surface)] shadow-[var(--invest-shadow-soft)] lg:flex lg:flex-col"
    >
      <div
        style={{
          opacity: collapsed ? 0 : 1,
          transform: collapsed ? "translateX(-12px)" : "translateX(0)",
          transition: collapsed
            ? "opacity 150ms ease, transform 150ms ease"
            : "opacity 200ms ease 120ms, transform 200ms ease 120ms",
          minWidth: 268,
        }}
        className="flex flex-1 flex-col px-4 py-5"
      >
        <Link
          href="/dashboard"
          className="block rounded-lg border border-transparent px-2 py-2"
        >
          <div className="text-2xl font-black tracking-tight text-[var(--invest-primary)]">
            fiscaliza<span className="text-[var(--invest-heading)]">.ai</span>
          </div>
          <p className="mt-2 text-xs font-semibold leading-5 text-[var(--invest-muted)]">
            Plataforma clara para ler dados publicos, explicar alertas e guardar a origem.
          </p>
        </Link>

        <nav className="mt-8 space-y-7">
          {navGroups.map((group) => (
            <div key={group.title}>
              <p className="mb-2 px-3 text-[0.68rem] font-black uppercase tracking-[0.14em] text-[var(--invest-faint)]">
                {group.title}
              </p>
              <div className="space-y-1.5">
                {group.items.map((item) => {
                  const active =
                    pathname === item.href ||
                    pathname.startsWith(`${item.href}/`);

                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={[
                        "group grid grid-cols-[34px_minmax(0,1fr)] items-center gap-3 rounded-xl border px-3 py-2.5 transition duration-200",
                        active
                          ? "border-blue-200 bg-blue-50 text-[var(--invest-heading)] shadow-[0_10px_22px_rgba(49,92,255,0.08)]"
                          : "border-transparent text-[var(--invest-muted)] hover:border-blue-100 hover:bg-blue-50/70",
                      ].join(" ")}
                    >
                      <span
                        className={[
                          "flex h-8 w-8 shrink-0 items-center justify-center rounded-xl text-xs font-black transition",
                          active
                            ? "bg-[var(--invest-primary)] text-white"
                            : "bg-blue-50 text-blue-600 group-hover:bg-white group-hover:text-[var(--invest-primary)]",
                        ].join(" ")}
                      >
                        <SidebarIcon name={item.icon} />
                      </span>
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-extrabold">
                          {item.label}
                        </span>
                        <span className="block truncate text-xs text-[var(--invest-muted)]">
                          {item.description}
                        </span>
                      </span>
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        <div className="mt-auto rounded-lg border border-[var(--invest-border)] bg-[var(--invest-surface-soft)] p-4">
          <p className="text-sm font-black text-[var(--invest-heading)]">
            Regra de leitura
          </p>
          <p className="mt-2 text-xs leading-5 text-[var(--invest-muted)]">
            O sistema aponta sinais para conferir. A conclusao depende de uma pessoa e dos documentos.
          </p>
        </div>
      </div>
    </aside>
  );
}
