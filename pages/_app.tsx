import type { AppProps } from 'next/app'
import { ThemeProvider } from 'next-themes'
import { useState, useEffect } from 'react'
import { Inter } from 'next/font/google'
import '../app/globals.css'
import '../lib/i18n' // Import i18next konfigurace

// Inicializace fontu
const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
})

export default function MyApp({ Component, pageProps }: AppProps) {
  // State to track if component is mounted
  const [mounted, setMounted] = useState(false)

  // After mounting, we have access to the browser
  useEffect(() => {
    setMounted(true)
  }, [])

  // During server-side rendering, return a basic layout
  // This prevents hydration mismatch errors
  if (!mounted) {
    return (
      <div className={`light ${inter.variable} font-sans antialiased`}>
        <Component {...pageProps} />
      </div>
    )
  }

  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
      <div className={`${inter.variable} font-sans antialiased`}>
        <Component {...pageProps} />
      </div>
    </ThemeProvider>
  )
} 