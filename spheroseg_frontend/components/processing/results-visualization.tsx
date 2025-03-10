"use client"

import { useState } from "react"
import Image from "next/image"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Download, ZoomIn, ZoomOut, Layers, RotateCw } from "lucide-react"

export function ResultsVisualization() {
  const [zoomLevel, setZoomLevel] = useState(100)

  const handleZoomIn = () => {
    setZoomLevel(Math.min(zoomLevel + 25, 200))
  }

  const handleZoomOut = () => {
    setZoomLevel(Math.max(zoomLevel - 25, 50))
  }

  return (
    <div className="grid gap-6 md:grid-cols-[1fr_300px]">
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Button variant="outline" size="icon" onClick={handleZoomOut}>
              <ZoomOut className="h-4 w-4" />
            </Button>
            <span className="text-sm">{zoomLevel}%</span>
            <Button variant="outline" size="icon" onClick={handleZoomIn}>
              <ZoomIn className="h-4 w-4" />
            </Button>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="icon">
              <Layers className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="icon">
              <RotateCw className="h-4 w-4" />
            </Button>
            <Button variant="outline">
              <Download className="mr-2 h-4 w-4" />
              Export
            </Button>
          </div>
        </div>
        <div className="relative aspect-video overflow-hidden rounded-lg border bg-muted">
          <Image
            src="/placeholder.svg?height=720&width=1280"
            alt="Processed image with detected spherical objects"
            fill
            className="object-contain"
            style={{ transform: `scale(${zoomLevel / 100})` }}
          />
        </div>
      </div>
      <div className="space-y-6">
        <Tabs defaultValue="summary">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="summary">Summary</TabsTrigger>
            <TabsTrigger value="objects">Objects</TabsTrigger>
            <TabsTrigger value="stats">Statistics</TabsTrigger>
          </TabsList>
          <TabsContent value="summary" className="space-y-4 pt-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Detection Summary</CardTitle>
              </CardHeader>
              <CardContent>
                <dl className="grid grid-cols-2 gap-2 text-sm">
                  <dt className="text-muted-foreground">Total Objects:</dt>
                  <dd className="font-medium">127</dd>
                  <dt className="text-muted-foreground">Average Size:</dt>
                  <dd className="font-medium">24.3 px</dd>
                  <dt className="text-muted-foreground">Size Range:</dt>
                  <dd className="font-medium">12.1 - 42.8 px</dd>
                  <dt className="text-muted-foreground">Density:</dt>
                  <dd className="font-medium">0.42 obj/μm²</dd>
                </dl>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Processing Information</CardTitle>
              </CardHeader>
              <CardContent>
                <dl className="grid grid-cols-2 gap-2 text-sm">
                  <dt className="text-muted-foreground">Algorithm:</dt>
                  <dd className="font-medium">Watershed</dd>
                  <dt className="text-muted-foreground">Threshold:</dt>
                  <dd className="font-medium">75%</dd>
                  <dt className="text-muted-foreground">Processing Time:</dt>
                  <dd className="font-medium">1.2 seconds</dd>
                  <dt className="text-muted-foreground">Image Size:</dt>
                  <dd className="font-medium">1280 × 720 px</dd>
                </dl>
              </CardContent>
            </Card>
          </TabsContent>
          <TabsContent value="objects" className="pt-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Detected Objects</CardTitle>
              </CardHeader>
              <CardContent className="max-h-[400px] overflow-y-auto">
                <div className="space-y-2">
                  {Array.from({ length: 10 }).map((_, i) => (
                    <div key={i} className="flex items-center justify-between rounded-md border p-2">
                      <div className="flex items-center gap-2">
                        <div className="h-8 w-8 rounded-md bg-primary/10"></div>
                        <div>
                          <div className="text-sm font-medium">Object #{i + 1}</div>
                          <div className="text-xs text-muted-foreground">
                            Size: {Math.floor(Math.random() * 30) + 10} px
                          </div>
                        </div>
                      </div>
                      <Button variant="ghost" size="sm">
                        View
                      </Button>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
          <TabsContent value="stats" className="pt-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Size Distribution</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-[200px] w-full bg-muted rounded-md flex items-end justify-between p-2">
                  {Array.from({ length: 10 }).map((_, i) => (
                    <div
                      key={i}
                      className="bg-primary w-6 rounded-t-sm"
                      style={{
                        height: `${Math.floor(Math.random() * 80) + 20}%`,
                      }}
                    ></div>
                  ))}
                </div>
                <div className="mt-2 flex justify-between text-xs text-muted-foreground">
                  <span>10 px</span>
                  <span>50 px</span>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
        <div className="flex gap-2">
          <Button className="flex-1">Save Results</Button>
          <Button variant="outline" className="flex-1">
            Process New Image
          </Button>
        </div>
      </div>
    </div>
  )
}

