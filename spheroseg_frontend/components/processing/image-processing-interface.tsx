"use client"

import { useState } from "react"
import Image from "next/image"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ImageUploader } from "@/components/processing/image-uploader"
import { ProcessingParameters } from "@/components/processing/processing-parameters"
import { ResultsVisualization } from "@/components/processing/results-visualization"

export function ImageProcessingInterface() {
  const [activeTab, setActiveTab] = useState("upload")
  const [hasImage, setHasImage] = useState(false)
  const [isProcessing, setIsProcessing] = useState(false)
  const [isProcessed, setIsProcessed] = useState(false)

  const handleImageUpload = () => {
    setHasImage(true)
    setActiveTab("parameters")
  }

  const handleProcessImage = () => {
    setIsProcessing(true)
    // Simulate processing delay
    setTimeout(() => {
      setIsProcessing(false)
      setIsProcessed(true)
      setActiveTab("results")
    }, 2000)
  }

  return (
    <Card className="border-none shadow-none">
      <CardContent className="p-0">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="upload">Upload</TabsTrigger>
            <TabsTrigger value="parameters" disabled={!hasImage}>
              Parameters
            </TabsTrigger>
            <TabsTrigger value="results" disabled={!isProcessed}>
              Results
            </TabsTrigger>
          </TabsList>
          <TabsContent value="upload" className="mt-6">
            <ImageUploader onUpload={handleImageUpload} />
          </TabsContent>
          <TabsContent value="parameters" className="mt-6">
            <div className="grid gap-6 md:grid-cols-[1fr_300px]">
              <div className="relative aspect-video overflow-hidden rounded-lg border bg-muted">
                {hasImage && (
                  <Image
                    src="/placeholder.svg?height=720&width=1280"
                    alt="Sample image"
                    fill
                    className="object-contain"
                  />
                )}
              </div>
              <div className="space-y-6">
                <ProcessingParameters />
                <Button className="w-full" onClick={handleProcessImage} disabled={isProcessing}>
                  {isProcessing ? "Processing..." : "Process Image"}
                </Button>
              </div>
            </div>
          </TabsContent>
          <TabsContent value="results" className="mt-6">
            <ResultsVisualization />
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  )
}

