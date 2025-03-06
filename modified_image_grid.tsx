"use client"

import { useState } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Edit, Trash2, AlertCircle, CheckCircle, Clock, ChevronDown, SortAsc, SortDesc } from "lucide-react"
import Link from "next/link"
import Image from "next/image"
import { FallbackImage } from "@/components/ui/fallback-image"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { IMAGE_ENDPOINTS, fetchWithAuth } from "@/app/api/api-config"
import { useToast } from "@/components/ui/use-toast"
import { useEffect } from "react"

export type ImageStatus = "completed" | "processing" | "failed"

interface Image {
  id: number
  name: string
  status: ImageStatus
  thumbnail: string
  date: string
}

interface ImageGridProps {
  images: Image[]
  projectId: string
  onImageDeleted?: () => void
}

type SortField = "name" | "date" | "status"
type SortDirection = "asc" | "desc"

export default function ImageGrid({ images, projectId, onImageDeleted }: ImageGridProps) {
  const [selectedImages, setSelectedImages] = useState<number[]>([])
  const [sortField, setSortField] = useState<SortField>("date")
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc")
  const [deletingImages, setDeletingImages] = useState<number[]>([])
  const [imagesWithUrls, setImagesWithUrls] = useState<Image[]>([])
  const { toast } = useToast()
  
  // Pravidelná kontrola stavu segmentace
  useEffect(() => {
    // Aktualizuje thumbnaily a stav zpracování
    const checkImageStatus = async () => {
      const updatedImages = [...images];
      let hasChanges = false;
      
      for (const image of updatedImages) {
        // Pokud je obrázek ve stavu "processing", zkontrolujeme jeho stav
        if (image.status === "processing") {
          try {
            const response = await fetchWithAuth(IMAGE_ENDPOINTS.list(Number(projectId)));
            if (response.ok) {
              const data = await response.json();
              const updatedImage = data.find((img: any) => img.id === image.id);
              
              if (updatedImage && updatedImage.segmentation_status !== image.status) {
                image.status = updatedImage.segmentation_status;
                hasChanges = true;
              }
            }
          } catch (error) {
            console.error("Failed to check image status:", error);
          }
        }
      }
      
      if (hasChanges) {
        setImagesWithUrls([...updatedImages]);
      }
    };
    
    const intervalId = setInterval(checkImageStatus, 5000); // kontrola každých 5 sekund
    
    return () => clearInterval(intervalId);
  }, [images, projectId]);
  
  // Načtení aktuálních URL obrázků
  useEffect(() => {
    const loadImages = async () => {
      const updatedImages = [...images];
      
      for (let i = 0; i < updatedImages.length; i++) {
        const image = updatedImages[i];
        
        // Pokud thumbnail není URL (začínající s http), načteme aktuální URL
        if (image.thumbnail && image.thumbnail !== "/placeholder.svg" && !image.thumbnail.startsWith('http')) {
          try {
            const response = await fetchWithAuth(IMAGE_ENDPOINTS.url(image.id));
            if (response.ok) {
              const data = await response.json();
              if (data.url) {
                updatedImages[i] = { ...image, thumbnail: data.url };
              }
            }
          } catch (error) {
            console.error(`Failed to fetch thumbnail URL for image ${image.id}:`, error);
          }
        }
      }
      
      setImagesWithUrls(updatedImages);
    };
    
    loadImages();
  }, [images]);

  const toggleSelect = (id: number) => {
    setSelectedImages((prev) => prev.includes(id) ? prev.filter((imageId) => imageId !== id) : [...prev, id])
  }

  const getStatusIcon = (status: ImageStatus) => {
    switch (status) {
      case "completed":
        return <CheckCircle className="h-4 w-4 text-green-500" />
      case "processing":
        return <Clock className="h-4 w-4 text-blue-500" />
      case "failed":
        return <AlertCircle className="h-4 w-4 text-red-500" />
    }
  }

  const getStatusText = (status: ImageStatus) => {
    switch (status) {
      case "completed":
        return "Dokončeno"
      case "processing":
        return "Zpracovává se"
      case "failed":
        return "Chyba"
    }
  }

  const getStatusColor = (status: ImageStatus) => {
    switch (status) {
      case "completed":
        return "bg-green-100 text-green-800"
      case "processing":
        return "bg-blue-100 text-blue-800"
      case "failed":
        return "bg-red-100 text-red-800"
    }
  }

  const getStatusWeight = (status: ImageStatus) => {
    switch (status) {
      case "completed":
        return 2
      case "processing":
        return 1
      case "failed":
        return 0
    }
  }

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      // Toggle direction if clicking the same field
      setSortDirection(sortDirection === "asc" ? "desc" : "asc")
    } else {
      // Set new field and default to ascending
      setSortField(field)
      setSortDirection("asc")
    }
  }

  const deleteImage = async (imageId: number) => {
    setDeletingImages((prev) => [...prev, imageId])
    
    try {
      const response = await fetchWithAuth(IMAGE_ENDPOINTS.delete(imageId), {
        method: 'DELETE'
      })
      
      if (response.ok) {
        // Remove from selected images if it was selected
        setSelectedImages((prev) => prev.filter(id => id !== imageId))
        
        toast({
          title: "Úspěch",
          description: "Obrázek byl úspěšně smazán",
        })
        
        // Call the callback if provided
        if (onImageDeleted) {
          onImageDeleted()
        }
      } else {
        const errorData = await response.json().catch(() => ({}))
        console.error("Delete failed:", errorData)
        
        toast({
          title: "Chyba",
          description: errorData.detail || "Nepodařilo se smazat obrázek",
          variant: "destructive",
        })
      }
    } catch (error) {
      console.error("Delete failed:", error)
      toast({
        title: "Chyba",
        description: "Nepodařilo se smazat obrázek",
        variant: "destructive",
      })
    } finally {
      setDeletingImages((prev) => prev.filter(id => id !== imageId))
    }
  }

  const deleteSelectedImages = async () => {
    if (selectedImages.length === 0) return
    
    // Create a copy of the selected images
    const imagesToDelete = [...selectedImages]
    
    // Start deleting all selected images
    for (const imageId of imagesToDelete) {
      await deleteImage(imageId)
    }
  }

  // Použijeme aktuální verzi obrázků s URL, pokud je dostupná, jinak původní
  const displayImages = imagesWithUrls.length > 0 ? imagesWithUrls : images;

  const sortedImages = [...displayImages].sort((a, b) => {
    let comparison = 0

    if (sortField === "name") {
      comparison = a.name.localeCompare(b.name)
    } else if (sortField === "date") {
      comparison = new Date(a.date).getTime() - new Date(b.date).getTime()
    } else if (sortField === "status") {
      comparison = getStatusWeight(a.status) - getStatusWeight(b.status)
    }

    return sortDirection === "asc" ? comparison : -comparison
  })

  return (
    <div>
      {selectedImages.length > 0 && (
        <div className="flex justify-between items-center mb-4 p-2 bg-muted rounded">
          <span>Vybráno: {selectedImages.length} obrázků</span>
          <div className="flex gap-2">
            <Button 
              variant="outline" 
              size="sm" 
              onClick={deleteSelectedImages}
              disabled={deletingImages.length > 0}
            >
              <Trash2 className="h-4 w-4 mr-1" />
              Smazat
            </Button>
          </div>
        </div>
      )}

      <div className="flex justify-end mb-4">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm">
              Seřadit podle: {getSortFieldLabel(sortField)}
              <ChevronDown className="ml-2 h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => handleSort("name")}>
              Název{" "}
              {sortField === "name" &&
                (sortDirection === "asc" ? (
                  <SortAsc className="ml-2 h-4 w-4" />
                ) : (
                  <SortDesc className="ml-2 h-4 w-4" />
                ))}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => handleSort("date")}>
              Datum{" "}
              {sortField === "date" &&
                (sortDirection === "asc" ? (
                  <SortAsc className="ml-2 h-4 w-4" />
                ) : (
                  <SortDesc className="ml-2 h-4 w-4" />
                ))}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => handleSort("status")}>
              Status{" "}
              {sortField === "status" &&
                (sortDirection === "asc" ? (
                  <SortAsc className="ml-2 h-4 w-4" />
                ) : (
                  <SortDesc className="ml-2 h-4 w-4" />
                ))}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {sortedImages.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <p className="mb-4">Zatím nemáte žádné obrázky</p>
          <p>Začněte nahráním obrázků pomocí formuláře výše</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {sortedImages.map((image) => (
            <Card
              key={image.id}
              className={`overflow-hidden hover:shadow-md transition-shadow cursor-pointer ${
                selectedImages.includes(image.id) ? "ring-2 ring-primary" : ""
              }`}
              onClick={() => toggleSelect(image.id)}
            >
              <div className="relative aspect-square">
                <FallbackImage
                  src={image.thumbnail || "/placeholder.svg"}
                  alt={image.name}
                  fill
                  sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                  className="object-cover"
                />
                <div className="absolute top-2 right-2">
                  <Badge className={getStatusColor(image.status)}>
                    <span className="flex items-center">
                      {getStatusIcon(image.status)}
                      <span className="ml-1">{getStatusText(image.status)}</span>
                    </span>
                  </Badge>
                </div>
              </div>
              <CardContent className="p-3">
                <div className="flex justify-between items-center">
                  <div className="truncate text-sm font-medium">{image.name}</div>
                  <div className="flex">
                    {image.status === "completed" && (
                      <Link href={`/projects/${projectId}/edit/${image.id}`} onClick={(e) => e.stopPropagation()}>
                        <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                          <Edit className="h-4 w-4" />
                        </Button>
                      </Link>
                    )}
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      className="h-8 w-8 p-0"
                      onClick={(e) => {
                        e.stopPropagation()
                        deleteImage(image.id)
                      }}
                      disabled={deletingImages.includes(image.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">{image.date}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}

function getSortFieldLabel(field: SortField): string {
  switch (field) {
    case "name":
      return "Název"
    case "date":
      return "Datum"
    case "status":
      return "Status"
  }
} 