"use client"

import { useState, useEffect } from "react"
import { Bell } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet"
import { NotificationList } from "./notification-list"
import { useNotifications } from "@/hooks/use-notifications"

export function NotificationCenter() {
  const { notifications, markAsRead, clearAll } = useNotifications()
  const [unreadCount, setUnreadCount] = useState(0)

  useEffect(() => {
    setUnreadCount(notifications.filter(n => !n.read).length)
  }, [notifications])

  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <span className="absolute -right-1 -top-1 h-4 w-4 rounded-full bg-primary text-xs text-white">
              {unreadCount}
            </span>
          )}
        </Button>
      </SheetTrigger>
      <SheetContent>
        <SheetHeader>
          <SheetTitle>Notifications</SheetTitle>
          <Button variant="ghost" size="sm" onClick={clearAll}>
            Clear all
          </Button>
        </SheetHeader>
        <NotificationList 
          notifications={notifications}
          onMarkAsRead={markAsRead}
        />
      </SheetContent>
    </Sheet>
  )
}