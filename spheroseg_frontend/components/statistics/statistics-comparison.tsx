"use client"

import { useState } from "react"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"

export function StatisticsComparison() {
  const [metric1, setMetric1] = useState("size")
  const [metric2, setMetric2] = useState("count")

  const projects = [
    { id: "p1", name: "Brain Cell Analysis", checked: true },
    { id: "p2", name: "Tumor Spheroid Study", checked: true },
    { id: "p3", name: "Embryoid Bodies", checked: true },
    { id: "p4", name: "Cell Aggregation Study", checked: false },
    { id: "p5", name: "Organoid Development", checked: false },
  ]

  const [selectedProjects, setSelectedProjects] = useState(projects.filter((p) => p.checked).map((p) => p.id))

  const metrics = {
    size: {
      label: "Average Size (μm)",
      values: {
        p1: 24.3,
        p2: 18.7,
        p3: 12.5,
        p4: 32.1,
        p5: 15.9,
      },
    },
    count: {
      label: "Object Count",
      values: {
        p1: 421,
        p2: 287,
        p3: 156,
        p4: 93,
        p5: 312,
      },
    },
    density: {
      label: "Density (obj/μm²)",
      values: {
        p1: 0.42,
        p2: 0.31,
        p3: 0.78,
        p4: 0.25,
        p5: 0.53,
      },
    },
    accuracy: {
      label: "Detection Accuracy (%)",
      values: {
        p1: 92.4,
        p2: 89.7,
        p3: 95.2,
        p4: 88.1,
        p5: 91.9,
      },
    },
  }

  const toggleProject = (projectId) => {
    setSelectedProjects((prev) =>
      prev.includes(projectId) ? prev.filter((id) => id !== projectId) : [...prev, projectId],
    )
  }

  const filteredProjects = projects.filter((p) => selectedProjects.includes(p.id))

  const maxValue1 = Math.max(...filteredProjects.map((p) => metrics[metric1].values[p.id]))
  const maxValue2 = Math.max(...filteredProjects.map((p) => metrics[metric2].values[p.id]))

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-4">
        <div className="space-y-2">
          <Label htmlFor="metric1">Primary Metric</Label>
          <Select value={metric1} onValueChange={setMetric1}>
            <SelectTrigger id="metric1" className="w-[200px]">
              <SelectValue placeholder="Select metric" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="size">Average Size</SelectItem>
              <SelectItem value="count">Object Count</SelectItem>
              <SelectItem value="density">Density</SelectItem>
              <SelectItem value="accuracy">Detection Accuracy</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="metric2">Secondary Metric</Label>
          <Select value={metric2} onValueChange={setMetric2}>
            <SelectTrigger id="metric2" className="w-[200px]">
              <SelectValue placeholder="Select metric" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="size">Average Size</SelectItem>
              <SelectItem value="count">Object Count</SelectItem>
              <SelectItem value="density">Density</SelectItem>
              <SelectItem value="accuracy">Detection Accuracy</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="flex flex-col md:flex-row gap-6">
        <div className="border rounded-md p-4 min-w-[250px]">
          <h3 className="font-medium mb-4">Projects</h3>
          <div className="space-y-3">
            {projects.map((project) => (
              <div key={project.id} className="flex items-center space-x-2">
                <Checkbox
                  id={project.id}
                  checked={selectedProjects.includes(project.id)}
                  onCheckedChange={() => toggleProject(project.id)}
                />
                <Label htmlFor={project.id} className="cursor-pointer">
                  {project.name}
                </Label>
              </div>
            ))}
          </div>
        </div>

        <div className="flex-1 space-y-6">
          <div className="flex items-center justify-between text-sm">
            <div className="flex items-center gap-2">
              <div className="h-3 w-3 rounded-full bg-primary"></div>
              <span>{metrics[metric1].label}</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="h-3 w-3 rounded-full bg-secondary"></div>
              <span>{metrics[metric2].label}</span>
            </div>
          </div>

          <div className="space-y-8">
            {filteredProjects.map((project) => (
              <div key={project.id} className="space-y-2">
                <div className="font-medium">{project.name}</div>
                <div className="space-y-4">
                  <div className="flex gap-2">
                    <div
                      className="h-8 bg-primary rounded-md flex items-center justify-end px-2 text-primary-foreground text-sm"
                      style={{ width: `${(metrics[metric1].values[project.id] / maxValue1) * 100}%` }}
                    >
                      {metrics[metric1].values[project.id].toFixed(1)}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <div
                      className="h-8 bg-secondary rounded-md flex items-center justify-end px-2 text-secondary-foreground text-sm"
                      style={{ width: `${(metrics[metric2].values[project.id] / maxValue2) * 100}%` }}
                    >
                      {metrics[metric2].values[project.id].toFixed(1)}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

