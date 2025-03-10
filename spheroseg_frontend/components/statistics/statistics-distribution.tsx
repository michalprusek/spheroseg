"use client"

import { useState } from "react"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Slider } from "@/components/ui/slider"
import { Label } from "@/components/ui/label"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"

export function StatisticsDistribution() {
  const [metric, setMetric] = useState("size")
  const [numBins, setNumBins] = useState(20)
  const [displayType, setDisplayType] = useState("histogram")

  // Generate random distribution data
  const generateDistributionData = () => {
    // Generate data with a normal-ish distribution
    const data = []
    const mean = 50
    const stdDev = 15

    for (let i = 0; i < 1000; i++) {
      let sum = 0
      for (let j = 0; j < 6; j++) {
        sum += Math.random()
      }
      // Transform to normal-ish distribution
      const value = mean + stdDev * (sum - 3)
      data.push(Math.max(0, Math.min(100, value)))
    }

    // Create bins
    const bins = Array(numBins).fill(0)
    const binWidth = 100 / numBins

    data.forEach((value) => {
      const binIndex = Math.min(numBins - 1, Math.floor(value / binWidth))
      bins[binIndex]++
    })

    return bins
  }

  const bins = generateDistributionData()
  const maxBinValue = Math.max(...bins)

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-4">
        <div className="space-y-2">
          <Label htmlFor="distMetric">Metric</Label>
          <Select value={metric} onValueChange={setMetric}>
            <SelectTrigger id="distMetric" className="w-[200px]">
              <SelectValue placeholder="Select metric" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="size">Object Size</SelectItem>
              <SelectItem value="intensity">Intensity</SelectItem>
              <SelectItem value="circularity">Circularity</SelectItem>
              <SelectItem value="density">Density</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2 flex-1 max-w-xs">
          <div className="flex items-center justify-between">
            <Label htmlFor="binCount">Number of Bins</Label>
            <span className="text-sm text-muted-foreground">{numBins}</span>
          </div>
          <Slider
            id="binCount"
            min={5}
            max={50}
            step={1}
            value={[numBins]}
            onValueChange={(value) => setNumBins(value[0])}
          />
        </div>

        <div className="space-y-2">
          <Label>Display Type</Label>
          <RadioGroup orientation="horizontal" value={displayType} onValueChange={setDisplayType} className="flex">
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="histogram" id="histogram" />
              <Label htmlFor="histogram">Histogram</Label>
            </div>
            <div className="flex items-center space-x-2 ml-4">
              <RadioGroupItem value="line" id="line" />
              <Label htmlFor="line">Line</Label>
            </div>
          </RadioGroup>
        </div>
      </div>

      <div className="h-[400px] w-full border rounded-md p-4">
        <div className="flex h-full items-end gap-[2px]">
          {bins.map((bin, i) => (
            <div key={i} className="relative flex-1 group">
              {displayType === "histogram" ? (
                <div
                  className="w-full bg-primary hover:bg-primary/80 rounded-t transition-colors"
                  style={{ height: `${(bin / maxBinValue) * 100}%` }}
                ></div>
              ) : null}

              {i > 0 && displayType === "line" && (
                <div
                  className="absolute bottom-0 left-0 w-full h-px bg-primary"
                  style={{
                    height: "2px",
                    transform: `rotate(${Math.atan2(
                      (bins[i - 1] / maxBinValue) * 100 - (bin / maxBinValue) * 100,
                      100 / bins.length,
                    )}rad)`,
                    transformOrigin: "left bottom",
                    width: `${100 / bins.length}%`,
                  }}
                ></div>
              )}

              {displayType === "line" && (
                <div
                  className="absolute bottom-0 left-0 w-2 h-2 rounded-full bg-primary -translate-x-1 -translate-y-1"
                  style={{
                    bottom: `${(bin / maxBinValue) * 100}%`,
                  }}
                ></div>
              )}

              <div className="absolute bottom-full left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity bg-popover text-popover-foreground px-2 py-1 rounded text-xs pointer-events-none">
                {bin}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="flex justify-between text-sm text-muted-foreground">
        <span>0</span>
        <span>
          {metric === "size"
            ? "Size (μm)"
            : metric === "intensity"
              ? "Intensity"
              : metric === "circularity"
                ? "Circularity"
                : "Density"}
        </span>
        <span>100</span>
      </div>
    </div>
  )
}

