"use client"

import { DashboardNav } from "@/components/dashboard/dashboard-nav"

export function DashboardSidebar() {
  return (
    <aside className="hidden w-64 flex-col border-r bg-muted/40 md:flex">
      <div className="flex flex-col gap-2 p-6">
        <DashboardNav />
      </div>
    </aside>
  )
}

