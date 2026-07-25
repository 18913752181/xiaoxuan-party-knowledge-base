"use client";

import { useEffect } from "react";
import { AuthProvider } from "@/contexts/AuthContext";

export function AppShell({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    // Remove sessions created by the previous localStorage-based login implementation.
    for (let index = window.localStorage.length - 1; index >= 0; index -= 1) {
      const key = window.localStorage.key(index);
      if (key?.startsWith("sb-") && key.endsWith("-auth-token")) {
        window.localStorage.removeItem(key);
      }
    }
  }, []);

  return <AuthProvider>{children}</AuthProvider>;
}
