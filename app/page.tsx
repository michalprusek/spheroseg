"use client"

import { LoginForm } from "@/components/login-form"
import dynamic from 'next/dynamic'

// Create a version of LoginForm that only renders on the client
const LoginFormNoSSR = dynamic(() => Promise.resolve(LoginForm), { 
  ssr: false,
  loading: () => <div className="w-full h-[300px] flex items-center justify-center">Načítání...</div>
})

export default function Home() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-b from-background/50 to-background dark:from-background dark:to-background/80">
      <div className="w-full max-w-md p-8 space-y-8 bg-card rounded-xl shadow-lg border border-border">
        <div className="text-center">
          <h1 className="text-3xl font-bold text-foreground">SpheroSeg</h1>
          <p className="mt-2 text-sm text-muted-foreground">Platforma pro vědce k segmentaci obrazových dat</p>
        </div>
        <LoginFormNoSSR />
      </div>
    </div>
  )
}

