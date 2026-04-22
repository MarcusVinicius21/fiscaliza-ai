import type { Metadata } from "next";
import { cookies } from "next/headers";
import { Inter } from "next/font/google";
import { AppShellGate } from "@/components/app/app-shell-gate";
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Fiscaliza.AI",
  description: "Plataforma de analise e auditoria assistida",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const cookieStore = await cookies();
  const initialTheme = cookieStore.get("fiscaliza-theme")?.value === "dark" ? "dark" : "light";
  const initialSidebarCollapsed = cookieStore.get("fiscaliza-sidebar-collapsed")?.value === "true";

  return (
    <html
      lang="pt-BR"
      data-theme={initialTheme}
      style={{ colorScheme: initialTheme }}
      suppressHydrationWarning
    >
      <head />
      <body className={inter.className}>
        <AppShellGate
          initialTheme={initialTheme}
          initialSidebarCollapsed={initialSidebarCollapsed}
        >
          {children}
        </AppShellGate>
      </body>
    </html>
  );
}
