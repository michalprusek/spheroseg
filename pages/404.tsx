import Link from 'next/link'
import { Button } from '@/components/ui/button'

export default function Custom404() {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-background text-foreground">
      <div className="space-y-4 text-center">
        <h1 className="text-6xl font-bold">404</h1>
        <h2 className="text-2xl font-semibold">Stránka nenalezena</h2>
        <p className="text-muted-foreground">Omlouváme se, ale požadovaná stránka neexistuje.</p>
        <Link href="/" passHref>
          <Button>Zpět na domovskou stránku</Button>
        </Link>
      </div>
    </div>
  )
} 