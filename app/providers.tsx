"use client"

import { ThemeProvider } from "next-themes"
import { useState, useEffect } from "react"
import { Suspense } from "react"

export function Providers({ children }: { children: React.ReactNode }) {
  // This is used to prevent hydration mismatch
  const [mounted, setMounted] = useState(false)

  // Only run on client side
  useEffect(() => {
    setMounted(true)
  }, [])

  // To avoid hydration mismatch, render a simple div during SSR
  // This prevents useContext errors during server-side rendering
  if (!mounted) {
    // Return a placeholder with a default theme during SSR
    // The className ensures consistent styling during SSR
    return (
      <div className="light" suppressHydrationWarning>
        {/* During SSR, render a minimal version without ThemeProvider */}
        <Suspense fallback={<div>Loading...</div>}>
          {children}
        </Suspense>
      </div>
    )
  }

  return (
    <ThemeProvider
      attribute="class"
      defaultTheme="light"
      enableSystem={true}
      disableTransitionOnChange
    >
      <Suspense fallback={<div>Loading app...</div>}>
        {children}
      </Suspense>
    </ThemeProvider>
  )
}

export default Providers 