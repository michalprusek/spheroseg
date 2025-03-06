"use client"

import type React from "react"

import { useState, useEffect, useRef, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { toast } from "@/components/ui/use-toast"
import { USER_ENDPOINTS, fetchWithAuth } from "@/app/api/api-config"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { CheckCircle, AlertCircle, Moon, Sun, Globe } from "lucide-react"
import { Separator } from "@/components/ui/separator"
import { useTheme } from "next-themes"
import { ClientOnly } from "@/components/client-only"

// Jednoduchá náhrada za useTheme z next-themes
// function useTheme() {
//   const [theme, setTheme] = useState<string>("light");
//   
//   const setThemeValue = (newTheme: string) => {
//     setTheme(newTheme);
//     // Aplikujeme třídu pro dark mode na document
//     if (newTheme === "dark") {
//       document.documentElement.classList.add("dark");
//     } else {
//       document.documentElement.classList.remove("dark");
//     }
//   };
//   
//   useEffect(() => {
//     // Detekce preferovaného barevného schématu uživatele
//     const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
//     if (prefersDark) {
//       setThemeValue("dark");
//     }
//   }, []);
// 
//   return { theme, setTheme: setThemeValue };
// }

interface UserProfile {
  id: number
  username: string
  email: string
  full_name?: string
  profile_picture?: string
  language?: string
  theme?: string
}

export default function ProfileSettings() {
  const [isLoading, setIsLoading] = useState(false)
  const [isUploading, setIsUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null)
  const [statusMessage, setStatusMessage] = useState<{type: 'success' | 'error', message: string} | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [userTheme, setUserTheme] = useState<string | null>(null)

  const [formData, setFormData] = useState<UserProfile>({
    id: 0,
    username: "",
    email: "",
    full_name: "",
    profile_picture: "",
    language: "cs-CZ",
    theme: "light"
  })

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

  // Function to apply theme to document
  const applyTheme = useCallback((theme: string) => {
    // Ensure theme is a valid Theme type
    if (theme === "dark" || theme === "light" || theme === "system") {
      setUserTheme(theme)
    }
  }, []);

  // Fetch user data on mount
  useEffect(() => {
    const fetchUserData = async () => {
      try {
        const response = await fetchWithAuth(USER_ENDPOINTS.me)
        if (response.ok) {
          const userData = await response.json();
          console.log("ProfileSettings: User data loaded:", userData);
          setUserProfile(userData);
          
          // Get profile picture URL if available
          if (userData.profile_picture) {
            try {
              const urlResponse = await fetchWithAuth(USER_ENDPOINTS.profilePictureUrl);
              if (urlResponse.ok) {
                const { url } = await urlResponse.json();
                console.log("ProfileSettings: Profile picture URL:", url);
                // Update user profile with the full URL
                setUserProfile(prev => prev ? {...prev, profile_picture: url} : prev);
              }
            } catch (error) {
              console.error("Error fetching profile picture URL:", error);
            }
          }
          
          // Set form data from user profile
          setFormData({
            id: userData.id,
            username: userData.username,
            email: userData.email,
            full_name: userData.full_name || "",
            profile_picture: userData.profile_picture || "",
            language: userData.language || "cs-CZ",
            theme: userData.theme || "light"
          });
          
          // Apply user's theme preference
          if (userData.theme) {
            setUserTheme(userData.theme);
          }
        }
      } catch (error) {
        console.error("Error fetching user data:", error);
        setStatusMessage({
          type: 'error',
          message: 'Nepodařilo se načíst uživatelský profil. Zkuste to prosím později.'
        });
      }
    };
    
    fetchUserData();
  }, []);

  // Handle form input changes
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  // Handle select changes
  const handleSelectChange = (name: string, value: string) => {
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
    
    // If theme is changed, apply it immediately
    if (name === 'theme') {
      applyTheme(value);
    }
  };

  // Handle form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setStatusMessage(null);
    
    try {
      const response = await fetchWithAuth(USER_ENDPOINTS.update, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          full_name: formData.full_name,
          language: formData.language,
          theme: formData.theme
        }),
      });
      
      if (response.ok) {
        setStatusMessage({
          type: 'success',
          message: 'Profil byl úspěšně aktualizován.'
        });
        
        // Apply theme if it was changed
        if (formData.theme) {
          applyTheme(formData.theme);
        }
      } else {
        const errorData = await response.json();
        setStatusMessage({
          type: 'error',
          message: errorData.detail || 'Nepodařilo se aktualizovat profil. Zkuste to prosím později.'
        });
      }
    } catch (error) {
      console.error("Error updating profile:", error);
      setStatusMessage({
        type: 'error',
        message: 'Došlo k chybě při komunikaci se serverem. Zkuste to prosím později.'
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Handle profile picture upload
  const handleProfilePictureUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    
    const file = files[0];
    
    // Check file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      setStatusMessage({
        type: 'error',
        message: 'Soubor je příliš velký. Maximální velikost je 5MB.'
      });
      return;
    }
    
    // Check file type
    if (!file.type.startsWith('image/')) {
      setStatusMessage({
        type: 'error',
        message: 'Neplatný formát souboru. Nahrajte prosím obrázek.'
      });
      return;
    }
    
    setIsUploading(true);
    setUploadProgress(0);
    setStatusMessage(null);
    
    try {
      // Create FormData
      const formData = new FormData();
      formData.append('file', file);
      
      // Upload profile picture
      const response = await fetchWithAuth(USER_ENDPOINTS.uploadProfilePicture, {
        method: 'POST',
        body: formData,
      });
      
      if (response.ok) {
        // Get updated profile picture URL
        const urlResponse = await fetchWithAuth(USER_ENDPOINTS.profilePictureUrl);
        if (urlResponse.ok) {
          const { url } = await urlResponse.json();
          
          // Update user profile and form data
          setUserProfile(prev => prev ? {...prev, profile_picture: url} : prev);
          setFormData(prev => ({...prev, profile_picture: url}));
          
          setStatusMessage({
            type: 'success',
            message: 'Profilový obrázek byl úspěšně nahrán.'
          });
        }
      } else {
        const errorData = await response.json();
        setStatusMessage({
          type: 'error',
          message: errorData.detail || 'Nepodařilo se nahrát profilový obrázek. Zkuste to prosím později.'
        });
      }
    } catch (error) {
      console.error("Error uploading profile picture:", error);
      setStatusMessage({
        type: 'error',
        message: 'Došlo k chybě při nahrávání profilového obrázku. Zkuste to prosím později.'
      });
    } finally {
      setIsUploading(false);
      setUploadProgress(100);
      
      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  // Handle profile picture removal
  const handleRemoveProfilePicture = async () => {
    setIsLoading(true);
    setStatusMessage(null);
    
    try {
      // Use the update endpoint to set profile_picture to null
      const response = await fetchWithAuth(USER_ENDPOINTS.update, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ profile_picture: null }),
      });
      
      if (response.ok) {
        // Update user profile and form data
        setUserProfile(prev => prev ? {...prev, profile_picture: undefined} : prev);
        setFormData(prev => ({...prev, profile_picture: ""}));
        
        setStatusMessage({
          type: 'success',
          message: 'Profilový obrázek byl úspěšně odstraněn.'
        });
      } else {
        const errorData = await response.json();
        setStatusMessage({
          type: 'error',
          message: errorData.detail || 'Nepodařilo se odstranit profilový obrázek. Zkuste to prosím později.'
        });
      }
    } catch (error) {
      console.error("Error removing profile picture:", error);
      setStatusMessage({
        type: 'error',
        message: 'Došlo k chybě při odstraňování profilového obrázku. Zkuste to prosím později.'
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Get user initials for avatar fallback
  const getUserInitials = () => {
    if (!userProfile) return 'U';
    
    if (userProfile.full_name) {
      const nameParts = userProfile.full_name.split(' ');
      if (nameParts.length >= 2) {
        return `${nameParts[0][0]}${nameParts[1][0]}`.toUpperCase();
      }
      return userProfile.full_name[0].toUpperCase();
    }
    
    return userProfile.username[0].toUpperCase();
  };

  // Handle profile picture click
  const handleProfilePictureClick = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  return (
    <>
      {/* Theme handler that only runs on client */}
      <ClientOnly>
        <ThemeComponent />
      </ClientOnly>
      
      <form onSubmit={handleSubmit}>
        {statusMessage && (
          <Alert className={`mb-6 ${statusMessage.type === 'success' ? 'bg-green-50 text-green-800 dark:bg-green-950 dark:text-green-200 border-green-200 dark:border-green-800' : 'bg-red-50 text-red-800 dark:bg-red-950 dark:text-red-200 border-red-200 dark:border-red-800'}`}>
            {statusMessage.type === 'success' ? (
              <CheckCircle className="h-4 w-4 mr-2" />
            ) : (
              <AlertCircle className="h-4 w-4 mr-2" />
            )}
            <AlertDescription>{statusMessage.message}</AlertDescription>
          </Alert>
        )}
        
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          {/* Profilové informace */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Osobní informace</CardTitle>
              <CardDescription>Základní informace o vašem profilu</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex justify-center mb-6">
                <div className="relative">
                  <Avatar 
                    className="h-24 w-24 cursor-pointer" 
                    onClick={handleProfilePictureClick}
                  >
                    {userProfile?.profile_picture ? (
                      <AvatarImage 
                        src={userProfile.profile_picture} 
                        alt={userProfile?.full_name || userProfile?.username || 'Avatar'} 
                        onError={(e) => {
                          console.error("Failed to load profile picture:", userProfile.profile_picture);
                          e.currentTarget.src = '/placeholder.svg';
                        }}
                      />
                    ) : (
                      <AvatarImage 
                        src="/placeholder.svg" 
                        alt={userProfile?.full_name || userProfile?.username || 'Avatar'} 
                      />
                    )}
                    <AvatarFallback className="text-2xl">
                      {getUserInitials()}
                    </AvatarFallback>
                  </Avatar>
                  <input
                    type="file"
                    ref={fileInputRef}
                    className="hidden"
                    accept="image/*"
                    onChange={handleProfilePictureUpload}
                  />
                  <div className="mt-2 text-center text-sm text-muted-foreground">
                    Klikněte pro změnu
                  </div>
                </div>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="name">Celé jméno</Label>
                <Input
                  id="name"
                  name="full_name"
                  value={formData.full_name}
                  onChange={handleInputChange}
                  placeholder="Vaše celé jméno"
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="email">E-mail</Label>
                <Input
                  id="email"
                  name="email"
                  type="email"
                  value={formData.email}
                  onChange={handleInputChange}
                  placeholder="Váš e-mail"
                />
              </div>
            </CardContent>
          </Card>
          
          {/* Nastavení aplikace */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Nastavení aplikace</CardTitle>
              <CardDescription>Změňte jazyk a motiv aplikace</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="language" className="flex items-center gap-2">
                  <Globe className="h-4 w-4" />
                  Jazyk aplikace
                </Label>
                <Select
                  value={formData.language}
                  onValueChange={(value) => handleSelectChange('language', value)}
                >
                  <SelectTrigger id="language">
                    <SelectValue placeholder="Vyberte jazyk" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="cs-CZ">Čeština</SelectItem>
                    <SelectItem value="en-US">English</SelectItem>
                    <SelectItem value="de-DE">Deutsch</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground mt-1">
                  Vyberte preferovaný jazyk rozhraní aplikace.
                </p>
              </div>
              
              <Separator />
              
              <div className="space-y-2">
                <Label htmlFor="theme" className="flex items-center gap-2">
                  {formData.theme === 'dark' ? (
                    <Moon className="h-4 w-4" />
                  ) : (
                    <Sun className="h-4 w-4" />
                  )}
                  Motiv aplikace
                </Label>
                <Select
                  value={formData.theme}
                  onValueChange={(value) => handleSelectChange('theme', value)}
                >
                  <SelectTrigger id="theme">
                    <SelectValue placeholder="Vyberte motiv" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="light">Světlý</SelectItem>
                    <SelectItem value="dark">Tmavý</SelectItem>
                    <SelectItem value="system">Podle systému</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground mt-1">
                  Vyberte preferovaný vzhled aplikace. Změna se projeví okamžitě.
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
        
        <div className="mt-6 flex justify-end">
          <Button type="submit" disabled={isLoading}>
            {isLoading ? "Ukládání..." : "Uložit změny"}
          </Button>
        </div>
      </form>
    </>
  );
}

