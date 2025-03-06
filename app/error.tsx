"use client"

import { useEffect } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    // Log the error to an error reporting service
    console.error('Error caught by error boundary:', error)
  }, [error])

  return (
    <div className="flex flex-col items-center justify-center min-h-[50vh] p-5 text-center">
      <h2 className="text-2xl font-semibold mb-6">Něco se pokazilo</h2>
      <p className="text-muted-foreground mb-8 max-w-md">
        Omlouváme se, ale došlo k chybě při zpracování vašeho požadavku.
      </p>
      <div className="flex gap-4">
        <Button onClick={() => reset()}>
          Zkusit znovu
        </Button>
        <Button variant="outline" asChild>
          <Link href="/">
            Zpět na domovskou stránku
          </Link>
        </Button>
      </div>
    </div>
  )
} 