"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { BarChart3, FolderOpen, Image, LayoutDashboard, Settings } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"

const navItems = [
  {
    title: "Dashboard",
    href: "/dashboard",
    icon: <LayoutDashboard className="h-5 w-5" />,
  },
  {
    title: "Projects",
    href: "/dashboard/projects",
    icon: <FolderOpen className="h-5 w-5" />,
  },
  {
    title: "Image Processing",
    href: "/dashboard/processing",
    icon: <Image className="h-5 w-5" />,
  },
  {
    title: "Analysis",
    href: "/dashboard/analysis",
    icon: <BarChart3 className="h-5 w-5" />,
  },
  {
    title: "Statistics",
    href: "/dashboard/statistics",
    icon: <BarChart3 className="h-5 w-5" />,
  },
  {
    title: "Settings",
    href: "/dashboard/settings",
    icon: <Settings className="h-5 w-5" />,
  },
]

export function DashboardNav() {
  const pathname = usePathname()

  return (
    <nav className="grid gap-2">
      {navItems.map((item) => (
        <Link key={item.href} href={item.href}>
          <Button
            variant={pathname === item.href ? "secondary" : "ghost"}
            className={cn(
              "w-full justify-start",
              pathname === item.href ? "bg-secondary" : "hover:bg-transparent hover:underline",
            )}
          >
            {item.icon}
            <span className="ml-2">{item.title}</span>
          </Button>
        </Link>
      ))}
    </nav>
  )
}

