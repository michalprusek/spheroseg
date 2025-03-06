"use client"

import type React from "react"

import { useState, useRef, useEffect, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Slider } from "@/components/ui/slider"
import { Card, CardContent } from "@/components/ui/card"
import {
  Save,
  Undo,
  Redo,
  ZoomIn,
  ZoomOut,
  Hand,
  Pencil,
  Eraser,
  Trash2,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
} from "lucide-react"
import Link from "next/link"
import { useRouter, useParams } from "next/navigation"
import Image from "next/image"
import { FallbackImage } from "@/components/ui/fallback-image"
import { IMAGE_ENDPOINTS, fetchWithAuth, isOfflineMode } from "@/app/api/api-config"
import { useToast } from "@/components/ui/use-toast"

// Mock data for project images
const mockProjectImages = [
  { id: 1, name: "image1.jpg", thumbnail: "/placeholder.svg?height=60&width=60", url: "/placeholder.svg" },
  { id: 2, name: "image2.jpg", thumbnail: "/placeholder.svg?height=60&width=60", url: "/placeholder.svg" },
  { id: 3, name: "image3.jpg", thumbnail: "/placeholder.svg?height=60&width=60", url: "/placeholder.svg" },
  { id: 4, name: "image4.jpg", thumbnail: "/placeholder.svg?height=60&width=60", url: "/placeholder.svg" },
  { id: 5, name: "image5.jpg", thumbnail: "/placeholder.svg?height=60&width=60", url: "/placeholder.svg" },
  { id: 6, name: "image6.jpg", thumbnail: "/placeholder.svg?height=60&width=60", url: "/placeholder.svg" },
]

// Mock polygon data
const mockPolygon = [
  { x: 150, y: 100 },
  { x: 250, y: 80 },
  { x: 300, y: 150 },
  { x: 280, y: 220 },
  { x: 200, y: 250 },
  { x: 120, y: 200 },
]

export default function SegmentationEditor() {
  const params = useParams<{ id: string; imageId: string }>()
  const router = useRouter()
  const { toast } = useToast()
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [tool, setTool] = useState<"pan" | "vertex">("pan")
  const [brushSize, setBrushSize] = useState(10)
  const [zoom, setZoom] = useState(100)
  const [position, setPosition] = useState({ x: 0, y: 0 })
  const [imageUrl, setImageUrl] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [isDrawing, setIsDrawing] = useState(false)
  const [isDragging, setIsDragging] = useState(false)
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 })
  const [lastPos, setLastPos] = useState({ x: 0, y: 0 })
  const [selectedVertex, setSelectedVertex] = useState<number | null>(null)
  const [hoveredVertex, setHoveredVertex] = useState<number | null>(null)
  const [polygon, setPolygon] = useState(mockPolygon)
  const [history, setHistory] = useState<Array<{ x: number; y: number }[]>>([mockPolygon])
  const [historyIndex, setHistoryIndex] = useState(0)
  const [showImageSelector, setShowImageSelector] = useState(true)
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false)

  // Ensure params exist
  const projectId = params?.id || '1';
  const imageId = params?.imageId || '1';
  
  // Get current image index or default to 0 if not found
  const currentImageIndex = mockProjectImages.findIndex((img) => img.id.toString() === imageId);
  const safeCurrentImageIndex = currentImageIndex >= 0 ? currentImageIndex : 0;

  // Define redrawCanvas inside the component to access state variables
  const redrawCanvas = useCallback(
    (ctx: CanvasRenderingContext2D, img: HTMLImageElement, currentPolygon: typeof polygon) => {
      // Clear canvas
      ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height)

      // Make sure canvas size is set correctly
      if (ctx.canvas.width !== img.width || ctx.canvas.height !== img.height) {
        ctx.canvas.width = img.width;
        ctx.canvas.height = img.height;
      }

      // Draw the image
      try {
        ctx.drawImage(img, 0, 0, ctx.canvas.width, ctx.canvas.height);
      } catch (e) {
        console.error("Error drawing image on canvas:", e);
      }

      // Draw the polygon with semi-transparent fill
      if (currentPolygon && currentPolygon.length > 2) {
        ctx.fillStyle = "rgba(255, 0, 0, 0.3)"
        ctx.beginPath()
        ctx.moveTo(currentPolygon[0].x, currentPolygon[0].y)

        for (let i = 1; i < currentPolygon.length; i++) {
          ctx.lineTo(currentPolygon[i].x, currentPolygon[i].y)
        }

        ctx.closePath()
        ctx.fill()

        // Draw the polygon outline
        ctx.strokeStyle = "rgba(255, 0, 0, 0.8)"
        ctx.lineWidth = 2
        ctx.stroke()

        // Draw the vertices
        currentPolygon.forEach((point, index) => {
          ctx.beginPath()

          // Different styles for selected, hovered, and normal vertices
          if (index === selectedVertex) {
            ctx.fillStyle = "rgba(255, 255, 0, 0.8)"
            ctx.arc(point.x, point.y, 8, 0, Math.PI * 2)
          } else if (index === hoveredVertex) {
            ctx.fillStyle = "rgba(255, 165, 0, 0.8)"
            ctx.arc(point.x, point.y, 7, 0, Math.PI * 2)
          } else {
            ctx.fillStyle = "rgba(255, 255, 255, 0.8)"
            ctx.arc(point.x, point.y, 5, 0, Math.PI * 2)
          }

          ctx.fill()
          ctx.strokeStyle = "rgba(255, 0, 0, 0.8)"
          ctx.lineWidth = 1
          ctx.stroke()
        })
      }
    },
    [hoveredVertex, selectedVertex],
  )

  // Funkce pro načtení URL obrázku
  const fetchImageUrl = useCallback(async () => {
    if (!params?.imageId || isOfflineMode()) {
      // V offline režimu použijeme placeholder
      setImageUrl("/placeholder.svg?height=800&width=800");
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      
      // Use the proxy API for images to avoid CORS and permission issues
      // This goes through our Next.js server instead of directly to MinIO
      const proxyUrl = `/api/proxy/image/${params.imageId}?t=${Date.now()}`; 
      console.log("Using image proxy URL:", proxyUrl);
      
      // Set the proxy URL directly - the proxy will handle fetching from the backend
      setImageUrl(proxyUrl);
      setLoading(false);
    } catch (error) {
      console.error("Error in fetchImageUrl:", error);
      toast({
        title: "Chyba",
        description: "Nepodařilo se načíst obrázek",
        variant: "destructive",
      });
      setImageUrl("/placeholder.svg?height=800&width=800");
      setLoading(false);
    }
  }, [params?.imageId, toast]);

  // Načtení URL obrázku při načtení komponenty
  useEffect(() => {
    fetchImageUrl();
  }, [fetchImageUrl]);

  // Vykreslení obrázku na canvas
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext("2d")
    if (!ctx) return

    // Reset position and zoom when changing images
    setPosition({ x: 0, y: 0 })
    setZoom(100)

    // Force dimensions to ensure canvas is visible
    canvas.width = 800;
    canvas.height = 600;

    // Always create an image
    const img = new window.Image()
    img.crossOrigin = "anonymous"  // Přidáno pro CORS
    
    // Set up handlers before setting src to ensure they're registered
    img.onload = () => {
      console.log("Image loaded successfully:", img.width, "x", img.height);
      
      // Set canvas dimensions to match image if it loaded properly
      if (img.width && img.height) {
        canvas.width = img.width;
        canvas.height = img.height;
      }

      // Draw the image and polygon
      redrawCanvas(ctx, img, polygon);
    }
    
    img.onerror = (e) => {
      console.error("Failed to load image:", imageUrl, e);
      
      // If we can't load the image, use a placeholder
      const fallbackImg = new window.Image()
      fallbackImg.src = "/placeholder.svg?height=800&width=800"
      fallbackImg.onload = () => {
        redrawCanvas(ctx, fallbackImg, polygon)
      }
    }
    
    // Even if imageUrl is null, draw something on the canvas
    if (!imageUrl) {
      console.log("No image URL provided, using placeholder");
      img.src = "/placeholder.svg?height=800&width=800";
    } else {
      // Set the image source after setting up handlers
      img.src = imageUrl;
    }
    
    // Handle case where image is already loaded (from cache)
    if (img.complete) {
      console.log("Image loaded from cache");
      if (img.naturalWidth) {
        canvas.width = img.naturalWidth;
        canvas.height = img.naturalHeight;
        redrawCanvas(ctx, img, polygon);
      } else {
        // Likely an error occurred, but onError didn't fire because the image is cached
        console.warn("Image loaded from cache but has no dimensions");
        const fallbackImg = new window.Image()
        fallbackImg.src = "/placeholder.svg?height=800&width=800"
        fallbackImg.onload = () => {
          redrawCanvas(ctx, fallbackImg, polygon)
        }
      }
    }
    
    // Draw a placeholder immediately while waiting for image loading
    ctx.fillStyle = "#f0f0f0";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.font = "20px Arial";
    ctx.fillStyle = "#666";
    ctx.textAlign = "center";
    ctx.fillText("Načítání obrázku...", canvas.width/2, canvas.height/2);
    
    // Cleanup function
    return () => {
      // Clean up any resources if needed
    }
  }, [imageUrl, polygon, redrawCanvas])

  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current
    if (!canvas) return

    const rect = canvas.getBoundingClientRect()
    const scaleX = canvas.width / rect.width
    const scaleY = canvas.height / rect.height

    // Calculate mouse position with zoom and pan offset
    const x = ((e.clientX - rect.left) * scaleX - position.x) / (zoom / 100)
    const y = ((e.clientY - rect.top) * scaleY - position.y) / (zoom / 100)

    if (tool === "pan") {
      setIsDragging(true)
      setDragStart({ x: e.clientX, y: e.clientY })
      return
    }

    if (tool === "vertex") {
      // Check if clicking on a vertex
      const vertexIndex = polygon.findIndex(
        (point) =>
          Math.sqrt(
            Math.pow(point.x * (zoom / 100) + position.x - e.clientX * scaleX, 2) +
              Math.pow(point.y * (zoom / 100) + position.y - e.clientY * scaleY, 2),
          ) <
          10 * (zoom / 100),
      )

      if (vertexIndex !== -1) {
        setSelectedVertex(vertexIndex)
        setIsDragging(true)
        return
      }

      // If not clicking on a vertex, we could add a new vertex to the polygon
      // This would be a good feature to add
      
      return
    }
  }

  const stopDrawing = () => {
    if (isDragging && selectedVertex !== null) {
      // Add to history when finished moving a vertex
      addToHistory()
    }

    setIsDrawing(false)
    setIsDragging(false)
    setSelectedVertex(null)
  }

  // We no longer need the draw function as we've removed the brush and eraser tools

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current
    if (!canvas) return

    const rect = canvas.getBoundingClientRect()
    const scaleX = canvas.width / rect.width
    const scaleY = canvas.height / rect.height

    // Calculate mouse position with zoom and pan offset
    const x = ((e.clientX - rect.left) * scaleX - position.x) / (zoom / 100)
    const y = ((e.clientY - rect.top) * scaleY - position.y) / (zoom / 100)

    // Handle panning
    if (isDragging && tool === "pan") {
      const dx = e.clientX - dragStart.x
      const dy = e.clientY - dragStart.y

      setPosition((prev) => ({
        x: prev.x + dx,
        y: prev.y + dy,
      }))

      setDragStart({ x: e.clientX, y: e.clientY })
      return
    }

    // Handle vertex dragging
    if (isDragging && selectedVertex !== null && tool === "vertex") {
      const newPolygon = [...polygon]
      newPolygon[selectedVertex] = {
        x: ((e.clientX - rect.left) * scaleX - position.x) / (zoom / 100),
        y: ((e.clientY - rect.top) * scaleY - position.y) / (zoom / 100),
      }

      setPolygon(newPolygon)
      setHasUnsavedChanges(true)
      
      // Redraw canvas with updated polygon
      const ctx = canvas.getContext("2d")
      if (ctx) {
        const img = new window.Image()
        img.src = imageUrl || "/placeholder.svg?height=800&width=800"
        img.onload = () => {
          redrawCanvas(ctx, img, newPolygon)
        }
      }
      
      return
    }

    // Handle vertex hovering
    if (tool === "vertex") {
      // Check if hovering over a vertex
      const vertexIndex = polygon.findIndex(
        (point) =>
          Math.sqrt(
            Math.pow(point.x * (zoom / 100) + position.x - e.clientX * scaleX, 2) +
              Math.pow(point.y * (zoom / 100) + position.y - e.clientY * scaleY, 2),
          ) <
          10 * (zoom / 100),
      )

      // Only update if the hovered vertex changed to avoid unnecessary rerenders
      if (vertexIndex !== hoveredVertex) {
        setHoveredVertex(vertexIndex !== -1 ? vertexIndex : null)
        
        // Redraw canvas to show hover effect
        const ctx = canvas.getContext("2d")
        if (ctx) {
          const img = new window.Image()
          img.src = imageUrl || "/placeholder.svg?height=800&width=800"
          img.onload = () => {
            redrawCanvas(ctx, img, polygon)
          }
        }
      }
    } else {
      if (hoveredVertex !== null) {
        setHoveredVertex(null)
      }
    }
  }

  const handleWheel = (e: React.WheelEvent<HTMLCanvasElement>) => {
    e.preventDefault()

    // Zoom in/out with mouse wheel
    const delta = e.deltaY < 0 ? 10 : -10
    setZoom((prev) => Math.min(Math.max(prev + delta, 50), 300))
  }

  const handleZoomIn = () => {
    setZoom((prev) => Math.min(prev + 10, 300))
  }

  const handleZoomOut = () => {
    setZoom((prev) => Math.max(prev - 10, 50))
  }

  const handleSave = () => {
    // In a real app, we would save the segmentation mask to the server
    setHasUnsavedChanges(false)
    alert("Segmentace uložena!")
  }

  const handleClear = () => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext("2d")
    if (!ctx) return

    // Clear the canvas and redraw the original image
    ctx.clearRect(0, 0, canvas.width, canvas.height)

    // Redraw the original image
    const img = new window.Image()
    img.crossOrigin = "anonymous"
    img.src = "/placeholder.svg?height=800&width=800"
    img.onload = () => {
      ctx.drawImage(img, 0, 0)

      // Reset polygon
      setPolygon([])
      addToHistory()
    }
  }

  const addToHistory = () => {
    if (!canvasRef.current) return
    // Instead of storing image data URL, store the polygon state
    setHistory((prev) => {
      const newHistory = [...prev.slice(0, historyIndex + 1), [...polygon]]
      return newHistory.slice(-10) // Omezení historie na posledních 10 stavů
    })
    setHistoryIndex((prev) => Math.min(prev + 1, 9)) // Omezení indexu na max 9
  }

  const handleUndo = () => {
    if (historyIndex > 0) {
      setHistoryIndex(historyIndex - 1)
      const previousState = history[historyIndex - 1]
      setPolygon([...previousState])
      
      // Redraw canvas with the previous state
      if (canvasRef.current) {
        const ctx = canvasRef.current.getContext('2d')
        if (ctx) {
          const img = new window.Image()
          img.src = mockProjectImages[safeCurrentImageIndex]?.url || "/placeholder.svg?height=800&width=800"
          img.onload = () => {
            redrawCanvas(ctx, img, previousState)
          }
          img.onerror = () => {
            const fallbackImg = new window.Image()
            fallbackImg.src = "/placeholder.svg?height=800&width=800"
            fallbackImg.onload = () => {
              redrawCanvas(ctx, fallbackImg, previousState)
            }
          }
        }
      }
    }
  }

  const handleRedo = () => {
    if (historyIndex < history.length - 1) {
      setHistoryIndex(historyIndex + 1)
      const nextState = history[historyIndex + 1]
      setPolygon([...nextState])
      
      // Redraw canvas with the next state
      if (canvasRef.current) {
        const ctx = canvasRef.current.getContext('2d')
        if (ctx) {
          const img = new window.Image()
          img.src = mockProjectImages[safeCurrentImageIndex]?.url || "/placeholder.svg?height=800&width=800"
          img.onload = () => {
            redrawCanvas(ctx, img, nextState)
          }
          img.onerror = () => {
            const fallbackImg = new window.Image()
            fallbackImg.src = "/placeholder.svg?height=800&width=800"
            fallbackImg.onload = () => {
              redrawCanvas(ctx, fallbackImg, nextState)
            }
          }
        }
      }
    }
  }

  const navigateToImage = (imageId: number) => {
    router.push(`/projects/${projectId}/edit/${imageId}`)
  }

  const navigateToPrevImage = () => {
    if (safeCurrentImageIndex > 0) {
      navigateToImage(mockProjectImages[safeCurrentImageIndex - 1].id)
    }
  }

  const navigateToNextImage = () => {
    if (safeCurrentImageIndex < mockProjectImages.length - 1) {
      navigateToImage(mockProjectImages[safeCurrentImageIndex + 1].id)
    }
  }

  return (
    <div className="container mx-auto py-4">
      <div className="flex justify-between items-center mb-4">
        <Link href={`/projects/${params?.id}`} className="flex items-center text-muted-foreground hover:text-foreground">
          <ChevronLeft className="h-4 w-4 mr-1" />
          Zpět na projekt
        </Link>
        <h1 className="text-2xl font-bold">Editor segmentace</h1>
        <Button onClick={handleSave} disabled={!hasUnsavedChanges} variant={hasUnsavedChanges ? "default" : "outline"}>
          <Save className="h-4 w-4 mr-2" />
          {hasUnsavedChanges ? "Uložit změny*" : "Uložit změny"}
        </Button>
      </div>

      <div className="flex gap-4">
        <div className="w-64 shrink-0">
          <Card>
            <CardContent className="p-4">
              <h3 className="text-lg font-medium mb-4">Nástroje</h3>

              <div className="grid grid-cols-2 gap-2 mb-6">
                <Button
                  variant={tool === "pan" ? "default" : "outline"}
                  className="h-10 p-0"
                  onClick={() => setTool("pan")}
                  title="Posun"
                >
                  <Hand className="h-4 w-4" />
                </Button>
                <Button
                  variant={tool === "vertex" ? "default" : "outline"}
                  className="h-10 p-0"
                  onClick={() => setTool("vertex")}
                  title="Úprava vrcholů"
                >
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <circle cx="12" cy="12" r="3" />
                    <path d="M19 12c0-3.87-3.13-7-7-7s-7 3.13-7 7 3.13 7 7 7" />
                    <path d="M19 12h3" />
                    <path d="M2 12h3" />
                  </svg>
                </Button>
              </div>

              <div className="space-y-6">

                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-sm">Přiblížení</span>
                    <span className="text-sm font-medium">{zoom}%</span>
                  </div>
                  <div className="flex justify-between">
                    <Button variant="outline" size="sm" onClick={handleZoomOut}>
                      <ZoomOut className="h-4 w-4" />
                    </Button>
                    <Button variant="outline" size="sm" onClick={handleZoomIn}>
                      <ZoomIn className="h-4 w-4" />
                    </Button>
                  </div>
                </div>

                <div className="space-y-2">
                  <h4 className="text-sm font-medium">Historie</h4>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1"
                      onClick={handleUndo}
                      disabled={historyIndex <= 0}
                    >
                      <Undo className="h-4 w-4 mr-1" />
                      Zpět
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1"
                      onClick={handleRedo}
                      disabled={historyIndex >= history.length - 1}
                    >
                      <Redo className="h-4 w-4 mr-1" />
                      Vpřed
                    </Button>
                  </div>
                </div>

                <Button variant="destructive" size="sm" className="w-full" onClick={handleClear}>
                  <Trash2 className="h-4 w-4 mr-2" />
                  Vymazat vše
                </Button>

                <div className="space-y-2">
                  <h4 className="text-sm font-medium">Navigace</h4>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1"
                      onClick={navigateToPrevImage}
                      disabled={safeCurrentImageIndex <= 0}
                    >
                      <ChevronLeft className="h-4 w-4 mr-1" />
                      Předchozí
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1"
                      onClick={navigateToNextImage}
                      disabled={safeCurrentImageIndex >= mockProjectImages.length - 1}
                    >
                      Další
                      <ChevronRight className="h-4 w-4 ml-1" />
                    </Button>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full"
                    onClick={() => setShowImageSelector(!showImageSelector)}
                  >
                    Všechny obrázky
                    <ChevronUp
                      className={`h-4 w-4 ml-1 transition-transform ${showImageSelector ? "rotate-180" : ""}`}
                    />
                  </Button>

                  {showImageSelector && (
                    <div className="mt-2 border rounded-md p-2 max-h-40 overflow-y-auto">
                      <div className="grid grid-cols-3 gap-2">
                        {mockProjectImages.map((img) => (
                          <div
                            key={img.id}
                            className={`cursor-pointer p-1 rounded border ${img.id.toString() === imageId ? "border-primary bg-primary/10" : "border-gray-200 hover:bg-gray-50"}`}
                            onClick={() => navigateToImage(img.id)}
                          >
                            <div className="relative w-full aspect-square">
                              <img 
                                src={img.thumbnail || "/placeholder.svg"} 
                                alt={img.name || "Obrázek"} 
                                className="w-full h-full object-contain transition-all"
                              />
                            </div>
                            <p className="text-xs truncate mt-1">{img.name}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="flex-1 bg-gray-100 rounded-lg overflow-hidden relative">
          <div
            className="overflow-auto h-[calc(100vh-12rem)] flex items-center justify-center bg-gray-800"
            style={{ padding: "20px" }}
          >
            <div
              style={{
                transform: `scale(${zoom / 100})`,
                transformOrigin: "center center",
                position: "relative",
                left: `${position.x}px`,
                top: `${position.y}px`,
              }}
            >
              <canvas
                ref={canvasRef}
                onMouseDown={startDrawing}
                onMouseUp={stopDrawing}
                onMouseOut={stopDrawing}
                onMouseMove={handleMouseMove}
                onWheel={handleWheel}
                style={{
                  cursor:
                    tool === "pan"
                      ? isDragging
                        ? "grabbing"
                        : "grab"
                      : tool === "vertex"
                        ? hoveredVertex !== null
                          ? "pointer"
                          : "default"
                        : "crosshair",
                }}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

