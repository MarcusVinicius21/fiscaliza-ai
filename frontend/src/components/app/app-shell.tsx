"use client";

import { AppSidebar } from "./app-sidebar";
import { AppTopbar } from "./app-topbar";

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="fiscaliza-shell min-h-screen bg-[#0C111F] text-white">
      <div className="flex">
        <AppSidebar />
        <div className="min-w-0 flex-1">
          <AppTopbar />
          <main className="mx-auto w-full max-w-7xl px-4 py-6 lg:px-8">
            {children}
          </main>
        </div>
      </div>
    </div>
  );
}
