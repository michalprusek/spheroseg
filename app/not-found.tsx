import Link from 'next/link'
import { Button } from '@/components/ui/button'

// This page is rendered on the server when a page/resource is not found
export default function NotFound() {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-4 text-center">
      <div className="space-y-4">
        <h1 className="text-6xl font-bold">404</h1>
        <h2 className="text-2xl font-semibold">Stránka nenalezena</h2>
        <p className="text-muted-foreground">
          Požadovaná stránka neexistuje nebo byla přesunuta.
        </p>
        <div className="pt-6">
          <Button asChild>
            <Link href="/">
              Zpět na domovskou stránku
            </Link>
          </Button>
        </div>
      </div>
    </div>
  )
} 