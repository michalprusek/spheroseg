"use client"

import type React from "react"
import { useState, useEffect, useRef } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { AUTH_ENDPOINTS, USER_ENDPOINTS, fetchWithAuth } from "@/app/api/api-config"
import { useToast } from "@/components/ui/use-toast"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { AlertCircle, KeyRound, User } from "lucide-react"
import { Switch } from "@/components/ui/switch"
import { ThemeToggle } from "@/components/theme-toggle"
import { useTheme } from "next-themes"
import { ClientOnly } from "@/components/client-only"

// Timeout promise pro fetch, aby se nezasekl
const fetchWithTimeout = async (url: string, options: RequestInit, timeout: number = 10000) => {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeout);
  
  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal
    });
    clearTimeout(id);
    return response;
  } catch (error) {
    clearTimeout(id);
    throw error;
  }
};

export function LoginForm() {
  const [username, setUsername] = useState("newuser")
  const [password, setPassword] = useState("password123")
  const [isLoading, setIsLoading] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [responseDetails, setResponseDetails] = useState<Record<string, unknown> | null>(null)
  const [isOfflineMode, setIsOfflineMode] = useState(false)
  const router = useRouter()
  const { toast } = useToast()
  const [userTheme, setUserTheme] = useState<string | null>(null)
  const usernameInputRef = useRef<HTMLInputElement>(null);

  // Focus username input on mount
  useEffect(() => {
    // Short timeout to ensure DOM is fully loaded
    const timeout = setTimeout(() => {
      if (usernameInputRef.current) {
        usernameInputRef.current.focus();
      }
    }, 100);
    return () => clearTimeout(timeout);
  }, []);

  // Fetch user data including theme preferences
  const fetchUserTheme = async () => {
    try {
      const response = await fetchWithAuth(USER_ENDPOINTS.me);
      if (response.ok) {
        const userData = await response.json();
        console.log("Login: User data loaded, applying theme:", userData.theme);
        if (userData.theme) {
          setUserTheme(userData.theme);
        }
      }
    } catch (error) {
      console.error("Failed to fetch user data after login:", error);
    }
  };

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setErrorMessage(null)
    setResponseDetails(null)

    // If in offline mode, bypass API call and redirect
    if (isOfflineMode) {
      // Simulate API delay
      await new Promise((resolve) => setTimeout(resolve, 500));
      
      // Set dummy token
      const dummyToken = "offline_mode_dummy_token";
      localStorage.setItem('token', dummyToken);
      document.cookie = `access_token=${dummyToken}; path=/; max-age=${30 * 60}; SameSite=Lax`;
      
      toast({
        title: "Přihlášení úspěšné (offline režim)",
        description: "Byli jste úspěšně přihlášeni v testovacím režimu",
      });
      
      setIsLoading(false);
      router.push("/projects");
      return;
    }

    try {
      console.log("Sending request to:", AUTH_ENDPOINTS.login)
      const response = await fetchWithTimeout(AUTH_ENDPOINTS.login, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          username,
          password,
        }),
        credentials: 'include',
      }, 8000); // 8 sekund timeout

      console.log("Response status:", response.status)
      
      // Create a headers object in a type-safe way
      const headers: Record<string, string> = {};
      response.headers.forEach((value, key) => {
        headers[key] = value;
      });
      console.log("Response headers:", headers);
      
      let errorData: Record<string, unknown> = {}
      try {
        errorData = await response.clone().json()
        setResponseDetails(errorData)
        console.log("Response data:", errorData)
      } catch (parseError) {
        console.error("Error parsing response:", parseError)
        const text = await response.clone().text()
        console.log("Response text:", text)
        setResponseDetails({ text })
      }

      if (response.ok) {
        const data = errorData as { access_token: string, token_type: string };
        console.log("Login successful, storing token and redirecting to /projects");
        
        // Store token in localStorage for fetchWithAuth
        localStorage.setItem('token', data.access_token);
        
        // Store token in cookie for middleware
        document.cookie = `access_token=${data.access_token}; path=/; max-age=${30 * 60}; SameSite=Lax`;
        
        // Fetch user data including theme preferences
        await fetchUserTheme();
        
        toast({
          title: "Přihlášení úspěšné",
          description: "Byli jste úspěšně přihlášeni",
        })
        router.push("/projects")
      } else {
        const errorData = await response.json().catch(() => ({ detail: 'Failed to parse error response' }));
        const errorMsg = errorData?.detail || `Error ${response.status}: ${response.statusText}`;
        console.error("Login failed:", errorMsg);
        setErrorMessage(String(errorMsg));
        toast({
          title: "Chyba přihlášení",
          description: errorMsg,
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("Login exception:", error)
      
      // Specifická chyba pro AbortError (timeout)
      if (error instanceof DOMException && error.name === 'AbortError') {
        const timeoutMsg = "Časový limit pro připojení k serveru vypršel. Je API server spuštěný?";
        setErrorMessage(timeoutMsg);
        toast({
          title: "Chyba připojení",
          description: timeoutMsg,
          variant: "destructive",
        });
      } 
      // Chyba při nedostupnosti serveru
      else if (error instanceof TypeError && error.message.includes('fetch')) {
        const networkMsg = "Nelze se připojit k API serveru. Zkontrolujte, zda běží backend server.";
        setErrorMessage(networkMsg);
        toast({
          title: "Chyba připojení",
          description: networkMsg,
          variant: "destructive",
        });
      } 
      // Obecná chyba
      else {
        setErrorMessage(error instanceof Error ? error.message : String(error));
        toast({
          title: "Chyba přihlášení",
          description: "Došlo k chybě při komunikaci se serverem",
          variant: "destructive",
        });
      }
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div>
      {/* Theme handler that only runs on client */}
      <ClientOnly>
        <ThemeComponent />
      </ClientOnly>
      
      <div className="flex justify-end mb-4">
        <ThemeToggle />
      </div>
      
      <form onSubmit={handleSubmit} className="space-y-6">
        {errorMessage && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Chyba přihlášení</AlertTitle>
            <AlertDescription>
              {errorMessage}
              {errorMessage.includes('API server') && (
                <div className="mt-2 text-sm">
                  <strong>Tip:</strong> Ujistěte se, že Docker kontejnery běží pomocí <code className="bg-gray-200 dark:bg-gray-600 px-1">docker-compose up</code>.
                </div>
              )}
            </AlertDescription>
          </Alert>
        )}
        
        <div className="space-y-2">
          <Label htmlFor="username" className="text-foreground">Uživatelské jméno</Label>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none text-muted-foreground">
              <User size={16} />
            </div>
            <Input
              id="username"
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
              placeholder="Zadejte uživatelské jméno"
              ref={usernameInputRef}
              className="pl-10 border-2 focus:border-blue-500 focus:ring-2 focus:ring-blue-500 focus:outline-none"
              autoComplete="username"
            />
          </div>
        </div>
        
        <div className="space-y-2">
          <Label htmlFor="password" className="text-foreground">Heslo</Label>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none text-muted-foreground">
              <KeyRound size={16} />
            </div>
            <Input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              placeholder="Zadejte heslo"
              className="pl-10 border-2 focus:border-blue-500 focus:ring-2 focus:ring-blue-500 focus:outline-none"
              autoComplete="current-password"
            />
          </div>
        </div>
        
        <div className="flex flex-col space-y-4 sm:flex-row sm:space-y-0 sm:justify-between sm:items-center">
          <div className="flex items-center space-x-2">
            <Switch
              id="offline-mode"
              checked={isOfflineMode}
              onCheckedChange={setIsOfflineMode}
            />
            <Label htmlFor="offline-mode" className="cursor-pointer text-foreground">
              Offline režim
            </Label>
          </div>
          
          <div className="flex items-center space-x-2">
            <Switch
              id="dark-mode"
              checked={localStorage.getItem('theme') === 'dark'}
              onCheckedChange={(checked) => {
                const newTheme = checked ? 'dark' : 'light';
                localStorage.setItem('theme', newTheme);
                document.documentElement.classList.remove('light', 'dark');
                document.documentElement.classList.add(newTheme);
              }}
            />
            <Label htmlFor="dark-mode" className="cursor-pointer text-foreground">
              Tmavý režim
            </Label>
          </div>
        </div>
        
        <div className="text-sm text-foreground bg-muted/30 p-3 rounded-md border border-border">
          Pro testování použijte přihlašovací údaje: <strong>newuser</strong> / <strong>password123</strong>
        </div>
        
        <Button type="submit" className="w-full" disabled={isLoading}>
          {isLoading ? "Přihlašování..." : "Přihlásit se"}
        </Button>

        {process.env.NODE_ENV === 'development' && responseDetails && (
          <div className="mt-4 p-4 bg-muted/50 border border-border rounded text-xs overflow-auto max-h-40 text-foreground">
            <h4 className="font-bold mb-2">Debug Info:</h4>
            <pre>{JSON.stringify(responseDetails, null, 2)}</pre>
          </div>
        )}
      </form>
    </div>
  )
}


