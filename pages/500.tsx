import Link from 'next/link'
import { Button } from '@/components/ui/button'

export default function Custom500() {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-background text-foreground">
      <div className="space-y-4 text-center">
        <h1 className="text-6xl font-bold">500</h1>
        <h2 className="text-2xl font-semibold">Kritická chyba aplikace</h2>
        <p className="text-muted-foreground">Omlouváme se, ale došlo k neočekávané chybě na serveru.</p>
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Button onClick={() => window.location.reload()}>
            Zkusit znovu
          </Button>
          <Link href="/" passHref>
            <Button variant="outline">Zpět na domovskou stránku</Button>
          </Link>
        </div>
      </div>
    </div>
  )
} 