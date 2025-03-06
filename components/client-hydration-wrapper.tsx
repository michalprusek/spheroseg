"use client"

import { useHydration } from "@/hooks/use-hydration"

export function ClientHydrationWrapper({ children }: { children: React.ReactNode }) {
  const isHydrated = useHydration();
  
  // During SSR or before hydration is complete, render a minimal loading state
  if (!isHydrated) {
    return <div className="min-h-screen flex items-center justify-center">
      <div className="animate-pulse">Načítání aplikace...</div>
    </div>;
  }
  
  return <>{children}</>;
} 