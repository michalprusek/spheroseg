import type { Metadata } from "next"
import { ImageUploadDropzone } from "@/components/image-upload-dropzone"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Slider } from "@/components/ui/slider"
import { Switch } from "@/components/ui/switch"
import { FileImage, Settings, Layers, Play } from "lucide-react"

export const metadata: Metadata = {
  title: "Image Processing - SpheroSeg",
  description: "Process and analyze spherical objects in scientific images",
}

export default function ProcessingPage() {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold tracking-tight">Image Processing</h1>
        <Button variant="outline" className="gap-1">
          <Settings className="h-4 w-4" />
          Processing Settings
        </Button>
      </div>

      <Tabs defaultValue="single" className="space-y-4">
        <TabsList>
          <TabsTrigger value="single">Single Processing</TabsTrigger>
          <TabsTrigger value="batch">Batch Processing</TabsTrigger>
          <TabsTrigger value="history">Processing History</TabsTrigger>
        </TabsList>

        <TabsContent value="single" className="space-y-4">
          <div className="grid gap-6 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileImage className="h-5 w-5" />
                  Image Upload
                </CardTitle>
                <CardDescription>Upload an image for spherical object segmentation</CardDescription>
              </CardHeader>
              <CardContent>
                <ImageUploadDropzone />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Settings className="h-5 w-5" />
                  Processing Parameters
                </CardTitle>
                <CardDescription>Configure parameters for optimal segmentation</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="threshold">Detection Threshold</Label>
                    <span className="text-sm text-muted-foreground">0.75</span>
                  </div>
                  <Slider id="threshold" defaultValue={[0.75]} max={1} step={0.01} className="py-2" />
                  <p className="text-xs text-muted-foreground">
                    Higher values increase precision but may miss some objects
                  </p>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="min-size">Minimum Size (px)</Label>
                    <Input id="min-size" type="number" defaultValue={20} className="w-20" />
                  </div>
                  <p className="text-xs text-muted-foreground">Minimum diameter of objects to detect</p>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="max-size">Maximum Size (px)</Label>
                    <Input id="max-size" type="number" defaultValue={200} className="w-20" />
                  </div>
                  <p className="text-xs text-muted-foreground">Maximum diameter of objects to detect</p>
                </div>

                <div className="flex items-center space-x-2">
                  <Switch id="advanced-filtering" />
                  <Label htmlFor="advanced-filtering">Advanced filtering</Label>
                </div>

                <div className="flex items-center space-x-2">
                  <Switch id="3d-reconstruction" />
                  <Label htmlFor="3d-reconstruction">3D reconstruction</Label>
                </div>

                <Button className="w-full gap-1">
                  <Play className="h-4 w-4" />
                  Start Processing
                </Button>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Layers className="h-5 w-5" />
                Results Preview
              </CardTitle>
              <CardDescription>Preview of segmentation results</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex h-[400px] w-full items-center justify-center rounded-md border border-dashed">
                <div className="flex flex-col items-center gap-1 text-center">
                  <FileImage className="h-8 w-8 text-muted-foreground" />
                  <div className="text-sm font-medium">No results to display</div>
                  <div className="text-xs text-muted-foreground">Upload and process an image to see results</div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="batch">
          <Card>
            <CardHeader>
              <CardTitle>Batch Processing</CardTitle>
              <CardDescription>Process multiple images with the same parameters</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <ImageUploadDropzone />
                <Button className="w-full gap-1">
                  <Play className="h-4 w-4" />
                  Start Batch Processing
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="history">
          <Card>
            <CardHeader>
              <CardTitle>Processing History</CardTitle>
              <CardDescription>View your recent processing jobs</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex h-[400px] w-full items-center justify-center rounded-md border border-dashed">
                <div className="flex flex-col items-center gap-1 text-center">
                  <FileImage className="h-8 w-8 text-muted-foreground" />
                  <div className="text-sm font-medium">No processing history</div>
                  <div className="text-xs text-muted-foreground">Process some images to see your history</div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}

