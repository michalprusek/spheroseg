import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { ArrowRight, FileImage, Users } from "lucide-react"
import Link from "next/link"

interface Project {
  id: string
  name: string
  description: string
  status: "active" | "completed" | "archived"
  imageCount: number
  teamCount: number
  lastUpdated: string
}

const projects: Project[] = [
  {
    id: "1",
    name: "Brain Cell Analysis",
    description: "Segmentation of neuronal spheroids in 3D culture",
    status: "active",
    imageCount: 128,
    teamCount: 4,
    lastUpdated: "2 hours ago",
  },
  {
    id: "2",
    name: "Tumor Spheroid Study",
    description: "Quantification of cancer cell aggregates",
    status: "active",
    imageCount: 87,
    teamCount: 3,
    lastUpdated: "5 hours ago",
  },
  {
    id: "3",
    name: "Embryoid Bodies",
    description: "Developmental biology stem cell analysis",
    status: "completed",
    imageCount: 215,
    teamCount: 5,
    lastUpdated: "Yesterday",
  },
]

export function ProjectList() {
  return (
    <Card className="col-span-3">
      <CardHeader className="flex flex-row items-center">
        <div className="flex-1">
          <CardTitle>Recent Projects</CardTitle>
          <CardDescription>Your recently updated projects</CardDescription>
        </div>
        <Button asChild variant="ghost" className="gap-1">
          <Link href="/projects">
            View all
            <ArrowRight className="h-4 w-4" />
          </Link>
        </Button>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {projects.map((project) => (
            <div key={project.id} className="flex flex-col space-y-2 rounded-lg border p-4">
              <div className="flex items-center justify-between">
                <div className="font-semibold">{project.name}</div>
                <Badge
                  variant={
                    project.status === "active" ? "default" : project.status === "completed" ? "success" : "secondary"
                  }
                >
                  {project.status}
                </Badge>
              </div>
              <div className="text-sm text-muted-foreground">{project.description}</div>
              <div className="flex items-center gap-4 text-sm">
                <div className="flex items-center gap-1">
                  <FileImage className="h-4 w-4 text-muted-foreground" />
                  <span>{project.imageCount} images</span>
                </div>
                <div className="flex items-center gap-1">
                  <Users className="h-4 w-4 text-muted-foreground" />
                  <span>{project.teamCount} members</span>
                </div>
                <div className="ml-auto text-xs text-muted-foreground">Updated {project.lastUpdated}</div>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}

