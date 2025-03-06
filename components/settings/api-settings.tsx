"use client"

import type React from "react"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Copy, Eye, EyeOff, RefreshCw } from "lucide-react"
import { toast } from "@/components/ui/use-toast"

interface ApiKey {
  id: string
  name: string
  key: string
  createdAt: string
  lastUsed: string | null
}

export default function ApiSettings() {
  const [isLoading, setIsLoading] = useState(false)
  const [newKeyName, setNewKeyName] = useState("")
  const [showKeys, setShowKeys] = useState<Record<string, boolean>>({})

  // Mock API keys
  const [apiKeys, setApiKeys] = useState<ApiKey[]>([
    {
      id: "1",
      name: "Výzkumný projekt",
      key: "sk_live_51HG6HbJkLzPXXXXXXXXXXXXXX",
      createdAt: "2023-10-15",
      lastUsed: "2023-11-20",
    },
    {
      id: "2",
      name: "Automatizace",
      key: "sk_live_51HG6HbJkLzPYYYYYYYYYYYYYY",
      createdAt: "2023-11-05",
      lastUsed: null,
    },
  ])

  const toggleShowKey = (id: string) => {
    setShowKeys((prev) => ({
      ...prev,
      [id]: !prev[id],
    }))
  }

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
    toast({
      title: "Zkopírováno do schránky",
      description: "API klíč byl zkopírován do schránky.",
    })
  }

  const handleCreateKey = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!newKeyName.trim()) {
      toast({
        title: "Chyba",
        description: "Zadejte název pro nový API klíč.",
        variant: "destructive",
      })
      return
    }

    setIsLoading(true)

    try {
      // Simulate API call
      await new Promise((resolve) => setTimeout(resolve, 1000))

      // Generate a mock API key
      const newKey: ApiKey = {
        id: `${apiKeys.length + 1}`,
        name: newKeyName,
        key: `sk_live_51HG6HbJkLzP${Math.random().toString(36).substring(2, 14).toUpperCase()}`,
        createdAt: new Date().toISOString().split("T")[0],
        lastUsed: null,
      }

      setApiKeys((prev) => [...prev, newKey])
      setNewKeyName("")

      // Automatically show the new key
      setShowKeys((prev) => ({
        ...prev,
        [newKey.id]: true,
      }))

      toast({
        title: "API klíč vytvořen",
        description: "Nový API klíč byl úspěšně vytvořen.",
      })
    } catch (error) {
      toast({
        title: "Chyba",
        description: "Nepodařilo se vytvořit nový API klíč.",
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }

  const handleRevokeKey = async (id: string) => {
    try {
      // Simulate API call
      await new Promise((resolve) => setTimeout(resolve, 500))

      setApiKeys((prev) => prev.filter((key) => key.id !== id))

      toast({
        title: "API klíč zrušen",
        description: "API klíč byl úspěšně zrušen.",
      })
    } catch (error) {
      toast({
        title: "Chyba",
        description: "Nepodařilo se zrušit API klíč.",
        variant: "destructive",
      })
    }
  }

  return (
    <div className="grid gap-6">
      <Card>
        <CardHeader>
          <CardTitle>API klíče</CardTitle>
          <CardDescription>Spravujte API klíče pro přístup k platformě z externích aplikací</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-4">
            {apiKeys.length > 0 ? (
              apiKeys.map((apiKey) => (
                <div key={apiKey.id} className="rounded-lg border p-4">
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <h3 className="text-sm font-medium">{apiKey.name}</h3>
                      <div className="flex items-center gap-2 mt-1">
                        <div className="relative flex-1">
                          <Input
                            value={showKeys[apiKey.id] ? apiKey.key : "•".repeat(apiKey.key.length)}
                            readOnly
                            className="pr-10 font-mono text-xs"
                          />
                          <Button
                            variant="ghost"
                            size="icon"
                            className="absolute right-0 top-0 h-full"
                            onClick={() => toggleShowKey(apiKey.id)}
                          >
                            {showKeys[apiKey.id] ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                          </Button>
                        </div>
                        <Button variant="outline" size="icon" onClick={() => copyToClipboard(apiKey.key)}>
                          <Copy className="h-4 w-4" />
                        </Button>
                      </div>
                      <div className="mt-2 text-xs text-muted-foreground">
                        Vytvořeno: {apiKey.createdAt}
                        {apiKey.lastUsed && ` • Naposledy použito: ${apiKey.lastUsed}`}
                      </div>
                    </div>
                    <Button variant="destructive" size="sm" onClick={() => handleRevokeKey(apiKey.id)}>
                      Zrušit klíč
                    </Button>
                  </div>
                </div>
              ))
            ) : (
              <div className="text-center py-4 text-muted-foreground">
                Nemáte žádné API klíče. Vytvořte si nový klíč níže.
              </div>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="newKeyName">Vytvořit nový API klíč</Label>
            <div className="flex gap-2">
              <Input
                id="newKeyName"
                placeholder="Název klíče"
                value={newKeyName}
                onChange={(e) => setNewKeyName(e.target.value)}
              />
              <Button onClick={handleCreateKey} disabled={isLoading}>
                {isLoading ? (
                  <>
                    <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                    Vytváření...
                  </>
                ) : (
                  "Vytvořit"
                )}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              API klíče umožňují přístup k vašim datům prostřednictvím API. Uchovávejte je v bezpečí.
            </p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Dokumentace API</CardTitle>
          <CardDescription>Informace o používání API pro integraci s vaší aplikací</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <p className="text-sm">
              Naše REST API umožňuje programový přístup k funkcím segmentační platformy. Můžete nahrávat obrázky,
              spouštět segmentaci a získávat výsledky.
            </p>

            <div className="rounded-lg bg-muted p-4">
              <h4 className="text-sm font-medium mb-2">Základní URL</h4>
              <code className="text-xs bg-background p-1 rounded">https://api.segmentlab.example/v1</code>
            </div>

            <div>
              <h4 className="text-sm font-medium mb-2">Dostupné endpointy</h4>
              <ul className="space-y-2 text-sm">
                <li>
                  <code className="bg-muted p-1 rounded text-xs">GET /projects</code> - Seznam projektů
                </li>
                <li>
                  <code className="bg-muted p-1 rounded text-xs">POST /projects</code> - Vytvoření nového projektu
                </li>
                <li>
                  <code className="bg-muted p-1 rounded text-xs">GET /projects/{"{id}"}</code> - Detail projektu
                </li>
                <li>
                  <code className="bg-muted p-1 rounded text-xs">POST /projects/{"{id}"}/images</code> - Nahrání obrázku
                </li>
                <li>
                  <code className="bg-muted p-1 rounded text-xs">GET /projects/{"{id}"}/images</code> - Seznam obrázků
                </li>
                <li>
                  <code className="bg-muted p-1 rounded text-xs">GET /images/{"{id}"}/segmentation</code> - Získání
                  segmentace
                </li>
              </ul>
            </div>
          </div>
        </CardContent>
        <CardFooter>
          <Button variant="outline" className="w-full">
            Zobrazit úplnou dokumentaci API
          </Button>
        </CardFooter>
      </Card>
    </div>
  )
}

