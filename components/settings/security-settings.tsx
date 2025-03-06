"use client"

import type React from "react"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Switch } from "@/components/ui/switch"
import { toast } from "@/components/ui/use-toast"
import { AlertCircle, CheckCircle } from "lucide-react"
import { Alert, AlertDescription } from "@/components/ui/alert"

export default function SecuritySettings() {
  const [isLoading, setIsLoading] = useState(false)
  const [isSessionLoading, setIsSessionLoading] = useState(false)
  const [passwordData, setPasswordData] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  })
  const [twoFactorEnabled, setTwoFactorEnabled] = useState(false)
  const [isTwoFactorLoading, setIsTwoFactorLoading] = useState(false)
  const [sessionTimeout, setSessionTimeout] = useState(30)
  const [statusMessage, setStatusMessage] = useState<{type: 'success' | 'error', message: string} | null>(null)
  const [twoFactorStatusMessage, setTwoFactorStatusMessage] = useState<{type: 'success' | 'error', message: string} | null>(null)
  const [sessionStatusMessage, setSessionStatusMessage] = useState<{type: 'success' | 'error', message: string} | null>(null)

  const handlePasswordChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target
    setPasswordData((prev) => ({ ...prev, [name]: value }))
    // Clear status message when user starts typing
    setStatusMessage(null)
  }

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (passwordData.newPassword !== passwordData.confirmPassword) {
      setStatusMessage({
        type: 'error',
        message: 'Nová hesla se neshodují.'
      })
      toast({
        title: "Chyba",
        description: "Nová hesla se neshodují.",
        variant: "destructive",
      })
      return
    }

    setIsLoading(true)
    setStatusMessage(null)

    try {
      // Simulate API call
      await new Promise((resolve) => setTimeout(resolve, 1000))

      setStatusMessage({
        type: 'success',
        message: 'Vaše heslo bylo úspěšně změněno.'
      })
      
      toast({
        title: "Heslo změněno",
        description: "Vaše heslo bylo úspěšně změněno.",
      })

      // Reset form
      setPasswordData({
        currentPassword: "",
        newPassword: "",
        confirmPassword: "",
      })
    } catch (error) {
      setStatusMessage({
        type: 'error',
        message: 'Nepodařilo se změnit heslo. Zkontrolujte své současné heslo.'
      })
      
      toast({
        title: "Chyba",
        description: "Nepodařilo se změnit heslo. Zkontrolujte své současné heslo.",
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }

  const handleTwoFactorToggle = async () => {
    setIsTwoFactorLoading(true)
    setTwoFactorStatusMessage(null)
    
    try {
      // Simulate API call
      await new Promise((resolve) => setTimeout(resolve, 500))

      const newStatus = !twoFactorEnabled
      setTwoFactorEnabled(newStatus)
      
      setTwoFactorStatusMessage({
        type: 'success',
        message: newStatus
          ? "Dvoufaktorové ověření bylo úspěšně zapnuto."
          : "Dvoufaktorové ověření bylo úspěšně vypnuto."
      })

      toast({
        title: newStatus ? "Dvoufaktorové ověření zapnuto" : "Dvoufaktorové ověření vypnuto",
        description: newStatus
          ? "Dvoufaktorové ověření bylo úspěšně zapnuto."
          : "Dvoufaktorové ověření bylo úspěšně vypnuto.",
      })
    } catch (error) {
      setTwoFactorStatusMessage({
        type: 'error',
        message: "Nepodařilo se změnit nastavení dvoufaktorového ověření."
      })
      
      toast({
        title: "Chyba",
        description: "Nepodařilo se změnit nastavení dvoufaktorového ověření.",
        variant: "destructive",
      })
    } finally {
      setIsTwoFactorLoading(false)
    }
  }

  const handleSessionTimeoutChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSessionTimeout(Number.parseInt(e.target.value, 10))
    // Clear status message when user changes value
    setSessionStatusMessage(null)
  }

  const handleSessionTimeoutSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSessionLoading(true)
    setSessionStatusMessage(null)

    try {
      // Simulate API call
      await new Promise((resolve) => setTimeout(resolve, 500))

      setSessionStatusMessage({
        type: 'success',
        message: `Časový limit relace byl nastaven na ${sessionTimeout} minut.`
      })
      
      toast({
        title: "Nastavení relace aktualizováno",
        description: `Časový limit relace byl nastaven na ${sessionTimeout} minut.`,
      })
    } catch (error) {
      setSessionStatusMessage({
        type: 'error',
        message: "Nepodařilo se aktualizovat nastavení relace."
      })
      
      toast({
        title: "Chyba",
        description: "Nepodařilo se aktualizovat nastavení relace.",
        variant: "destructive",
      })
    } finally {
      setIsSessionLoading(false)
    }
  }

  return (
    <div className="grid gap-6">
      <Card>
        <CardHeader>
          <CardTitle>Změna hesla</CardTitle>
          <CardDescription>Aktualizujte své heslo pro zvýšení bezpečnosti</CardDescription>
        </CardHeader>
        <CardContent>
          <form id="password-form" onSubmit={handlePasswordSubmit} className="space-y-4">
            {statusMessage && (
              <Alert variant={statusMessage.type === 'success' ? 'default' : 'destructive'} className="mb-4">
                {statusMessage.type === 'success' ? (
                  <CheckCircle className="h-4 w-4" />
                ) : (
                  <AlertCircle className="h-4 w-4" />
                )}
                <AlertDescription>{statusMessage.message}</AlertDescription>
              </Alert>
            )}
            
            <div className="space-y-2">
              <Label htmlFor="currentPassword">Současné heslo</Label>
              <Input
                id="currentPassword"
                name="currentPassword"
                type="password"
                value={passwordData.currentPassword}
                onChange={handlePasswordChange}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="newPassword">Nové heslo</Label>
              <Input
                id="newPassword"
                name="newPassword"
                type="password"
                value={passwordData.newPassword}
                onChange={handlePasswordChange}
                required
              />
              <p className="text-xs text-muted-foreground">
                Heslo musí obsahovat alespoň 8 znaků, včetně velkého písmena, číslice a speciálního znaku.
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Potvrzení nového hesla</Label>
              <Input
                id="confirmPassword"
                name="confirmPassword"
                type="password"
                value={passwordData.confirmPassword}
                onChange={handlePasswordChange}
                required
              />
            </div>
          </form>
        </CardContent>
        <CardFooter className="flex justify-end">
          <Button type="submit" form="password-form" disabled={isLoading}>
            {isLoading ? "Ukládání..." : "Změnit heslo"}
          </Button>
        </CardFooter>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Dvoufaktorové ověření</CardTitle>
          <CardDescription>Zvyšte zabezpečení svého účtu pomocí dvoufaktorového ověření</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {twoFactorStatusMessage && (
            <Alert variant={twoFactorStatusMessage.type === 'success' ? 'default' : 'destructive'} className="mb-4">
              {twoFactorStatusMessage.type === 'success' ? (
                <CheckCircle className="h-4 w-4" />
              ) : (
                <AlertCircle className="h-4 w-4" />
              )}
              <AlertDescription>{twoFactorStatusMessage.message}</AlertDescription>
            </Alert>
          )}
          
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="two-factor">Dvoufaktorové ověření</Label>
              <p className="text-sm text-muted-foreground">
                Při přihlášení budete požádáni o zadání kódu z vaší autentizační aplikace.
              </p>
            </div>
            <Switch 
              id="two-factor" 
              checked={twoFactorEnabled} 
              onCheckedChange={handleTwoFactorToggle}
              disabled={isTwoFactorLoading}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Nastavení relace</CardTitle>
          <CardDescription>Upravte nastavení relace a automatického odhlášení</CardDescription>
        </CardHeader>
        <CardContent>
          <form id="session-form" onSubmit={handleSessionTimeoutSubmit} className="space-y-4">
            {sessionStatusMessage && (
              <Alert variant={sessionStatusMessage.type === 'success' ? 'default' : 'destructive'} className="mb-4">
                {sessionStatusMessage.type === 'success' ? (
                  <CheckCircle className="h-4 w-4" />
                ) : (
                  <AlertCircle className="h-4 w-4" />
                )}
                <AlertDescription>{sessionStatusMessage.message}</AlertDescription>
              </Alert>
            )}
            
            <div className="space-y-2">
              <Label htmlFor="sessionTimeout">Časový limit relace (minuty)</Label>
              <Input
                id="sessionTimeout"
                type="number"
                min="5"
                max="120"
                value={sessionTimeout}
                onChange={handleSessionTimeoutChange}
              />
              <p className="text-xs text-muted-foreground">Po této době neaktivity budete automaticky odhlášeni.</p>
            </div>
          </form>
        </CardContent>
        <CardFooter className="flex justify-end">
          <Button type="submit" form="session-form" disabled={isSessionLoading}>
            {isSessionLoading ? "Ukládání..." : "Uložit nastavení"}
          </Button>
        </CardFooter>
      </Card>
    </div>
  )
}

