"use client";

import Link from "next/link";

export function AppTopbar() {
  return (
    <header className="sticky top-0 z-30 border-b border-[#2D3748] bg-[#0C111F]/95 px-4 py-3 backdrop-blur">
      <div className="flex items-center justify-between gap-4">
        <Link href="/dashboard" className="lg:hidden">
          <span className="text-sm font-bold text-white">Fiscaliza.AI</span>
        </Link>

        <div className="hidden lg:block">
          <p className="text-xs uppercase tracking-[0.18em] text-[#4EA8DE]">
            Painel executivo
          </p>
          <p className="text-sm text-[#CBD5E1]">
            Leia, investigue e comunique achados com rastreabilidade.
          </p>
        </div>

        <div className="flex items-center gap-3 rounded-md border border-[#2D3748] bg-[#141B2D] px-3 py-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-md bg-[#4EA8DE] text-sm font-bold text-[#0C111F]">
            U
          </div>
          <div className="hidden sm:block">
            <p className="text-xs font-semibold text-white">Usuário técnico</p>
            <p className="text-xs text-[#CBD5E1]">Sessão local</p>
          </div>
        </div>
      </div>
    </header>
  );
}
