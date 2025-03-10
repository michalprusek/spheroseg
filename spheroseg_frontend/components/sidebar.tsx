"use client"

import { useState } from "react"
import { MainNav } from "@/components/main-nav"
import { ThemeToggle } from "@/components/theme-toggle"
import { Microscope, Menu, X } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet"

interface SidebarProps {
  className?: string
}

export function Sidebar({ className }: SidebarProps) {
  const [isMobileOpen, setIsMobileOpen] = useState(false)

  return (
    <>
      {/* Mobile Menu Button */}
      <Sheet open={isMobileOpen} onOpenChange={setIsMobileOpen}>
        <SheetTrigger asChild>
          <Button variant="ghost" size="icon" className="md:hidden">
            <Menu className="h-6 w-6" />
            <span className="sr-only">Toggle Menu</span>
          </Button>
        </SheetTrigger>
        <SheetContent side="left" className="p-0">
          <div className="flex h-full flex-col">
            <div className="flex h-14 items-center border-b px-4">
              <Microscope className="mr-2 h-6 w-6 text-primary" />
              <span className="font-bold text-lg">SpheroSeg</span>
              <Button variant="ghost" size="icon" className="ml-auto" onClick={() => setIsMobileOpen(false)}>
                <X className="h-5 w-5" />
                <span className="sr-only">Close</span>
              </Button>
            </div>
            <div className="flex-1 overflow-auto">
              <MainNav />
            </div>
            <div className="flex items-center justify-between border-t p-4">
              <ThemeToggle />
              <span className="text-xs text-muted-foreground">v1.0.0</span>
            </div>
          </div>
        </SheetContent>
      </Sheet>

      {/* Desktop Sidebar */}
      <div className={cn("hidden h-screen flex-col border-r md:flex", className)}>
        <div className="flex h-14 items-center border-b px-4">
          <Microscope className="mr-2 h-6 w-6 text-primary" />
          <span className="font-bold text-lg">SpheroSeg</span>
        </div>
        <div className="flex-1 overflow-auto">
          <MainNav />
        </div>
        <div className="flex items-center justify-between border-t p-4">
          <ThemeToggle />
          <span className="text-xs text-muted-foreground">v1.0.0</span>
        </div>
      </div>
    </>
  )
}

