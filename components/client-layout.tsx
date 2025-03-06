"use client"

import { useState, useEffect } from "react"
import Header from "@/components/header"
import { Toaster } from "@/components/ui/toaster"

export function ClientLayout({ children }: { children: React.ReactNode }) {
  // State to track if we're on the client
  const [isMounted, setIsMounted] = useState(false)
  
  // Effect runs only on the client after hydration
  useEffect(() => {
    setIsMounted(true)
  }, [])
  
  // If we're still on the server, render a minimal layout
  // This prevents useContext errors during server-side rendering
  if (!isMounted) {
    return (
      <div suppressHydrationWarning>
        {children}
      </div>
    )
  }
  
  // Once mounted on the client, render with all client components
  return (
    <>
      <Header />
      <main className="min-h-screen">
        {children}
      </main>
      <Toaster />
    </>
  )
} 