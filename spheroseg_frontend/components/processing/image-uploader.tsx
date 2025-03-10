"use client"

import type React from "react"

import { useState } from "react"
import { Upload } from "lucide-react"
import { Button } from "@/components/ui/button"

interface ImageUploaderProps {
  onUpload: () => void
}

export function ImageUploader({ onUpload }: ImageUploaderProps) {
  const [isDragging, setIsDragging] = useState(false)

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(true)
  }

  const handleDragLeave = () => {
    setIsDragging(false)
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
    // In a real app, we would process the dropped files here
    onUpload()
  }

  const handleFileSelect = () => {
    // In a real app, we would open a file picker here
    onUpload()
  }

  return (
    <div
      className={`flex h-64 flex-col items-center justify-center rounded-lg border-2 border-dashed p-6 transition-colors ${
        isDragging ? "border-primary bg-primary/5" : "border-muted-foreground/25"
      }`}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      <div className="flex flex-col items-center justify-center space-y-4 text-center">
        <div className="rounded-full bg-primary/10 p-4">
          <Upload className="h-8 w-8 text-primary" />
        </div>
        <div className="space-y-2">
          <h3 className="text-lg font-medium">Drag and drop your images</h3>
          <p className="text-sm text-muted-foreground">Supported formats: PNG, JPG, TIFF (max 50MB)</p>
        </div>
        <div className="flex gap-2">
          <Button onClick={handleFileSelect}>Select Files</Button>
          <Button variant="outline">Browse Sample Images</Button>
        </div>
      </div>
    </div>
  )
}

