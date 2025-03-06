"use client"

import * as React from "react"
import { useCallback, useEffect, useState } from "react"
import { Moon, Sun } from "lucide-react"
import { useTheme } from "next-themes"
import { Button } from "@/components/ui/button"
import { USER_ENDPOINTS, fetchWithAuth } from "@/app/api/api-config"
import { useToast } from "@/components/ui/use-toast"
import { ClientOnly } from "@/components/client-only"

// Client-side only theme toggle component
const ThemeToggleButton = () => {
  const { theme, setTheme } = useTheme()
  const { toast } = useToast()
  const [mounted, setMounted] = useState(false)

  // Only show the toggle after mounting to avoid hydration mismatch
  useEffect(() => {
    setMounted(true)
  }, [])

  // Function to update theme preference in the database
  const updateThemePreference = useCallback(async (newTheme: string) => {
    try {
      // Send request to update user profile with new theme
      const response = await fetchWithAuth(USER_ENDPOINTS.update, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          theme: newTheme
        }),
      });

      if (!response.ok) {
        console.error("Failed to update theme preference in database");
      }
    } catch (error) {
      console.error("Error saving theme preference:", error);
    }
  }, []);

  // Handle theme toggle with database update
  const handleToggleTheme = useCallback(() => {
    const newTheme = theme === "light" ? "dark" : "light";
    setTheme(newTheme);
    updateThemePreference(newTheme);
  }, [theme, setTheme, updateThemePreference]);

  // Don't render anything until mounted to avoid hydration mismatch
  if (!mounted) {
    return <Button variant="ghost" size="icon" disabled><Sun className="h-5 w-5" /></Button>
  }

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={handleToggleTheme}
      title={theme === "light" ? "Přepnout na tmavý režim" : "Přepnout na světlý režim"}
    >
      <Sun className="h-5 w-5 rotate-0 scale-100 transition-all dark:rotate-90 dark:scale-0" />
      <Moon className="absolute h-5 w-5 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
      <span className="sr-only">
        {theme === "light" ? "Přepnout na tmavý režim" : "Přepnout na světlý režim"}
      </span>
    </Button>
  )
}

// Export a wrapper that ensures client-side only rendering
export function ThemeToggle() {
  return (
    <ClientOnly>
      <ThemeToggleButton />
    </ClientOnly>
  )
} 