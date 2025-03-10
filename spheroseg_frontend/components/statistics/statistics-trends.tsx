"use client"

import { useState } from "react"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { Label } from "@/components/ui/label"

export function StatisticsTrends() {
  const [metric, setMetric] = useState("processingTime")
  const [timeScale, setTimeScale] = useState("monthly")

  // Generate sample data
  const generateData = () => {
    const dataPoints = timeScale === "daily" ? 30 : timeScale === "weekly" ? 12 : 12
    return Array.from({ length: dataPoints }, (_, i) => ({
      label: timeScale === "daily" ? `Day ${i + 1}` : timeScale === "weekly" ? `Week ${i + 1}` : `Month ${i + 1}`,
      value: Math.random() * 100,
    }))
  }

  const data = generateData()
  const highestValue = Math.max(...data.map((point) => point.value)) * 1.2
  const points = data
    .map((point, i) => `${(i / (data.length - 1)) * 100},${100 - (point.value / highestValue) * 100}`)
    .join(" ")

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-4">
        <div className="space-y-2">
          <Label htmlFor="metric">Metric</Label>
          <Select value={metric} onValueChange={setMetric}>
            <SelectTrigger id="metric" className="w-[200px]">
              <SelectValue placeholder="Select metric" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="processingTime">Processing Time</SelectItem>
              <SelectItem value="detectionAccuracy">Detection Accuracy</SelectItem>
              <SelectItem value="objectCount">Object Count</SelectItem>
              <SelectItem value="imageThroughput">Image Throughput</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label>Time Scale</Label>
          <ToggleGroup type="single" value={timeScale} onValueChange={(value) => value && setTimeScale(value)}>
            <ToggleGroupItem value="daily">Daily</ToggleGroupItem>
            <ToggleGroupItem value="weekly">Weekly</ToggleGroupItem>
            <ToggleGroupItem value="monthly">Monthly</ToggleGroupItem>
          </ToggleGroup>
        </div>
      </div>

      <div className="h-[400px] w-full border rounded-md p-4">
        <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="h-full w-full">
          {/* Grid lines */}
          <line x1="0" y1="0" x2="0" y2="100" stroke="hsl(var(--border))" strokeWidth="0.5" />
          <line x1="0" y1="100" x2="100" y2="100" stroke="hsl(var(--border))" strokeWidth="0.5" />
          <line x1="0" y1="25" x2="100" y2="25" stroke="hsl(var(--border))" strokeWidth="0.2" strokeDasharray="1" />
          <line x1="0" y1="50" x2="100" y2="50" stroke="hsl(var(--border))" strokeWidth="0.2" strokeDasharray="1" />
          <line x1="0" y1="75" x2="100" y2="75" stroke="hsl(var(--border))" strokeWidth="0.2" strokeDasharray="1" />

          {/* Trend line */}
          <polyline points={points} fill="none" stroke="hsl(var(--primary))" strokeWidth="2" />

          {/* Data points */}
          {data.map((point, i) => (
            <circle
              key={i}
              cx={`${(i / (data.length - 1)) * 100}`}
              cy={`${100 - (point.value / highestValue) * 100}`}
              r="1"
              fill="hsl(var(--primary))"
            />
          ))}
        </svg>
      </div>

      <div className="flex justify-between text-sm text-muted-foreground">
        {data
          .filter((_, i) => i % Math.ceil(data.length / 6) === 0 || i === data.length - 1)
          .map((point, i) => (
            <span key={i}>{point.label}</span>
          ))}
      </div>
    </div>
  )
}

