"use client"

import { useEffect, useState } from "react"

export function ClientOnly({ children }: { children: React.ReactNode }) {
  // State to track if we're on the client
  const [isMounted, setIsMounted] = useState(false)
  
  // Effect runs only on the client after hydration
  useEffect(() => {
    setIsMounted(true)
  }, [])
  
  // If we're still on the server or during initial client render,
  // return a placeholder div that doesn't use any client-side features
  // This prevents hydration mismatches and useContext errors
  if (!isMounted) {
    // Return a minimal div that doesn't use context
    return <div style={{ visibility: 'hidden' }} suppressHydrationWarning></div>
  }
  
  // Once mounted on the client, render children
  return <>{children}</>
} 