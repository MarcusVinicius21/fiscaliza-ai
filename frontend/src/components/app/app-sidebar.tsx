"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const navGroups = [
  {
    title: "Operação",
    items: [
      { href: "/dashboard", label: "Dashboard", description: "Sala executiva" },
      { href: "/uploads", label: "Uploads", description: "Entrada de dados" },
      { href: "/alerts", label: "Alertas", description: "Indícios e evidências" },
    ],
  },
  {
    title: "Comunicação",
    items: [
      { href: "/creatives", label: "Artes", description: "Peças públicas" },
    ],
  },
  {
    title: "Base local",
    items: [
      { href: "/clients", label: "Clientes", description: "Gestão institucional" },
      { href: "/cities", label: "Cidades", description: "Territórios monitorados" },
    ],
  },
];

export function AppSidebar() {
  const pathname = usePathname();

  return (
    <aside className="hidden w-80 shrink-0 border-r border-[var(--invest-border)] bg-[#060a12]/88 px-5 py-5 shadow-[24px_0_70px_rgba(0,0,0,0.24)] backdrop-blur-xl lg:flex lg:min-h-dvh lg:flex-col">
      <Link href="/dashboard" className="group block rounded-lg border border-[var(--invest-border)] bg-[#0d1524]/82 p-4 transition hover:border-[var(--invest-border-strong)]">
        <p className="invest-eyebrow">Fiscaliza.AI</p>
        <div className="mt-3 flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-md border border-[rgba(125,211,252,0.38)] bg-[rgba(78,168,222,0.16)] text-sm font-black text-[var(--invest-cyan)]">
            FA
          </div>
          <div>
            <h1 className="text-lg font-black leading-tight text-white">
              Estúdio Investigativo
            </h1>
            <p className="mt-1 text-xs text-[var(--invest-muted)]">
              Auditoria pública assistida
            </p>
          </div>
        </div>
      </Link>

      <nav className="mt-7 space-y-7">
        {navGroups.map((group) => (
          <div key={group.title}>
            <p className="mb-2 px-2 text-[0.68rem] font-black uppercase tracking-[0.16em] text-[var(--invest-faint)]">
              {group.title}
            </p>
            <div className="space-y-2">
              {group.items.map((item) => {
                const active =
                  pathname === item.href || pathname.startsWith(`${item.href}/`);

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={[
                      "group relative block rounded-lg border px-4 py-3 transition duration-200",
                      active
                        ? "border-[rgba(125,211,252,0.45)] bg-[rgba(78,168,222,0.14)] text-white shadow-[0_16px_36px_rgba(78,168,222,0.1)]"
                        : "border-transparent text-[var(--invest-muted)] hover:border-[var(--invest-border)] hover:bg-[rgba(16,24,39,0.72)]",
                    ].join(" ")}
                  >
                    {active && (
                      <span className="absolute left-0 top-3 h-9 w-[3px] rounded-r bg-[var(--invest-cyan)]" />
                    )}
                    <span className="block text-sm font-extrabold">
                      {item.label}
                    </span>
                    <span className="mt-0.5 block text-xs text-[var(--invest-muted)]">
                      {item.description}
                    </span>
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      <div className="mt-auto space-y-3">
        <div className="invest-card p-4">
          <p className="text-sm font-extrabold text-white">Modo responsável</p>
          <p className="mt-2 text-xs leading-5 text-[var(--invest-muted)]">
            Alertas indicam pontos de atenção. A confirmação depende de
            investigação humana e documentos de origem.
          </p>
        </div>
        <div className="rounded-lg border border-[rgba(45,212,191,0.24)] bg-[rgba(45,212,191,0.08)] px-4 py-3">
          <p className="text-xs font-black uppercase tracking-[0.12em] text-[var(--invest-success)]">
            Núcleo preservado
          </p>
          <p className="mt-1 text-xs text-[var(--invest-muted)]">
            ETL, análise e IA seguem intocados.
          </p>
        </div>
      </div>
    </aside>
  );
}
