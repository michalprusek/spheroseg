"use client"

import { useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Inter } from 'next/font/google'

const inter = Inter({ subsets: ['latin'] })

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    // Log the error to an error reporting service
    console.error(error)
  }, [error])

  return (
    <html lang="en" className={inter.className}>
      <body className="min-h-screen bg-background">
        <div className="flex flex-col items-center justify-center min-h-screen p-5 text-center">
          <h1 className="text-6xl font-bold mb-4">500</h1>
          <h2 className="text-2xl font-semibold mb-6">Kritická chyba aplikace</h2>
          <p className="text-lg mb-8 max-w-md">
            Omlouváme se, ale došlo k neočekávané chybě. Zkuste to prosím znovu.
          </p>
          <div className="flex gap-4">
            <Button onClick={() => reset()}>
              Zkusit znovu
            </Button>
            <Button variant="outline" onClick={() => window.location.href = "/"}>
              Zpět na domovskou stránku
            </Button>
          </div>
        </div>
      </body>
    </html>
  )
} 