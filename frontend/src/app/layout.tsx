import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { AppShellGate } from "@/components/app/app-shell-gate";
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Fiscaliza.AI",
  description: "Plataforma de análise e auditoria assistida",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR">
      <body className={inter.className}>
        <AppShellGate>{children}</AppShellGate>
      </body>
    </html>
  );
}
