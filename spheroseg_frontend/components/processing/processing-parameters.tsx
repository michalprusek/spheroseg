"use client"

import { Slider } from "@/components/ui/slider"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

export function ProcessingParameters() {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle>Processing Parameters</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="algorithm">Algorithm</Label>
          <Select defaultValue="watershed">
            <SelectTrigger id="algorithm">
              <SelectValue placeholder="Select algorithm" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="watershed">Watershed</SelectItem>
              <SelectItem value="hough">Hough Transform</SelectItem>
              <SelectItem value="contour">Contour Detection</SelectItem>
              <SelectItem value="deeplearning">Deep Learning</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label htmlFor="threshold">Threshold</Label>
            <span className="text-xs text-muted-foreground">75%</span>
          </div>
          <Slider id="threshold" defaultValue={[75]} max={100} step={1} className="w-full" />
        </div>
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label htmlFor="min-size">Minimum Size</Label>
            <span className="text-xs text-muted-foreground">10px</span>
          </div>
          <Slider id="min-size" defaultValue={[10]} max={50} step={1} className="w-full" />
        </div>
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label htmlFor="max-size">Maximum Size</Label>
            <span className="text-xs text-muted-foreground">100px</span>
          </div>
          <Slider id="max-size" defaultValue={[100]} max={500} step={5} className="w-full" />
        </div>
        <div className="flex items-center space-x-2">
          <Switch id="auto-detect" />
          <Label htmlFor="auto-detect">Auto-detect parameters</Label>
        </div>
        <div className="flex items-center space-x-2">
          <Switch id="advanced-mode" />
          <Label htmlFor="advanced-mode">Advanced mode</Label>
        </div>
      </CardContent>
    </Card>
  )
}

