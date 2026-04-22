"use client";

import { AppSidebar } from "./app-sidebar";
import { AppTopbar } from "./app-topbar";
import { SidebarProvider } from "./sidebar-context";
import { ThemeProvider } from "./theme-context";

export function AppShell({
  children,
  initialTheme,
  initialSidebarCollapsed,
}: {
  children: React.ReactNode;
  initialTheme: "light" | "dark";
  initialSidebarCollapsed: boolean;
}) {
  return (
    <ThemeProvider initialTheme={initialTheme}>
      <SidebarProvider initialCollapsed={initialSidebarCollapsed}>
        <div className="fiscaliza-shell min-h-dvh bg-[var(--invest-bg)] text-[var(--invest-text)]">
          <div className="flex min-h-dvh">
            <AppSidebar />
            <div className="min-w-0 flex-1 transition-all duration-300 ease-in-out">
              <AppTopbar />
              <main className="mx-auto w-full max-w-[1500px] px-4 py-6 sm:px-6 lg:px-8 xl:px-10">
                {children}
              </main>
            </div>
          </div>
        </div>
      </SidebarProvider>
    </ThemeProvider>
  );
}
