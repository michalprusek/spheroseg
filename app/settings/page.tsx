"use client"

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import dynamic from 'next/dynamic'
import { Suspense } from "react"
import { Viewport } from 'next'

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
}

// Dynamically import settings components with NoSSR
const ProfileSettings = dynamic(() => import("@/components/settings/profile-settings"), { 
  ssr: false,
  loading: () => <div className="p-4">Načítání nastavení profilu...</div>
})

const SecuritySettings = dynamic(() => import("@/components/settings/security-settings"), {
  ssr: false,
  loading: () => <div className="p-4">Načítání nastavení zabezpečení...</div>
})

const NotificationSettings = dynamic(() => import("@/components/settings/notification-settings"), {
  ssr: false,
  loading: () => <div className="p-4">Načítání nastavení oznámení...</div>
})

const SegmentationSettings = dynamic(() => import("@/components/settings/segmentation-settings"), {
  ssr: false,
  loading: () => <div className="p-4">Načítání nastavení segmentace...</div>
})

const ApiSettings = dynamic(() => import("@/components/settings/api-settings"), {
  ssr: false,
  loading: () => <div className="p-4">Načítání nastavení API...</div>
})

export default function SettingsPage() {
  return (
    <div className="container mx-auto py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold">Nastavení uživatele</h1>
        <p className="text-muted-foreground">Spravujte svůj účet a nastavení segmentace</p>
      </div>

      <Tabs defaultValue="profile" className="w-full">
        <TabsList className="mb-8 grid w-full grid-cols-5">
          <TabsTrigger value="profile">Profil</TabsTrigger>
          <TabsTrigger value="security">Zabezpečení</TabsTrigger>
          <TabsTrigger value="notifications">Oznámení</TabsTrigger>
          <TabsTrigger value="segmentation">Segmentace</TabsTrigger>
          <TabsTrigger value="api">API klíče</TabsTrigger>
        </TabsList>

        <Suspense fallback={<div className="p-4">Načítání obsahu...</div>}>
          <TabsContent value="profile">
            <ProfileSettings />
          </TabsContent>

          <TabsContent value="security">
            <SecuritySettings />
          </TabsContent>

          <TabsContent value="notifications">
            <NotificationSettings />
          </TabsContent>

          <TabsContent value="segmentation">
            <SegmentationSettings />
          </TabsContent>

          <TabsContent value="api">
            <ApiSettings />
          </TabsContent>
        </Suspense>
      </Tabs>
    </div>
  )
}

