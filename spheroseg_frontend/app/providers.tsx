"use client"

import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { Provider as JotaiProvider } from "jotai"
import { ThemeProvider } from "next-themes"
import { SocketProvider } from "@/lib/socket"
import { AuthProvider } from "@/lib/auth"
import { AnalyticsProvider } from "@/lib/analytics"

export function Providers({ children }: { children: React.ReactNode }) {
  const queryClient = new QueryClient()

  return (
    <QueryClientProvider client={queryClient}>
      <JotaiProvider>
        <ThemeProvider attribute="class" defaultTheme="system">
          <SocketProvider>
            <AuthProvider>
              <AnalyticsProvider>
                {children}
              </AnalyticsProvider>
            </AuthProvider>
          </SocketProvider>
        </ThemeProvider>
      </JotaiProvider>
    </QueryClientProvider>
  )
}