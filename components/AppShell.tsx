"use client";

import { AuthProvider } from "@/contexts/AuthContext";

export function AppShell({ children }: { children: React.ReactNode }) {
  return <AuthProvider>{children}</AuthProvider>;
}
