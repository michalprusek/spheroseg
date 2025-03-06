"use client"

import { useEffect, useState, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ChevronLeft } from "lucide-react"
import ImageUploader from "@/components/image-uploader"
import ImageGrid from "@/components/image-grid"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { PROJECT_ENDPOINTS, IMAGE_ENDPOINTS, fetchWithAuth } from "@/app/api/api-config"
import { useToast } from "@/components/ui/use-toast"
import { Viewport } from 'next'

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
}

// Define the ImageStatus type to match the one in ImageGrid component
type ImageStatus = "completed" | "processing" | "failed" | "segmented" | "memory_error"

// Define the Project type
interface Project {
  id: number
  name: string
  description: string
  images_count: number
  created_at: string
  updated_at: string
}

// Define the Image type
interface Image {
  id: number
  name: string
  status: ImageStatus
  thumbnail: string
  date: string
}

// Define the API Image type
interface ApiImage {
  id: number
  filename: string
  segmentation_status?: ImageStatus
  thumbnail_url?: string
  created_at: string
}

export default function ProjectPage({ params }: { params: { id: string } }) {
  const [project, setProject] = useState<Project | null>(null)
  const [images, setImages] = useState<Image[]>([])
  const [loading, setLoading] = useState(true)
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null)
  const { toast } = useToast()
  const router = useRouter()

  // Kontrola autentizace
  useEffect(() => {
    const token = localStorage.getItem('token')
    setIsAuthenticated(!!token)
    
    // Pokud není přihlášen, přesměrujeme na login
    if (token === null) {
      toast({
        title: "Přístup odepřen",
        description: "Pro přístup k projektům se musíte přihlásit",
        variant: "destructive",
      })
      router.replace('/login')
    }
  }, [router, toast])

  // Fetch project details
  const fetchProject = useCallback(async () => {
    if (!isAuthenticated) return
    
    try {
      const response = await fetchWithAuth(PROJECT_ENDPOINTS.detail(Number(params.id)), {
        headers: {
          "Content-Type": "application/json",
        }
      })

      if (response.ok) {
        const data = await response.json()
        setProject(data)
      } else {
        console.error("Failed to fetch project: Status code", response.status)
        toast({
          title: "Chyba",
          description: "Nepodařilo se načíst projekt",
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
      console.error("Error fetching project:", error instanceof Error ? error.message : String(error))
      toast({
        title: "Chyba",
        description: "Nepodařilo se načíst projekt",
        variant: "destructive",
      })
    }
  }, [params.id, toast, router, isAuthenticated])

  // Fetch project images
  const fetchImages = useCallback(async () => {
    if (!isAuthenticated) return
    
    try {
      const response = await fetchWithAuth(IMAGE_ENDPOINTS.list(Number(params.id)))
      
      if (!response.ok) {
        console.error('Failed to fetch images: Status code', response.status)
        throw new Error('Failed to fetch images');
      }
      
      const data: ApiImage[] = await response.json();
      
      // Create a proper thumbnail URL for each image
      const formattedImages = data.map((img): Image => {
        // Convert API image format to our component format
        return {
          id: img.id,
          name: img.filename,
          status: (img.segmentation_status as ImageStatus) || "processing",
          // Generate thumbnail URL from the API if available, or use a placeholder
          thumbnail: img.thumbnail_url || "/placeholder.svg",
          date: img.created_at,
        };
      });
      setImages(formattedImages)
    } catch (error) {
      console.error('Error fetching images:', error instanceof Error ? error.message : String(error));
      // If API fails, use empty array
      setImages([])
    } finally {
      setLoading(false)
    }
  }, [params.id, isAuthenticated])

  // Fetch data on component mount
  useEffect(() => {
    if (isAuthenticated) {
      fetchProject()
      fetchImages()
    }
  }, [fetchProject, fetchImages, isAuthenticated])

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

  return (
    <div className="container mx-auto py-8">
      <div className="flex justify-between items-center mb-8">
        <div className="flex items-center gap-4">
          <Link href="/projects">
            <Button variant="outline" size="icon">
              <ChevronLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <h1 className="text-3xl font-bold">{project?.name || `Projekt #${params.id}`}</h1>
            <p className="text-muted-foreground">{project?.description || "Načítání..."}</p>
          </div>
        </div>
      </div>

      <Tabs defaultValue="images" className="w-full">
        <TabsList className="mb-4">
          <TabsTrigger value="images">Obrázky</TabsTrigger>
          <TabsTrigger value="settings">Nastavení segmentace</TabsTrigger>
          <TabsTrigger value="export">Export dat</TabsTrigger>
        </TabsList>
        <TabsContent value="images">
          <div className="mb-6">
            <ImageUploader projectId={params.id} onUploadComplete={fetchImages} />
          </div>
          {loading ? (
            <div className="text-center py-12 text-muted-foreground">Načítání obrázků...</div>
          ) : (
            <ImageGrid images={images} projectId={params.id} onImageDeleted={fetchImages} />
          )}
        </TabsContent>
        <TabsContent value="settings">
          <div className="bg-muted p-6 rounded-lg">
            <h3 className="text-lg font-medium mb-4">Nastavení segmentace</h3>
            <p>Zde můžete upravit parametry segmentačního modelu pro tento projekt.</p>
          </div>
        </TabsContent>
        <TabsContent value="export">
          <div className="bg-muted p-6 rounded-lg">
            <h3 className="text-lg font-medium mb-4">Export dat</h3>
            <p>Exportujte segmentovaná data v různých formátech.</p>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
} 