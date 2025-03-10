import type { Metadata } from "next"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Badge } from "@/components/ui/badge"
import { FileImage, FolderKanban, Plus, Search, Users } from "lucide-react"

export const metadata: Metadata = {
  title: "Projects - SpheroSeg",
  description: "Manage your SpheroSeg projects",
}

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
  {
    id: "4",
    name: "Cell Aggregation Study",
    description: "Analysis of cell aggregation patterns in vitro",
    status: "active",
    imageCount: 64,
    teamCount: 2,
    lastUpdated: "3 days ago",
  },
  {
    id: "5",
    name: "Organoid Development",
    description: "Tracking organoid growth and development",
    status: "completed",
    imageCount: 156,
    teamCount: 6,
    lastUpdated: "1 week ago",
  },
  {
    id: "6",
    name: "Microtissue Analysis",
    description: "Characterization of engineered microtissues",
    status: "archived",
    imageCount: 92,
    teamCount: 3,
    lastUpdated: "2 weeks ago",
  },
]

export default function ProjectsPage() {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold tracking-tight">Projects</h1>
        <Button className="gap-1">
          <Plus className="h-4 w-4" />
          New Project
        </Button>
      </div>

      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input type="search" placeholder="Search projects..." className="w-full appearance-none pl-8" />
        </div>
        <Button variant="outline">Filters</Button>
      </div>

      <Tabs defaultValue="all" className="space-y-4">
        <TabsList>
          <TabsTrigger value="all">All Projects</TabsTrigger>
          <TabsTrigger value="active">Active</TabsTrigger>
          <TabsTrigger value="completed">Completed</TabsTrigger>
          <TabsTrigger value="archived">Archived</TabsTrigger>
        </TabsList>

        <TabsContent value="all" className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {projects.map((project) => (
              <Card key={project.id} className="overflow-hidden">
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <CardTitle>{project.name}</CardTitle>
                    <Badge
                      variant={
                        project.status === "active"
                          ? "default"
                          : project.status === "completed"
                            ? "success"
                            : "secondary"
                      }
                    >
                      {project.status}
                    </Badge>
                  </div>
                  <CardDescription>{project.description}</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-4 text-sm">
                    <div className="flex items-center gap-1">
                      <FileImage className="h-4 w-4 text-muted-foreground" />
                      <span>{project.imageCount} images</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Users className="h-4 w-4 text-muted-foreground" />
                      <span>{project.teamCount} members</span>
                    </div>
                  </div>
                </CardContent>
                <CardFooter className="flex items-center justify-between border-t bg-muted/50 px-6 py-3">
                  <div className="text-xs text-muted-foreground">Updated {project.lastUpdated}</div>
                  <Button variant="ghost" size="sm">
                    View
                  </Button>
                </CardFooter>
              </Card>
            ))}

            <Card className="flex h-full flex-col items-center justify-center p-6">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
                <FolderKanban className="h-6 w-6 text-primary" />
              </div>
              <h3 className="mt-4 text-xl font-semibold">Create a new project</h3>
              <p className="mb-4 mt-2 text-center text-sm text-muted-foreground">
                Start a new analysis project for your scientific images
              </p>
              <Button className="gap-1">
                <Plus className="h-4 w-4" />
                New Project
              </Button>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="active">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {projects
              .filter((project) => project.status === "active")
              .map((project) => (
                <Card key={project.id} className="overflow-hidden">
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                      <CardTitle>{project.name}</CardTitle>
                      <Badge variant="default">{project.status}</Badge>
                    </div>
                    <CardDescription>{project.description}</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center gap-4 text-sm">
                      <div className="flex items-center gap-1">
                        <FileImage className="h-4 w-4 text-muted-foreground" />
                        <span>{project.imageCount} images</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <Users className="h-4 w-4 text-muted-foreground" />
                        <span>{project.teamCount} members</span>
                      </div>
                    </div>
                  </CardContent>
                  <CardFooter className="flex items-center justify-between border-t bg-muted/50 px-6 py-3">
                    <div className="text-xs text-muted-foreground">Updated {project.lastUpdated}</div>
                    <Button variant="ghost" size="sm">
                      View
                    </Button>
                  </CardFooter>
                </Card>
              ))}
          </div>
        </TabsContent>

        <TabsContent value="completed">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {projects
              .filter((project) => project.status === "completed")
              .map((project) => (
                <Card key={project.id} className="overflow-hidden">
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                      <CardTitle>{project.name}</CardTitle>
                      <Badge variant="success">{project.status}</Badge>
                    </div>
                    <CardDescription>{project.description}</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center gap-4 text-sm">
                      <div className="flex items-center gap-1">
                        <FileImage className="h-4 w-4 text-muted-foreground" />
                        <span>{project.imageCount} images</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <Users className="h-4 w-4 text-muted-foreground" />
                        <span>{project.teamCount} members</span>
                      </div>
                    </div>
                  </CardContent>
                  <CardFooter className="flex items-center justify-between border-t bg-muted/50 px-6 py-3">
                    <div className="text-xs text-muted-foreground">Updated {project.lastUpdated}</div>
                    <Button variant="ghost" size="sm">
                      View
                    </Button>
                  </CardFooter>
                </Card>
              ))}
          </div>
        </TabsContent>

        <TabsContent value="archived">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {projects
              .filter((project) => project.status === "archived")
              .map((project) => (
                <Card key={project.id} className="overflow-hidden">
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                      <CardTitle>{project.name}</CardTitle>
                      <Badge variant="secondary">{project.status}</Badge>
                    </div>
                    <CardDescription>{project.description}</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center gap-4 text-sm">
                      <div className="flex items-center gap-1">
                        <FileImage className="h-4 w-4 text-muted-foreground" />
                        <span>{project.imageCount} images</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <Users className="h-4 w-4 text-muted-foreground" />
                        <span>{project.teamCount} members</span>
                      </div>
                    </div>
                  </CardContent>
                  <CardFooter className="flex items-center justify-between border-t bg-muted/50 px-6 py-3">
                    <div className="text-xs text-muted-foreground">Updated {project.lastUpdated}</div>
                    <Button variant="ghost" size="sm">
                      View
                    </Button>
                  </CardFooter>
                </Card>
              ))}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}

