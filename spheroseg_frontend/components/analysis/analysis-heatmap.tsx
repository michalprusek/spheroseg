"use client"

import { useState } from "react"
import { Slider } from "@/components/ui/slider"
import { Label } from "@/components/ui/label"

interface AnalysisHeatmapProps {
  detailed?: boolean
}

export function AnalysisHeatmap({ detailed = false }: AnalysisHeatmapProps) {
  const [intensity, setIntensity] = useState(0.7)
  const gridSize = detailed ? 20 : 10

  // Generate random heatmap data
  const generateHeatmapData = () => {
    const data: number[][] = []

    for (let i = 0; i < gridSize; i++) {
      const row: number[] = []
      for (let j = 0; j < gridSize; j++) {
        // Create clusters of high intensity
        const distanceFromCenter = Math.sqrt(Math.pow(i - gridSize / 2, 2) + Math.pow(j - gridSize / 2, 2))
        const baseIntensity = Math.max(0, 1 - distanceFromCenter / (gridSize / 2))

        // Add some randomness
        const randomFactor = Math.random() * 0.3
        row.push(Math.min(1, baseIntensity + randomFactor))
      }
      data.push(row)
    }

    return data
  }

  const heatmapData = generateHeatmapData()

  return (
    <div className="space-y-4">
      {detailed && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label htmlFor="intensity">Intensity Threshold</Label>
            <span className="text-sm text-muted-foreground">{intensity.toFixed(2)}</span>
          </div>
          <Slider
            id="intensity"
            min={0}
            max={1}
            step={0.01}
            value={[intensity]}
            onValueChange={(value) => setIntensity(value[0])}
          />
        </div>
      )}

      <div className="relative aspect-square w-full overflow-hidden rounded-lg border">
        <div
          className="grid h-full w-full"
          style={{
            gridTemplateColumns: `repeat(${gridSize}, 1fr)`,
            gridTemplateRows: `repeat(${gridSize}, 1fr)`,
          }}
        >
          {heatmapData.map((row, i) =>
            row.map((value, j) => (
              <div
                key={`${i}-${j}`}
                className="transition-colors"
                style={{
                  backgroundColor: `rgba(37, 99, 235, ${value * intensity})`,
                  opacity: value < intensity / 2 ? 0.3 : 1,
                }}
              ></div>
            )),
          )}
        </div>

        {/* Coordinate axes */}
        <div className="absolute bottom-0 left-0 right-0 border-t border-muted-foreground/30 text-xs text-muted-foreground">
          <div className="absolute left-0 -translate-y-1/2">0</div>
          <div className="absolute left-1/2 -translate-x-1/2 -translate-y-1/2">50 µm</div>
          <div className="absolute right-0 -translate-y-1/2">100 µm</div>
        </div>
        <div className="absolute bottom-0 left-0 top-0 border-r border-muted-foreground/30 text-xs text-muted-foreground">
          <div className="absolute top-0 -translate-x-1/2">0</div>
          <div className="absolute top-1/2 -translate-x-1/2 -translate-y-1/2">50 µm</div>
          <div className="absolute bottom-0 -translate-x-1/2">100 µm</div>
        </div>
      </div>

      {/* Legend */}
      <div className="flex items-center justify-center gap-2">
        <div className="h-2 w-full rounded-full bg-gradient-to-r from-transparent to-primary"></div>
        <div className="flex w-full justify-between text-xs text-muted-foreground">
          <span>Low</span>
          <span>Density</span>
          <span>High</span>
        </div>
      </div>
    </div>
  )
}

