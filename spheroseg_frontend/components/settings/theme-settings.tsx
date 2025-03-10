"use client"

import { useState } from "react"
import { useTheme } from "next-themes"
import { Monitor, Moon, Sun } from "lucide-react"
import { Label } from "@/components/ui/label"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Separator } from "@/components/ui/separator"
import { Slider } from "@/components/ui/slider"
import { Switch } from "@/components/ui/switch"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

export function ThemeSettings() {
  const { theme, setTheme } = useTheme()
  const [fontSize, setFontSize] = useState(16)
  const [animationsEnabled, setAnimationsEnabled] = useState(true)
  const [highContrastMode, setHighContrastMode] = useState(false)
  const [colorTheme, setColorTheme] = useState("blue")

  return (
    <div className="space-y-6">
      <div className="space-y-4">
        <h3 className="text-lg font-medium">Theme</h3>
        <RadioGroup defaultValue={theme} onValueChange={(value) => setTheme(value)} className="grid grid-cols-3 gap-4">
          <div>
            <RadioGroupItem value="light" id="theme-light" className="peer sr-only" />
            <Label
              htmlFor="theme-light"
              className="flex flex-col items-center justify-between rounded-md border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary [&:has([data-state=checked])]:border-primary"
            >
              <Sun className="mb-3 h-6 w-6" />
              Light
            </Label>
          </div>
          <div>
            <RadioGroupItem value="dark" id="theme-dark" className="peer sr-only" />
            <Label
              htmlFor="theme-dark"
              className="flex flex-col items-center justify-between rounded-md border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary [&:has([data-state=checked])]:border-primary"
            >
              <Moon className="mb-3 h-6 w-6" />
              Dark
            </Label>
          </div>
          <div>
            <RadioGroupItem value="system" id="theme-system" className="peer sr-only" />
            <Label
              htmlFor="theme-system"
              className="flex flex-col items-center justify-between rounded-md border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary [&:has([data-state=checked])]:border-primary"
            >
              <Monitor className="mb-3 h-6 w-6" />
              System
            </Label>
          </div>
        </RadioGroup>
      </div>

      <Separator />

      <div className="space-y-4">
        <h3 className="text-lg font-medium">Color Theme</h3>
        <Select value={colorTheme} onValueChange={setColorTheme}>
          <SelectTrigger>
            <SelectValue placeholder="Select color theme" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="blue">Blue (Default)</SelectItem>
            <SelectItem value="purple">Purple</SelectItem>
            <SelectItem value="green">Green</SelectItem>
            <SelectItem value="orange">Orange</SelectItem>
            <SelectItem value="red">Red</SelectItem>
          </SelectContent>
        </Select>

        <div className="flex flex-wrap gap-2">
          <div className={`h-8 w-8 rounded-full bg-primary ${colorTheme === "blue" ? "ring-2 ring-ring" : ""}`}></div>
          <div
            className={`h-8 w-8 rounded-full bg-[#8b5cf6] ${colorTheme === "purple" ? "ring-2 ring-ring" : ""}`}
          ></div>
          <div
            className={`h-8 w-8 rounded-full bg-[#22c55e] ${colorTheme === "green" ? "ring-2 ring-ring" : ""}`}
          ></div>
          <div
            className={`h-8 w-8 rounded-full bg-[#f97316] ${colorTheme === "orange" ? "ring-2 ring-ring" : ""}`}
          ></div>
          <div className={`h-8 w-8 rounded-full bg-[#ef4444] ${colorTheme === "red" ? "ring-2 ring-ring" : ""}`}></div>
        </div>
      </div>

      <Separator />

      <div className="space-y-4">
        <h3 className="text-lg font-medium">Accessibility</h3>
        <div className="flex items-center justify-between">
          <Label htmlFor="high-contrast">High contrast mode</Label>
          <Switch id="high-contrast" checked={highContrastMode} onCheckedChange={setHighContrastMode} />
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label htmlFor="font-size">Font size ({fontSize}px)</Label>
          </div>
          <Slider
            id="font-size"
            min={12}
            max={24}
            step={1}
            value={[fontSize]}
            onValueChange={(value) => setFontSize(value[0])}
          />
        </div>

        <div className="flex items-center justify-between">
          <Label htmlFor="animations">Enable animations</Label>
          <Switch id="animations" checked={animationsEnabled} onCheckedChange={setAnimationsEnabled} />
        </div>
      </div>

      <Separator />

      <Button className="w-full">Save Preferences</Button>
    </div>
  )
}

