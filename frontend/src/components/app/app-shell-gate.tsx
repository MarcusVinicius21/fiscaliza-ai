"use client";

import { usePathname } from "next/navigation";
import { AppShell } from "./app-shell";

export function AppShellGate({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const withoutShell = pathname === "/" || pathname.startsWith("/login");

  if (withoutShell) {
    return <>{children}</>;
  }

  return <AppShell>{children}</AppShell>;
}
