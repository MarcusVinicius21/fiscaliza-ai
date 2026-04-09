import Link from "next/link";
import React from "react";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex h-screen overflow-hidden bg-gray-100">
      {/* Sidebar Enxuta */}
      <aside className="w-64 bg-slate-900 text-white flex flex-col">
        <div className="p-4 bg-slate-950 flex items-center justify-center h-16">
          <span className="text-xl font-bold tracking-wider">Fiscaliza.AI</span>
        </div>
        <nav className="flex-1 p-4 space-y-2 overflow-y-auto">
          <Link href="/dashboard" className="block px-4 py-2 rounded hover:bg-slate-800">Resumo</Link>
          <Link href="/clients" className="block px-4 py-2 rounded hover:bg-slate-800">Clientes</Link>
          <Link href="/cities" className="block px-4 py-2 rounded hover:bg-slate-800">Cidades</Link>
          <Link href="/uploads" className="block px-4 py-2 rounded hover:bg-slate-800">Uploads (CSVs)</Link>
          <Link href="/alerts" className="block px-4 py-2 rounded hover:bg-slate-800">Alertas</Link>
          <Link href="/creatives" className="block px-4 py-2 rounded hover:bg-slate-800">Artes (IA)</Link>
        </nav>
        <div className="p-4 bg-slate-950 text-sm text-slate-400">
          <Link href="/login" className="block text-center hover:text-white">Sair</Link>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col h-screen overflow-y-auto">
        <header className="h-16 bg-white shadow-sm flex items-center px-6 border-b">
          <h2 className="text-lg font-medium text-gray-800">Painel de Operação</h2>
        </header>
        <div className="p-6">
          {children}
        </div>
      </main>
    </div>
  );
}