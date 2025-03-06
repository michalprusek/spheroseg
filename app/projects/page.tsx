"use client"

import { useEffect, useState, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Trash2 } from "lucide-react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import NewProjectDialog from "@/components/new-project-dialog"
import { PROJECT_ENDPOINTS, fetchWithAuth } from "../api/api-config"
import { useToast } from "@/components/ui/use-toast"
import dynamic from 'next/dynamic'

// Project type
interface Project {
  id: number
  name: string
  description: string
  images_count: number
  created_at: string
  updated_at: string
}

// Check if we're in offline mode (using the dummy token)
const isOfflineModeActive = () => {
  try {
    if (typeof window === 'undefined') return false;
    const token = localStorage.getItem('token');
    return token === "offline_mode_dummy_token";
  } catch (error) {
    console.error("Chyba při kontrole offline módu:", error);
    return false;
  }
};

// Generate mock projects for offline mode
const generateMockProjects = (): Project[] => {
  return [
    {
      id: 1,
      name: "Demo projekt 1",
      description: "Ukázkový projekt v offline režimu",
      images_count: 5,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    },
    {
      id: 2,
      name: "Demo projekt 2",
      description: "Druhý ukázkový projekt",
      images_count: 3,
      created_at: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
      updated_at: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString()
    }
  ];
};

// Create a client-side only component
function ProjectsContent() {
  const [projects, setProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState(true)
  const [deleting, setDeleting] = useState<number | null>(null)
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null)
  const [isOfflineMode, setIsOfflineMode] = useState(false)
  const { toast } = useToast()
  const router = useRouter()

  // Bezpečný přístup k localStorage s error handlingem
  const getTokenSafely = () => {
    try {
      if (typeof window === 'undefined') return null;
      return localStorage.getItem('token');
    } catch (error) {
      console.error("Chyba při získávání tokenu:", error);
      return null;
    }
  }

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const token = getTokenSafely();
        
        if (!token) {
          router.push('/');
          return;
        }
        
        setIsAuthenticated(true);
        
        if (isOfflineModeActive()) {
          setProjects(generateMockProjects());
          setLoading(false);
          return;
        }
        
        await fetchProjects();
      } catch (error) {
        console.error("Chyba při kontrole autentizace:", error);
        toast({
          title: "Chyba",
          description: "Nastala chyba při ověřování přihlášení",
          variant: "destructive",
        });
        setLoading(false);
      }
    };
    
    checkAuth();
  }, []);

  useEffect(() => {
    // Bezpečné získání tokenu
    const token = getTokenSafely();
    const offlineMode = isOfflineModeActive();

    setIsAuthenticated(!!token);
    setIsOfflineMode(offlineMode);
    
    // Pokud není přihlášen, přesměrujeme na login
    if (token === null) {
      toast({
        title: "Přístup odepřen",
        description: "Pro přístup k projektům se musíte přihlásit",
        variant: "destructive",
      });
      router.replace('/login');
    }
    
    // V offline módu načteme ukázková data
    if (offlineMode) {
      setProjects(generateMockProjects());
      setLoading(false);
    }
  }, [router, toast, setProjects, setLoading, setIsAuthenticated, setIsOfflineMode]);

  const fetchProjects = useCallback(async () => {
    if (!isAuthenticated) return
    
    // V offline módu pouze obnovíme ukázková data
    if (isOfflineMode) {
      setLoading(true);
      // Simulujeme načítání
      setTimeout(() => {
        setProjects(generateMockProjects());
        setLoading(false);
      }, 500);
      return;
    }
    
    setLoading(true)
    try {
      const response = await fetchWithAuth(PROJECT_ENDPOINTS.list, {
        headers: {
          "Content-Type": "application/json",
        }
      })

      if (response.ok) {
        const data = await response.json()
        setProjects(data)
      } else {
        console.error("Failed to fetch projects")
        toast({
          title: "Chyba",
          description: "Nepodařilo se načíst projekty",
          variant: "destructive",
        })
        
        // Pokud dostaneme 401 Unauthorized, přesměrujeme na login
        if (response.status === 401) {
          localStorage.removeItem('token')
          setIsAuthenticated(false)
          router.replace('/login')
        }
      }
    } catch (error) {
      console.error("Error fetching projects:", error)
      toast({
        title: "Chyba",
        description: "Nepodařilo se načíst projekty",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }, [toast, router, isAuthenticated, isOfflineMode])

  const deleteProject = async (id: number) => {
    if (!isAuthenticated) return
    
    setDeleting(id)
    
    // V offline módu simulujeme mazání
    if (isOfflineMode) {
      // Simulace zpoždění
      await new Promise(resolve => setTimeout(resolve, 500));
      setProjects(projects.filter(project => project.id !== id));
      toast({
        title: "Úspěch",
        description: "Projekt byl úspěšně smazán (offline režim)",
      });
      setDeleting(null);
      return;
    }
    
    try {
      const response = await fetchWithAuth(PROJECT_ENDPOINTS.delete(id), {
        method: "DELETE"
      })

      if (response.ok) {
        setProjects(projects.filter(project => project.id !== id))
        toast({
          title: "Úspěch",
          description: "Projekt byl úspěšně smazán",
        })
      } else {
        console.error("Failed to delete project")
        toast({
          title: "Chyba",
          description: "Nepodařilo se smazat projekt",
          variant: "destructive",
        })
        
        // Pokud dostaneme 401 Unauthorized, přesměrujeme na login
        if (response.status === 401) {
          localStorage.removeItem('token')
          setIsAuthenticated(false)
          router.replace('/login')
        }
      }
    } catch (error) {
      console.error("Error deleting project:", error)
      toast({
        title: "Chyba",
        description: "Nepodařilo se smazat projekt",
        variant: "destructive",
      })
    } finally {
      setDeleting(null)
    }
  }

  // Fetch projects on component mount
  useEffect(() => {
    if (isAuthenticated && !isOfflineMode) {
      fetchProjects()
    }
  }, [fetchProjects, isAuthenticated, isOfflineMode])

  // Pokud ještě kontrolujeme autentizaci, zobrazíme načítací hlášku
  if (isAuthenticated === null) {
    return (
      <div className="container mx-auto py-8 text-center">
        <div className="text-center py-12 text-muted-foreground">Kontrola přihlášení...</div>
      </div>
    )
  }

  // Pokud uživatel není přihlášen, zobrazíme odkaz na přihlašovací stránku
  if (isAuthenticated === false) {
    return (
      <div className="container mx-auto py-8 text-center">
        <div className="text-center py-12">
          <h1 className="text-2xl font-bold mb-4">Přístup odepřen</h1>
          <p className="mb-6 text-muted-foreground">Pro přístup k projektům se musíte přihlásit</p>
          <Link href="/login">
            <Button>Přejít na přihlášení</Button>
          </Link>
        </div>
      </div>
    )
  }

  // Pokud je uživatel přihlášen, zobrazíme projekty
  return (
    <div className="container mx-auto py-8">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold">Moje projekty</h1>
          {isOfflineMode && (
            <p className="text-amber-500 font-medium mt-1">
              Aplikace běží v offline režimu
            </p>
          )}
        </div>
        <div className="flex gap-2">
          <Button 
            variant="outline" 
            onClick={fetchProjects}
            disabled={loading}
          >
            {loading ? "Načítání..." : "Obnovit"}
          </Button>
          <NewProjectDialog onProjectCreated={fetchProjects} />
        </div>
      </div>

      {loading ? (
        <div className="text-center py-12 text-muted-foreground">Načítání projektů...</div>
      ) : projects.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-xl mb-4">Zatím nemáte žádné projekty</p>
          <p className="text-muted-foreground mb-6">Vytvořte nový projekt pomocí tlačítka &quot;Nový projekt&quot;</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {projects.map(project => (
            <Card key={project.id} className="flex flex-col">
              <CardHeader>
                <CardTitle className="flex justify-between items-start">
                  <Link href={`/projects/${project.id}`} className="hover:underline truncate">
                    {project.name}
                  </Link>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="text-destructive hover:text-destructive/90 hover:bg-destructive/10 -mt-1 -mr-2"
                    onClick={() => deleteProject(project.id)}
                    disabled={deleting === project.id}
                  >
                    <Trash2 className="h-5 w-5" />
                  </Button>
                </CardTitle>
                <CardDescription className="line-clamp-2">
                  {project.description || "Bez popisu"}
                </CardDescription>
              </CardHeader>
              <CardContent className="flex-grow">
                <div className="text-sm text-muted-foreground">
                  <p>Počet obrázků: {project.images_count}</p>
                  <p>Vytvořeno: {new Date(project.created_at).toLocaleDateString()}</p>
                  <p>Poslední úprava: {new Date(project.updated_at).toLocaleDateString()}</p>
                </div>
              </CardContent>
              <CardFooter>
                <Button asChild className="w-full">
                  <Link href={`/projects/${project.id}`}>
                    Otevřít projekt
                  </Link>
                </Button>
              </CardFooter>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}

// Create a version of ProjectsContent that only renders on the client
const ProjectsContentNoSSR = dynamic(() => Promise.resolve(ProjectsContent), { 
  ssr: false,
  loading: () => (
    <div className="container mx-auto py-8 text-center">
      <div className="text-center py-12 text-muted-foreground">Načítání projektů...</div>
    </div>
  )
})

export default function ProjectsPage() {
  return <ProjectsContentNoSSR />
}

