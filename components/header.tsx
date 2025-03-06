"use client"

import { useState, useEffect, useCallback } from "react"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { LogOut, Settings, Loader2 } from "lucide-react"
import { useToast } from "@/components/ui/use-toast"
import { USER_ENDPOINTS, fetchWithAuth } from "@/app/api/api-config"
import { useTheme } from "next-themes"
import { ClientOnly } from "@/components/client-only"

interface UserInfo {
  id: number
  username: string
  email: string
  full_name?: string
  profile_picture?: string
  theme?: string
}

export default function Header() {
  const pathname = usePathname()
  const router = useRouter()
  const [isLoggedIn, setIsLoggedIn] = useState(false)
  const [user, setUser] = useState<UserInfo | null>(null)
  const [loading, setLoading] = useState(true)
  const [profilePictureUrl, setProfilePictureUrl] = useState<string | null>(null)
  const { toast } = useToast()
  const [userTheme, setUserTheme] = useState<string | null>(null)
  
  // Check if user is on login page
  const isLoginPage = pathname === "/"
  
  // Fetch profile picture URL if user has a profile picture
  const fetchProfilePictureUrl = useCallback(async (userData: UserInfo) => {
    if (userData.profile_picture) {
      try {
        const response = await fetchWithAuth(USER_ENDPOINTS.profilePictureUrl)
        if (response.ok) {
          const data = await response.json()
          setProfilePictureUrl(data.url)
        }
      } catch (error) {
        console.error('Failed to fetch profile picture URL:', error)
      }
    }
  }, [])

  // Fetch user info
  const fetchUserInfo = useCallback(async () => {
    try {
      const response = await fetchWithAuth(USER_ENDPOINTS.me)

      if (response.ok) {
        const userData = await response.json()
        setUser(userData)
        setIsLoggedIn(true)
        
        // Fetch profile picture URL if available
        fetchProfilePictureUrl(userData)
        
        // Store user's theme preference
        if (userData.theme) {
          setUserTheme(userData.theme)
        }
      } else {
        setIsLoggedIn(false)
        setUser(null)
        setProfilePictureUrl(null)
        
        // If not on login page and not authenticated, redirect to login
        if (!isLoginPage) {
          router.push('/')
        }
      }
    } catch (error) {
      console.error('Failed to fetch user info:', error)
      setIsLoggedIn(false)
      setUser(null)
      setProfilePictureUrl(null)
      
      // If not on login page and error occurred, redirect to login
      if (!isLoginPage) {
        router.push('/')
      }
    } finally {
      setLoading(false)
    }
  }, [isLoginPage, router, fetchProfilePictureUrl])

  // Fetch user info on component mount and when pathname changes
  useEffect(() => {
    // If we're on the login page, don't try to fetch user info
    if (isLoginPage) {
      setLoading(false)
      return
    }
    
    // Reset loading state when pathname changes
    setLoading(true)
    fetchUserInfo()
  }, [pathname, fetchUserInfo, isLoginPage])

  // Handle logout
  const handleLogout = async () => {
    try {
      // Save current theme preference
      const currentTheme = localStorage.getItem('theme')
      
      // Clear cookies by setting them to expire
      document.cookie = "access_token=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;"
      
      // Clear localStorage
      localStorage.removeItem('token');
      
      // Restore theme preference in localStorage
      if (currentTheme) {
        localStorage.setItem('theme', currentTheme)
      }
      
      // Reset state
      setIsLoggedIn(false)
      setUser(null)
      setProfilePictureUrl(null)
      
      toast({
        title: "Odhlášeno",
        description: "Byli jste úspěšně odhlášeni",
      })
      
      // Redirect to login page
      router.push("/")
    } catch (error) {
      console.error('Error during logout:', error)
      toast({
        title: "Chyba",
        description: "Nastala chyba při odhlašování",
        variant: "destructive",
      })
    }
  }

  // Get user initials for avatar fallback
  const getUserInitials = () => {
    if (!user) return 'U'
    
    if (user.full_name) {
      const nameParts = user.full_name.split(' ')
      if (nameParts.length >= 2) {
        return `${nameParts[0][0]}${nameParts[1][0]}`.toUpperCase()
      }
      return user.full_name[0].toUpperCase()
    }
    
    return user.username[0].toUpperCase()
  }

  // Determine if we should force show the navigation based on URL
  const shouldShowNavigation = () => {
    // Always show navigation on projects page, even if loading user info
    return pathname?.startsWith('/projects') || pathname?.startsWith('/settings')
  }

  // Client-side only theme component
  const ThemeComponent = () => {
    const { setTheme } = useTheme()
    
    // Apply user's theme preference if available
    useEffect(() => {
      if (userTheme) {
        setTheme(userTheme)
      }
    }, [userTheme, setTheme])
    
    return null
  }

  return (
    <header className="border-b">
      {/* Theme handler that only runs on client */}
      <ClientOnly>
        <ThemeComponent />
      </ClientOnly>
      
      <div className="container mx-auto px-4 py-3 flex justify-between items-center">
        <Link href={isLoggedIn ? "/projects" : "/"} className="font-bold text-xl">
          SpheroSeg
        </Link>

        <div className="flex items-center gap-4">
          {(isLoggedIn || shouldShowNavigation()) && (
            <nav className="hidden md:flex gap-6 mr-4">
              <Link href="/projects" className={`text-sm font-medium ${pathname?.startsWith('/projects') ? 'text-black dark:text-white' : 'text-muted-foreground'}`}>
                Projekty
              </Link>
            </nav>
          )}

          {loading ? (
            <Button variant="ghost" size="icon" disabled>
              <Loader2 className="h-4 w-4 animate-spin" />
            </Button>
          ) : isLoggedIn ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="relative h-8 w-8 rounded-full">
                  <Avatar className="h-8 w-8">
                    <AvatarImage 
                      src={profilePictureUrl || '/images/placeholder-avatar.svg'} 
                      alt={user?.full_name || user?.username || 'Avatar'} 
                      onError={(e) => {
                        // Pokud se obrázek nepodaří načíst, nahradíme ho výchozím
                        e.currentTarget.src = '/images/placeholder-avatar.svg';
                      }}
                    />
                    <AvatarFallback>{getUserInitials()}</AvatarFallback>
                  </Avatar>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="w-56" align="end" forceMount>
                <DropdownMenuLabel className="font-normal">
                  <div className="flex flex-col space-y-1">
                    <p className="text-sm font-medium leading-none">{user?.full_name || user?.username}</p>
                    <p className="text-xs leading-none text-muted-foreground">{user?.email}</p>
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => router.push("/settings")}>
                  <Settings className="mr-2 h-4 w-4" />
                  <span>Nastavení</span>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleLogout}>
                  <LogOut className="mr-2 h-4 w-4" />
                  <span>Odhlásit se</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <Button onClick={() => {
              // Na hlavní stránce nemusíme přesměrovávat, jen přejdeme dolů na přihlašovací formulář
              if (pathname === '/') {
                window.scrollTo({
                  top: document.body.scrollHeight,
                  behavior: 'smooth'
                });
              } else {
                router.push('/');
              }
            }}>
              Přihlásit se
            </Button>
          )}
        </div>
      </div>
    </header>
  )
}

