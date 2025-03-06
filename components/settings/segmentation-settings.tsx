"use client"

import type React from "react"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Slider } from "@/components/ui/slider"
import { Switch } from "@/components/ui/switch"
import { toast } from "@/components/ui/use-toast"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { CheckCircle, AlertCircle } from "lucide-react"
import { fetchWithAuth, USER_ENDPOINTS } from "@/app/api/api-config"

export default function SegmentationSettings() {
  const [isLoading, setIsLoading] = useState(false)
  const [statusMessage, setStatusMessage] = useState<{type: 'success' | 'error', message: string} | null>(null)
  const [settings, setSettings] = useState({
    defaultModel: "neural-network-v2",
    confidenceThreshold: 75,
    postProcessing: true,
    autoSave: true,
    maxImageSize: 2048,
    colorScheme: "red",
  })

  // Načíst nastavení segmentace z API při prvním načtení komponenty
  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const response = await fetchWithAuth(USER_ENDPOINTS.me)
        if (response.ok) {
          const userData = await response.json();
          console.log("SegmentationSettings: User data loaded:", userData);
          
          // Pokud existují uložená nastavení segmentace, načti je
          if (userData.segmentation_settings) {
            try {
              const savedSettings = JSON.parse(userData.segmentation_settings);
              console.log("SegmentationSettings: Loaded settings:", savedSettings);
              setSettings(prev => ({
                ...prev,
                ...savedSettings
              }));
            } catch (error) {
              console.error("Failed to parse segmentation settings:", error);
            }
          }
        }
      } catch (error) {
        console.error("Failed to fetch user data:", error);
        toast({
          title: "Chyba",
          description: "Nepodařilo se načíst uživatelská nastavení",
          variant: "destructive",
        });
      }
    };
    
    fetchSettings();
  }, []);

  const handleSliderChange = (name: string, value: number[]) => {
    setSettings((prev) => ({ ...prev, [name]: value[0] }))
    setStatusMessage(null)
  }

  const handleSelectChange = (name: string, value: string) => {
    setSettings((prev) => ({ ...prev, [name]: value }))
    setStatusMessage(null)
  }

  const handleSwitchChange = (name: string, checked: boolean) => {
    setSettings((prev) => ({ ...prev, [name]: checked }))
    setStatusMessage(null)
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target
    setSettings((prev) => ({ ...prev, [name]: Number.parseInt(value, 10) }))
    setStatusMessage(null)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setStatusMessage(null)

    try {
      // Připravit data pro aktualizaci
      const updateData = {
        segmentation_settings: JSON.stringify(settings)
      };
      
      // Poslat aktualizační požadavek
      const response = await fetchWithAuth(USER_ENDPOINTS.update, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(updateData),
      });

      if (response.ok) {
        const updatedUser = await response.json();
        console.log("SegmentationSettings: Settings saved successfully:", updatedUser);
        
        setStatusMessage({
          type: 'success',
          message: "Vaše preference segmentace byly úspěšně uloženy."
        });
        
        toast({
          title: "Nastavení segmentace aktualizováno",
          description: "Vaše preference segmentace byly úspěšně uloženy.",
        });
      } else {
        const errorData = await response.json().catch(() => ({}));
        
        setStatusMessage({
          type: 'error',
          message: errorData.detail || "Nepodařilo se aktualizovat nastavení segmentace."
        });
        
        toast({
          title: "Chyba",
          description: errorData.detail || "Nepodařilo se aktualizovat nastavení segmentace.",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("Failed to update segmentation settings:", error);
      setStatusMessage({
        type: 'error',
        message: "Nepodařilo se aktualizovat nastavení segmentace."
      });

      toast({
        title: "Chyba",
        description: "Nepodařilo se aktualizovat nastavení segmentace.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      <div className="grid gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Nastavení segmentačního modelu</CardTitle>
            <CardDescription>Upravte výchozí nastavení pro segmentaci obrázků</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
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
              <Label htmlFor="defaultModel">Výchozí segmentační model</Label>
              <Select
                value={settings.defaultModel}
                onValueChange={(value) => handleSelectChange("defaultModel", value)}
              >
                <SelectTrigger id="defaultModel">
                  <SelectValue placeholder="Vyberte model" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="neural-network-v1">Neural Network v1</SelectItem>
                  <SelectItem value="neural-network-v2">Neural Network v2 (doporučeno)</SelectItem>
                  <SelectItem value="unet">U-Net</SelectItem>
                  <SelectItem value="mask-rcnn">Mask R-CNN</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Tento model bude použit jako výchozí pro všechny nové projekty.
              </p>
            </div>

            <div className="space-y-2">
              <div className="flex justify-between">
                <Label htmlFor="confidenceThreshold">Práh spolehlivosti</Label>
                <span className="text-sm font-medium">{settings.confidenceThreshold}%</span>
              </div>
              <Slider
                id="confidenceThreshold"
                value={[settings.confidenceThreshold]}
                min={0}
                max={100}
                step={1}
                onValueChange={(value) => handleSliderChange("confidenceThreshold", value)}
              />
              <p className="text-xs text-muted-foreground">
                Minimální úroveň spolehlivosti pro zahrnutí segmentace do výsledků.
              </p>
            </div>

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="postProcessing">Post-processing</Label>
                <p className="text-sm text-muted-foreground">
                  Automaticky vyhlazovat a optimalizovat segmentační masky.
                </p>
              </div>
              <Switch
                id="postProcessing"
                checked={settings.postProcessing}
                onCheckedChange={(checked) => handleSwitchChange("postProcessing", checked)}
              />
            </div>

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="autoSave">Automatické ukládání</Label>
                <p className="text-sm text-muted-foreground">Automaticky ukládat změny v editoru segmentace.</p>
              </div>
              <Switch
                id="autoSave"
                checked={settings.autoSave}
                onCheckedChange={(checked) => handleSwitchChange("autoSave", checked)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="maxImageSize">Maximální velikost obrázku (px)</Label>
              <Input
                id="maxImageSize"
                name="maxImageSize"
                type="number"
                min="512"
                max="8192"
                value={settings.maxImageSize}
                onChange={handleInputChange}
              />
              <p className="text-xs text-muted-foreground">
                Obrázky větší než tato hodnota budou automaticky zmenšeny pro zpracování.
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="colorScheme">Barevné schéma segmentace</Label>
              <Select value={settings.colorScheme} onValueChange={(value) => handleSelectChange("colorScheme", value)}>
                <SelectTrigger id="colorScheme">
                  <SelectValue placeholder="Vyberte barevné schéma" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="red">Červená</SelectItem>
                  <SelectItem value="green">Zelená</SelectItem>
                  <SelectItem value="blue">Modrá</SelectItem>
                  <SelectItem value="yellow">Žlutá</SelectItem>
                  <SelectItem value="rainbow">Duhové</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Barva použitá pro zobrazení segmentačních masek v editoru.
              </p>
            </div>
          </CardContent>
          <CardFooter className="flex justify-end">
            <Button type="submit" disabled={isLoading}>
              {isLoading ? "Ukládání..." : "Uložit nastavení"}
            </Button>
          </CardFooter>
        </Card>
      </div>
    </form>
  )
}

