"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const navItems = [
  { href: "/dashboard", label: "Dashboard", description: "Visão geral" },
  { href: "/uploads", label: "Uploads", description: "Importar dados" },
  { href: "/alerts", label: "Alertas", description: "Indícios encontrados" },
  { href: "/creatives", label: "Artes", description: "Comunicação pública" },
  { href: "/clients", label: "Clientes", description: "Gestão local" },
  { href: "/cities", label: "Cidades", description: "Bases monitoradas" },
];

export function AppSidebar() {
  const pathname = usePathname();

  return (
    <aside className="hidden min-h-screen w-72 shrink-0 flex-col border-r border-[#2D3748] bg-[#0C111F] p-4 lg:flex">
      <div className="mb-8">
        <p className="text-xs uppercase tracking-[0.18em] text-[#4EA8DE]">
          Fiscaliza.AI
        </p>
        <h1 className="mt-2 text-xl font-bold text-white">
          Estúdio Investigativo
        </h1>
        <p className="mt-2 text-sm text-[#CBD5E1]">
          Auditoria assistida para leitura técnica de dados públicos.
        </p>
      </div>

      <nav className="space-y-2">
        {navItems.map((item) => {
          const active =
            pathname === item.href || pathname.startsWith(`${item.href}/`);

          return (
            <Link
              key={item.href}
              href={item.href}
              className={[
                "block rounded-md border px-3 py-3 transition",
                active
                  ? "border-[#4EA8DE] bg-[#141B2D] text-white"
                  : "border-transparent text-[#CBD5E1] hover:border-[#2D3748] hover:bg-[#141B2D]",
              ].join(" ")}
            >
              <span className="block text-sm font-semibold">{item.label}</span>
              <span className="block text-xs text-[#CBD5E1]">
                {item.description}
              </span>
            </Link>
          );
        })}
      </nav>

      <div className="mt-auto rounded-md border border-[#2D3748] bg-[#141B2D] p-3">
        <p className="text-xs font-semibold text-white">Modo atual</p>
        <p className="mt-1 text-xs text-[#CBD5E1]">
          Alertas indicam pontos de atenção, não conclusão de fraude.
        </p>
      </div>
    </aside>
  );
}
