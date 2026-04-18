import type { Metadata } from "next";
import { Inter } from "next/font/google";
import Script from "next/script";
import { AppShellGate } from "@/components/app/app-shell-gate";
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

const themeInitScript = `
(function () {
  try {
    var storageKey = "fiscaliza:theme";
    var stored = window.localStorage.getItem(storageKey);
    var prefersDark = window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches;
    var theme = stored === "dark" || stored === "light" ? stored : prefersDark ? "dark" : "light";
    document.documentElement.dataset.theme = theme;
    document.documentElement.style.colorScheme = theme;
  } catch (error) {
    document.documentElement.dataset.theme = "light";
    document.documentElement.style.colorScheme = "light";
  }
})();
`;

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
    <html lang="pt-BR" suppressHydrationWarning>
      <head>
        <Script
          id="fiscaliza-theme-init"
          strategy="beforeInteractive"
          dangerouslySetInnerHTML={{ __html: themeInitScript }}
        />
      </head>
      <body className={inter.className}>
        <AppShellGate>{children}</AppShellGate>
      </body>
    </html>
  );
}
