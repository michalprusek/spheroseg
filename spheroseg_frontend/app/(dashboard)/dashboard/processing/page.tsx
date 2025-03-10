import type { Metadata } from "next"
import { ImageProcessingInterface } from "@/components/processing/image-processing-interface"

export const metadata: Metadata = {
  title: "Image Processing | SpheroSeg",
  description: "Process and analyze images with SpheroSeg",
}

export default function ProcessingPage() {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Image Processing</h1>
        <p className="text-muted-foreground">Upload and process images for spherical object segmentation</p>
      </div>
      <ImageProcessingInterface />
    </div>
  )
}

