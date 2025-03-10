"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"

const languages = [
  {
    code: "en",
    name: "English",
    flag: "🇺🇸",
    native: "English",
  },
  {
    code: "cs",
    name: "Czech",
    flag: "🇨🇿",
    native: "Čeština",
  },
  {
    code: "de",
    name: "German",
    flag: "🇩🇪",
    native: "Deutsch",
  },
  {
    code: "fr",
    name: "French",
    flag: "🇫🇷",
    native: "Français",
  },
  {
    code: "es",
    name: "Spanish",
    flag: "🇪🇸",
    native: "Español",
  },
  {
    code: "ja",
    name: "Japanese",
    flag: "🇯🇵",
    native: "日本語",
  },
  {
    code: "zh",
    name: "Chinese (Simplified)",
    flag: "🇨🇳",
    native: "简体中文",
  },
]

export function LanguageSettings() {
  const [language, setLanguage] = useState("en")
  const [dateFormat, setDateFormat] = useState("mdy")
  const [timeFormat, setTimeFormat] = useState("12h")

  return (
    <div className="space-y-6">
      <div className="space-y-4">
        <h3 className="text-lg font-medium">Application Language</h3>
        <RadioGroup value={language} onValueChange={setLanguage} className="space-y-2">
          {languages.map((lang) => (
            <div key={lang.code} className="flex items-center justify-between rounded-md border p-4">
              <div className="flex items-center gap-2">
                <span className="text-xl">{lang.flag}</span>
                <div>
                  <div className="font-medium">{lang.name}</div>
                  <div className="text-sm text-muted-foreground">{lang.native}</div>
                </div>
              </div>
              <RadioGroupItem value={lang.code} id={`lang-${lang.code}`} />
            </div>
          ))}
        </RadioGroup>
      </div>

      <Separator />

      <div className="space-y-4">
        <h3 className="text-lg font-medium">Date & Time Format</h3>
        <div className="space-y-2">
          <Label>Date Format</Label>
          <RadioGroup
            value={dateFormat}
            onValueChange={setDateFormat}
            className="grid grid-cols-1 gap-2 sm:grid-cols-3"
          >
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="mdy" id="date-mdy" />
              <Label htmlFor="date-mdy">MM/DD/YYYY</Label>
            </div>
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="dmy" id="date-dmy" />
              <Label htmlFor="date-dmy">DD/MM/YYYY</Label>
            </div>
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="ymd" id="date-ymd" />
              <Label htmlFor="date-ymd">YYYY/MM/DD</Label>
            </div>
          </RadioGroup>
        </div>

        <div className="space-y-2">
          <Label>Time Format</Label>
          <RadioGroup
            value={timeFormat}
            onValueChange={setTimeFormat}
            className="grid grid-cols-1 gap-2 sm:grid-cols-2"
          >
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="12h" id="time-12h" />
              <Label htmlFor="time-12h">12-hour (AM/PM)</Label>
            </div>
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="24h" id="time-24h" />
              <Label htmlFor="time-24h">24-hour</Label>
            </div>
          </RadioGroup>
        </div>
      </div>

      <Separator />

      <Button className="w-full">Save Language Preferences</Button>
    </div>
  )
}

