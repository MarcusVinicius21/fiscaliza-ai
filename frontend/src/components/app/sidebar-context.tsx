"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

interface SidebarContextValue {
  collapsed: boolean;
  toggle: () => void;
}

const STORAGE_KEY = "fiscaliza:sidebar-collapsed";
const COOKIE_KEY = "fiscaliza-sidebar-collapsed";

const SidebarContext = createContext<SidebarContextValue>({
  collapsed: false,
  toggle: () => {},
});

function persistCollapsed(collapsed: boolean) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, String(collapsed));
  document.cookie = `${COOKIE_KEY}=${collapsed}; path=/; max-age=31536000; samesite=lax`;
}

export function SidebarProvider({
  children,
  initialCollapsed,
}: {
  children: React.ReactNode;
  initialCollapsed: boolean;
}) {
  const [collapsed, setCollapsed] = useState<boolean>(initialCollapsed);

  useEffect(() => {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    const resolved = stored === "true" ? true : stored === "false" ? false : initialCollapsed;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setCollapsed(resolved);
    persistCollapsed(resolved);
  }, [initialCollapsed]);

  const toggle = useCallback(() => {
    setCollapsed((prev) => {
      const next = !prev;
      persistCollapsed(next);
      return next;
    });
  }, []);

  const value = useMemo(
    () => ({
      collapsed,
      toggle,
    }),
    [collapsed, toggle]
  );

  return (
    <SidebarContext.Provider value={value}>
      {children}
    </SidebarContext.Provider>
  );
}

export function useSidebar() {
  return useContext(SidebarContext);
}
