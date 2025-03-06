"use client"

import { useState, useCallback } from "react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Edit, Trash2, AlertCircle, CheckCircle, Clock, ChevronDown, SortAsc, SortDesc, Loader2, XCircle } from "lucide-react"
import Link from "next/link"
import Image from "next/image"
import { FallbackImage } from "@/components/ui/fallback-image"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { IMAGE_ENDPOINTS, fetchWithAuth, isOfflineMode } from "@/app/api/api-config"
import { useToast } from "@/components/ui/use-toast"
import { useEffect } from "react"
import { cn } from "@/lib/utils"
import { Spinner } from "../components/ui/spinner"
import { ImageIcon } from "lucide-react"

export type ImageStatus = "completed" | "processing" | "failed" | "segmented" | "memory_error"

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
  const [isLoading, setIsLoading] = useState<boolean>(false)
  // Track images that need status checking
  const [processingImages, setProcessingImages] = useState<number[]>([])
  const [deletingImages, setDeletingImages] = useState<number[]>([])
  const [imagesWithUrls, setImagesWithUrls] = useState<Image[]>([])
  const { toast } = useToast()
  
  // Function to check status of processing images - defined with useCallback before it's used in useEffect
  const checkImageStatus = useCallback(async () => {
    if (processingImages.length === 0) return;
    
    // V offline režimu neprovádíme kontrolu
    if (isOfflineMode()) return;
    
    // Použijeme jediný try/catch blok pro celý set obrázků
    try {
      // Pro každý obrázek ve zpracování kontrolujeme jeho stav
      const promises = processingImages.map(async (imageId) => {
        try {
          const response = await fetchWithAuth(IMAGE_ENDPOINTS.status(imageId));
          
          if (response.ok) {
            const data = await response.json();
            
            console.log(`Image ${imageId} status check response:`, data);
            
            // Check if status changed from processing
            if (data.status !== "processing") {
              console.log(`Image ${imageId} status changed from processing to ${data.status}`);
              
              // Instead of immediately triggering a full reload, update the state directly
              setImagesWithUrls(prev => {
                const newImagesWithUrls = prev.map(img => 
                  img.id === imageId ? { ...img, status: data.status as ImageStatus } : img
                );
                console.log(`Updated imagesWithUrls for image ${imageId}:`, 
                  prev.find(img => img.id === imageId)?.status, 
                  "->", 
                  newImagesWithUrls.find(img => img.id === imageId)?.status
                );
                return newImagesWithUrls;
              });
              
              // Also notify parent if needed
              if (onImageDeleted) {
                console.log(`Notifying parent that image ${imageId} status changed`);
                return { shouldRemove: true, id: imageId };
              }
            }
          }
          return { shouldRemove: false, id: imageId };
        } catch (error) {
          // Tichá chyba pro jednotlivé obrázky
          return { shouldRemove: false, id: imageId };
        }
      });
      
      // Zpracujeme výsledky všech požadavků
      const results = await Promise.all(promises);
      const imagesToRemove = results.filter(r => r.shouldRemove).map(r => r.id);
      
      if (imagesToRemove.length > 0 && onImageDeleted) {
        // Odstraníme zpracované obrázky ze seznamu ke kontrole
        setProcessingImages(prev => prev.filter(id => !imagesToRemove.includes(id)));
        onImageDeleted();
      }
    } catch (error) {
      // Tento blok by měl zachytit pouze chyby mimo Promise.all
      console.warn("Chyba při hromadné kontrole stavu obrázků");
    }
  }, [processingImages, onImageDeleted, setImagesWithUrls])
  
  // Set up periodic status checking for images in "processing" state
  useEffect(() => {
    console.log("Setting up status polling for processing images");
    
    // Identify images that need status checking
    const imagesNeedingCheck = images.filter(img => img.status === "processing").map(img => img.id)
    
    // Only update state if there's a real change to avoid re-renders
    const hasChanges = imagesNeedingCheck.length !== processingImages.length || 
      (processingImages.length > 0 && imagesNeedingCheck.some(id => !processingImages.includes(id)));
      
    if (hasChanges) {
      console.log("Updating processing images list:", imagesNeedingCheck);
      setProcessingImages(imagesNeedingCheck)
    }
    
    if (imagesNeedingCheck.length === 0) return
    
    // Set up interval to check status - reduced to 3 seconds for faster checking
    const interval = setInterval(checkImageStatus, 3000)
    console.log(`Status polling started for ${imagesNeedingCheck.length} images`);
    
    return () => {
      console.log("Cleaning up status polling interval");
      clearInterval(interval)
    }
  }, [images, checkImageStatus, processingImages])
  
  // Load images with their URLs
  useEffect(() => {
    const loadImages = async () => {
      setIsLoading(true)
      try {
        // Log the incoming images for debugging
        console.log("ImageGrid: Loading images:", images);
        
        // Pokud jsme v offline režimu, použijeme přímo dodané obrázky
        if (isOfflineMode()) {
          console.log("ImageGrid: Offline mode, using provided images");
          setImagesWithUrls(images);
          return;
        }
        
        // Check if the image IDs have changed - this means we need to refresh all thumbnails
        const currentImageIds = imagesWithUrls.map(img => img.id);
        const newImageIds = images.map(img => img.id);
        const imageIdsChanged = 
          JSON.stringify(currentImageIds) !== JSON.stringify(newImageIds) ||
          currentImageIds.length === 0; // First load
        
        if (imageIdsChanged) {
          console.log("ImageGrid: Images changed, updating URLs");
          
          // First, update the state with the basic images to ensure we have status info
          // This keeps existing thumbnails but updates status and other properties
          const mergedImages = images.map(newImg => {
            // Find the existing image if available
            const existingImg = imagesWithUrls.find(img => img.id === newImg.id);
            
            if (existingImg) {
              // Preserve the thumbnail URL from existing image if it's valid
              return {
                ...newImg,
                thumbnail: existingImg.thumbnail && !existingImg.thumbnail.includes('placeholder') 
                  ? existingImg.thumbnail 
                  : newImg.thumbnail || "/images/placeholder-thumbnail.svg"
              };
            }
            
            return newImg;
          });
          
          // Update state with the merged images first
          setImagesWithUrls(mergedImages);
          
          // Then asynchronously fetch thumbnails for images that need them
          const imagesToUpdate = mergedImages.filter(
            img => !img.thumbnail || img.thumbnail.includes('placeholder')
          );
          
          if (imagesToUpdate.length > 0) {
            console.log(`ImageGrid: Fetching thumbnails for ${imagesToUpdate.length} images`);
            
            // Fetch thumbnails in parallel
            const results = await Promise.all(
              imagesToUpdate.map(async (img) => {
                try {
                  const response = await fetchWithAuth(IMAGE_ENDPOINTS.url(img.id));
                  
                  if (response.ok) {
                    const data = await response.json();
                    return {
                      id: img.id,
                      thumbnail: data.thumbnail || data.url
                    };
                  }
                } catch (error) {
                  console.error(`Error fetching thumbnail for image ${img.id}:`, error);
                }
                
                return null;
              })
            );
            
            // Filter out null results and apply thumbnail updates
            const thumbnailUpdates = results.filter(Boolean);
            
            if (thumbnailUpdates.length > 0) {
              console.log(`ImageGrid: Updating ${thumbnailUpdates.length} thumbnails`);
              
              setImagesWithUrls(prevImages => {
                return prevImages.map(img => {
                  const update = thumbnailUpdates.find(u => u?.id === img.id);
                  
                  if (update && update.thumbnail) {
                    return {
                      ...img,
                      thumbnail: update.thumbnail
                    };
                  }
                  
                  return img;
                });
              });
            }
          }
        }
      } catch (error) {
        console.error("Error loading images:", error)
      } finally {
        setIsLoading(false)
      }
    }
    
    loadImages()
  }, [images, imagesWithUrls])
  
  const toggleSelect = (id: number) => {
    setSelectedImages((prev) => (prev.includes(id) ? prev.filter((imageId) => imageId !== id) : [...prev, id]))
  }

  const getStatusIcon = (status: ImageStatus) => {
    switch (status) {
      case "segmented":
        return <CheckCircle className="h-4 w-4 text-green-500" />
      case "completed":
        return <CheckCircle className="h-4 w-4 text-green-500" />
      case "processing":
        return <Clock className="h-4 w-4 text-blue-500" />
      case "failed":
        return <AlertCircle className="h-4 w-4 text-red-500" />
      case "memory_error":
        return <AlertCircle className="h-4 w-4 text-orange-500" />
      default:
        return <ImageIcon className="h-4 w-4 text-gray-500" />
    }
  }

  const getStatusText = (status: ImageStatus) => {
    switch (status) {
      case "segmented":
        return "Segmentováno"
      case "completed":
        return "Dokončeno"
      case "processing":
        return "Zpracovává se"
      case "failed":
        return "Chyba"
      case "memory_error":
        return "Nedostatek paměti"
      default:
        return "Neznámý stav"
    }
  }

  const getStatusColor = (status: ImageStatus) => {
    switch (status) {
      case "segmented":
        return "bg-green-100 text-green-800"
      case "completed":
        return "bg-green-100 text-green-800"
      case "processing":
        return "bg-blue-100 text-blue-800"
      case "failed":
        return "bg-red-100 text-red-800"
      case "memory_error":
        return "bg-orange-100 text-orange-800"
      default:
        return "bg-gray-100 text-gray-800"
    }
  }

  const getStatusWeight = (status: ImageStatus) => {
    switch (status) {
      case "segmented":
        return 3
      case "completed":
        return 2
      case "processing":
        return 1
      case "failed":
        return 0
      case "memory_error":
        return 0
      default:
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
        console.error("Delete failed: Status code", response.status, "Error details:", errorData)
        
        toast({
          title: "Chyba",
          description: errorData.detail || "Nepodařilo se smazat obrázek",
          variant: "destructive",
        })
      }
    } catch (error) {
      console.error("Delete failed: Exception", error instanceof Error ? error.message : String(error))
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

  // Use the existing images with URLs if available, otherwise use the original images
  const displayImages = imagesWithUrls.length > 0 ? imagesWithUrls : images;

  // Sort the display images
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
    <div className="space-y-4">
      {/* Header with sorting controls and actions */}
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

      {/* Image Grid */}
      {isLoading ? (
        <div className="flex justify-center items-center h-64">
          <Spinner size="lg" />
        </div>
      ) : sortedImages.length > 0 ? (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
          {sortedImages.map((image) => (
            <div key={image.id} className="relative group">
              <div 
                className={cn(
                  "overflow-hidden rounded-lg border bg-background transition-all hover:shadow-md",
                  selectedImages.includes(image.id) ? "ring-2 ring-primary" : ""
                )}
                onClick={() => toggleSelect(image.id)}
              >
                {/* Image thumbnail with status indicator */}
                <div className="group aspect-square overflow-hidden rounded-md">
                  <div className="relative aspect-square">
                    <FallbackImage
                      src={image.thumbnail || "/images/placeholder-thumbnail.svg"}
                      fallbackSrc="/images/placeholder-thumbnail.svg"
                      alt={image.name}
                      width={300}
                      height={300}
                      priority={true}
                      className={cn(
                        "object-cover w-full h-full transition-opacity",
                        deletingImages.includes(image.id) ? "opacity-30" : ""
                      )}
                    />
                    
                    {/* Status indicators */}
                    {image.status && (
                      <div className="absolute bottom-2 right-2">
                        {image.status === "segmented" && (
                          <Badge variant="outline" className="text-xs bg-green-100 text-green-800 border-green-200">
                            <CheckCircle className="h-3 w-3 mr-1" />
                            Segmentováno
                          </Badge>
                        )}
                        {image.status === "completed" && (
                          <Badge variant="outline" className="text-xs bg-blue-100 text-blue-800 border-blue-200">
                            <CheckCircle className="h-3 w-3 mr-1" />
                            Dokončeno
                          </Badge>
                        )}
                        {image.status === "processing" && (
                          <Badge variant="secondary" className="text-xs">
                            <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                            Zpracovává se
                          </Badge>
                        )}
                        {image.status === "failed" && (
                          <Badge variant="destructive" className="text-xs">
                            <XCircle className="h-3 w-3 mr-1" />
                            Chyba
                          </Badge>
                        )}
                        {image.status === "memory_error" && (
                          <Badge variant="outline" className="text-xs bg-orange-100 text-orange-800 border-orange-200">
                            <AlertCircle className="h-3 w-3 mr-1" />
                            Nedostatek paměti
                          </Badge>
                        )}
                      </div>
                    )}
                    
                    {/* Overlay for selected images */}
                    {selectedImages.includes(image.id) && (
                      <div className="absolute inset-0 bg-primary/20 flex items-center justify-center">
                        <CheckCircle className="h-8 w-8 text-primary" />
                      </div>
                    )}
                  </div>
                </div>
                
                {/* Image info */}
                <div className="p-2">
                  <h3 className="text-sm font-medium truncate" title={image.name}>
                    {image.name}
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    {new Date(image.date).toLocaleDateString()}
                  </p>
                </div>
              </div>
              
              {/* Actions overlay */}
              <div className={cn(
                "absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity",
                selectedImages.includes(image.id) ? "opacity-100" : ""
              )}>
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
            </div>
          ))}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center p-8 text-center border rounded-lg bg-background">
          <ImageIcon className="w-12 h-12 text-muted-foreground" />
          <h3 className="mt-4 text-lg font-semibold">No images found</h3>
          <p className="text-sm text-muted-foreground">Upload some images to get started</p>
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