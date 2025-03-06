"use client"

import { useEffect, useState } from 'react'

export const useHydration = () => {
  const [isHydrated, setIsHydrated] = useState(false)
  
  useEffect(() => {
    // This effect runs once on the client after hydration
    setIsHydrated(true)
  }, [])
  
  return isHydrated
} 