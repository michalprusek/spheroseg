"use client"

import type React from "react"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import { toast } from "@/components/ui/use-toast"

type NotificationCategory = "email" | "inApp"
type NotificationSetting = "projectUpdates" | "segmentationComplete" | "newFeatures" | "securityAlerts"

export default function NotificationSettings() {
  const [isLoading, setIsLoading] = useState(false)
  const [notifications, setNotifications] = useState({
    email: {
      projectUpdates: true,
      segmentationComplete: true,
      newFeatures: false,
      securityAlerts: true,
    },
    inApp: {
      projectUpdates: true,
      segmentationComplete: true,
      newFeatures: true,
      securityAlerts: true,
    },
  })

  const handleToggle = (category: NotificationCategory, setting: NotificationSetting) => {
    setNotifications((prev) => ({
      ...prev,
      [category]: {
        ...prev[category],
        [setting]: !prev[category][setting],
      },
    }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)

    try {
      // Simulate API call
      await new Promise((resolve) => setTimeout(resolve, 1000))

      toast({
        title: "Nastavení oznámení aktualizováno",
        description: "Vaše preference oznámení byly úspěšně uloženy.",
      })
    } catch (error) {
      toast({
        title: "Chyba",
        description: "Nepodařilo se aktualizovat nastavení oznámení.",
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      <div className="grid gap-6">
        <Card>
          <CardHeader>
            <CardTitle>E-mailová oznámení</CardTitle>
            <CardDescription>Vyberte, které e-maily chcete dostávat</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="email-project-updates">Aktualizace projektů</Label>
                <p className="text-sm text-muted-foreground">Dostávejte e-maily o změnách ve vašich projektech.</p>
              </div>
              <Switch
                id="email-project-updates"
                checked={notifications.email.projectUpdates}
                onCheckedChange={() => handleToggle("email", "projectUpdates")}
              />
            </div>

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="email-segmentation-complete">Dokončení segmentace</Label>
                <p className="text-sm text-muted-foreground">
                  Dostávejte e-maily, když je dokončena segmentace vašich obrázků.
                </p>
              </div>
              <Switch
                id="email-segmentation-complete"
                checked={notifications.email.segmentationComplete}
                onCheckedChange={() => handleToggle("email", "segmentationComplete")}
              />
            </div>

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="email-new-features">Nové funkce</Label>
                <p className="text-sm text-muted-foreground">
                  Dostávejte e-maily o nových funkcích a vylepšeních platformy.
                </p>
              </div>
              <Switch
                id="email-new-features"
                checked={notifications.email.newFeatures}
                onCheckedChange={() => handleToggle("email", "newFeatures")}
              />
            </div>

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="email-security-alerts">Bezpečnostní upozornění</Label>
                <p className="text-sm text-muted-foreground">
                  Dostávejte e-maily o důležitých bezpečnostních událostech.
                </p>
              </div>
              <Switch
                id="email-security-alerts"
                checked={notifications.email.securityAlerts}
                onCheckedChange={() => handleToggle("email", "securityAlerts")}
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Oznámení v aplikaci</CardTitle>
            <CardDescription>Vyberte, která oznámení chcete vidět v aplikaci</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="inapp-project-updates">Aktualizace projektů</Label>
                <p className="text-sm text-muted-foreground">Dostávejte oznámení o změnách ve vašich projektech.</p>
              </div>
              <Switch
                id="inapp-project-updates"
                checked={notifications.inApp.projectUpdates}
                onCheckedChange={() => handleToggle("inApp", "projectUpdates")}
              />
            </div>

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="inapp-segmentation-complete">Dokončení segmentace</Label>
                <p className="text-sm text-muted-foreground">
                  Dostávejte oznámení, když je dokončena segmentace vašich obrázků.
                </p>
              </div>
              <Switch
                id="inapp-segmentation-complete"
                checked={notifications.inApp.segmentationComplete}
                onCheckedChange={() => handleToggle("inApp", "segmentationComplete")}
              />
            </div>

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="inapp-new-features">Nové funkce</Label>
                <p className="text-sm text-muted-foreground">
                  Dostávejte oznámení o nových funkcích a vylepšeních platformy.
                </p>
              </div>
              <Switch
                id="inapp-new-features"
                checked={notifications.inApp.newFeatures}
                onCheckedChange={() => handleToggle("inApp", "newFeatures")}
              />
            </div>

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="inapp-security-alerts">Bezpečnostní upozornění</Label>
                <p className="text-sm text-muted-foreground">
                  Dostávejte oznámení o důležitých bezpečnostních událostech.
                </p>
              </div>
              <Switch
                id="inapp-security-alerts"
                checked={notifications.inApp.securityAlerts}
                onCheckedChange={() => handleToggle("inApp", "securityAlerts")}
              />
            </div>
          </CardContent>
        </Card>

        <div className="flex justify-end">
          <Button type="submit" disabled={isLoading}>
            {isLoading ? "Ukládání..." : "Uložit nastavení"}
          </Button>
        </div>
      </div>
    </form>
  )
}

