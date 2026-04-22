"use client";

import { usePathname } from "next/navigation";
import { AppShell } from "./app-shell";

export function AppShellGate({
  children,
  initialTheme,
  initialSidebarCollapsed,
}: {
  children: React.ReactNode;
  initialTheme: "light" | "dark";
  initialSidebarCollapsed: boolean;
}) {
  const pathname = usePathname();
  const withoutShell = pathname === "/" || pathname.startsWith("/login");

  if (withoutShell) {
    return <>{children}</>;
  }

  return (
    <AppShell
      initialTheme={initialTheme}
      initialSidebarCollapsed={initialSidebarCollapsed}
    >
      {children}
    </AppShell>
  );
}
