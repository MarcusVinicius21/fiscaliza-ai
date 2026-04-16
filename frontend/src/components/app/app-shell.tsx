"use client";

import { AppSidebar } from "./app-sidebar";
import { AppTopbar } from "./app-topbar";

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="fiscaliza-shell min-h-dvh overflow-hidden text-[var(--invest-text)]">
      <div className="pointer-events-none fixed inset-0 -z-10 bg-[var(--invest-bg)]" />
      <div className="flex min-h-dvh">
        <AppSidebar />
        <div className="min-w-0 flex-1">
          <AppTopbar />
          <main className="mx-auto w-full max-w-[1540px] px-4 py-6 sm:px-6 lg:px-8 xl:px-10">
            {children}
          </main>
        </div>
      </div>
    </div>
  );
}
