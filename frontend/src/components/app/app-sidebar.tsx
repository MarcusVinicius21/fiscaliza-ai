"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSidebar } from "./sidebar-context";

const navGroups = [
  {
    title: "Investigar",
    items: [
      { href: "/dashboard", label: "Dashboard", description: "Visão geral", mark: "D" },
      { href: "/uploads", label: "Uploads", description: "Importar dados", mark: "U" },
      { href: "/search", label: "Busca", description: "Entidades e documentos", mark: "B" },
      { href: "/records", label: "Linhas", description: "Base carregada", mark: "L" },
      { href: "/alerts", label: "Alertas", description: "O que exige atenção", mark: "A" },
    ],
  },
  {
    title: "Comunicar",
    items: [
      { href: "/creatives", label: "Artes", description: "Peças públicas", mark: "P" },
    ],
  },
  {
    title: "Organizar",
    items: [
      { href: "/clients", label: "Clientes", description: "Responsáveis", mark: "C" },
      { href: "/cities", label: "Cidades", description: "Bases monitoradas", mark: "M" },
    ],
  },
];

export function AppSidebar() {
  const pathname = usePathname();
  const { collapsed } = useSidebar();

  return (
    <aside
      style={{
        width: collapsed ? 0 : 268,
        transition: "width 300ms cubic-bezier(0.4, 0, 0.2, 1)",
      }}
      className="hidden shrink-0 overflow-hidden min-h-dvh border-r border-[var(--invest-border)] bg-[var(--invest-surface)] shadow-[var(--invest-shadow-soft)] lg:flex lg:flex-col"
    >
      {/* Inner wrapper fades out slightly faster than the width closes */}
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
            Plataforma clara para ler dados públicos, explicar alertas e preservar provas.
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
                        "group grid grid-cols-[34px_minmax(0,1fr)] items-center gap-3 rounded-lg border px-3 py-2.5 transition duration-200",
                        active
                          ? "border-[rgba(49,92,255,0.34)] bg-[var(--invest-surface-soft)] text-[var(--invest-heading)] shadow-[0_10px_22px_rgba(49,92,255,0.08)]"
                          : "border-transparent text-[var(--invest-muted)] hover:border-[var(--invest-border)] hover:bg-[var(--invest-surface-soft)]",
                      ].join(" ")}
                    >
                      <span
                        className={[
                          "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-xs font-black",
                          active
                            ? "bg-[var(--invest-primary)] text-white"
                            : "bg-[var(--invest-surface-soft)] text-[var(--invest-muted)] group-hover:text-[var(--invest-heading)]",
                        ].join(" ")}
                      >
                        {item.mark}
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
            Alerta não é condenação. É um sinal que precisa de explicação, prova
            e checagem humana.
          </p>
        </div>
      </div>
    </aside>
  );
}
