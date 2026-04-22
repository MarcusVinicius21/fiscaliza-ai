"use client";

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

type Theme = "light" | "dark";

interface ThemeContextValue {
  theme: Theme;
  mounted: boolean;
  toggleTheme: () => void;
  setTheme: (theme: Theme) => void;
}

const STORAGE_KEY = "fiscaliza:theme";
const COOKIE_KEY = "fiscaliza-theme";

const ThemeContext = createContext<ThemeContextValue>({
  theme: "light",
  mounted: false,
  toggleTheme: () => {},
  setTheme: () => {},
});

function getStoredTheme(): Theme | null {
  if (typeof window === "undefined") return null;

  const stored = window.localStorage.getItem(STORAGE_KEY);
  if (stored === "dark" || stored === "light") {
    return stored;
  }

  return null;
}

function getResolvedTheme(fallbackTheme: Theme): Theme {
  const storedTheme = getStoredTheme();
  if (storedTheme) return storedTheme;

  if (
    typeof window !== "undefined" &&
    window.matchMedia &&
    window.matchMedia("(prefers-color-scheme: dark)").matches
  ) {
    return "dark";
  }

  return fallbackTheme;
}

function applyTheme(theme: Theme) {
  if (typeof document === "undefined") return;
  document.documentElement.dataset.theme = theme;
  document.documentElement.style.colorScheme = theme;
}

function persistTheme(theme: Theme) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, theme);
  document.cookie = `${COOKIE_KEY}=${theme}; path=/; max-age=31536000; samesite=lax`;
}

export function ThemeProvider({
  children,
  initialTheme,
}: {
  children: React.ReactNode;
  initialTheme: Theme;
}) {
  const [theme, setThemeState] = useState<Theme>(initialTheme);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const resolvedTheme = getResolvedTheme(initialTheme);
    setThemeState(resolvedTheme);
    applyTheme(resolvedTheme);
    persistTheme(resolvedTheme);
    setMounted(true);
  }, [initialTheme]);

  function setTheme(themeValue: Theme) {
    setThemeState(themeValue);
    applyTheme(themeValue);
    persistTheme(themeValue);
  }

  function toggleTheme() {
    setTheme(theme === "dark" ? "light" : "dark");
  }

  const value = useMemo(
    () => ({
      theme,
      mounted,
      toggleTheme,
      setTheme,
    }),
    [theme, mounted]
  );

  return (
    <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}
