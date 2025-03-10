import Link from "next/link"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"

export function ProjectsList() {
  const projects = [
    {
      id: "1",
      name: "Cell Membrane Analysis",
      description: "Analysis of cell membrane permeability in various conditions",
      status: "Active",
      lastUpdated: "2 hours ago",
      progress: 75,
      members: [
        { name: "John Doe", avatar: "/placeholder.svg?height=32&width=32", initials: "JD" },
        { name: "Sarah Johnson", avatar: "/placeholder.svg?height=32&width=32", initials: "SJ" },
      ],
      imageCount: 48,
    },
    {
      id: "2",
      name: "Neuron Cluster Identification",
      description: "Identifying and classifying neuron clusters in brain tissue samples",
      status: "Completed",
      lastUpdated: "1 day ago",
      progress: 100,
      members: [
        { name: "Emily Chen", avatar: "/placeholder.svg?height=32&width=32", initials: "EC" },
        { name: "Michael Brown", avatar: "/placeholder.svg?height=32&width=32", initials: "MB" },
        { name: "David Wilson", avatar: "/placeholder.svg?height=32&width=32", initials: "DW" },
      ],
      imageCount: 124,
    },
    {
      id: "3",
      name: "Bacterial Colony Counting",
      description: "Automated counting of bacterial colonies on culture plates",
      status: "In Review",
      lastUpdated: "3 days ago",
      progress: 90,
      members: [{ name: "Sarah Johnson", avatar: "/placeholder.svg?height=32&width=32", initials: "SJ" }],
      imageCount: 36,
    },
    {
      id: "4",
      name: "Tissue Sample Analysis",
      description: "Analysis of tissue samples for abnormal cell structures",
      status: "Draft",
      lastUpdated: "1 week ago",
      progress: 30,
      members: [
        { name: "John Doe", avatar: "/placeholder.svg?height=32&width=32", initials: "JD" },
        { name: "Emily Chen", avatar: "/placeholder.svg?height=32&width=32", initials: "EC" },
      ],
      imageCount: 12,
    },
    {
      id: "5",
      name: "Protein Localization Study",
      description: "Studying the localization of proteins in cellular compartments",
      status: "Active",
      lastUpdated: "2 days ago",
      progress: 60,
      members: [
        { name: "David Wilson", avatar: "/placeholder.svg?height=32&width=32", initials: "DW" },
        { name: "Michael Brown", avatar: "/placeholder.svg?height=32&width=32", initials: "MB" },
      ],
      imageCount: 87,
    },
    {
      id: "6",
      name: "Mitochondrial Morphology",
      description: "Analysis of mitochondrial morphology in different cell types",
      status: "Draft",
      lastUpdated: "2 weeks ago",
      progress: 15,
      members: [{ name: "Sarah Johnson", avatar: "/placeholder.svg?height=32&width=32", initials: "SJ" }],
      imageCount: 8,
    },
  ]

  return (
    <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
      {projects.map((project) => (
        <Card key={project.id}>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>{project.name}</CardTitle>
              <Badge
                variant={
                  project.status === "Active"
                    ? "default"
                    : project.status === "Completed"
                      ? "success"
                      : project.status === "In Review"
                        ? "warning"
                        : "secondary"
                }
              >
                {project.status}
              </Badge>
            </div>
            <CardDescription>{project.description}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span>Progress</span>
                  <span className="font-medium">{project.progress}%</span>
                </div>
                <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                  <div className="h-full bg-primary" style={{ width: `${project.progress}%` }} />
                </div>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex -space-x-2">
                  {project.members.map((member, i) => (
                    <Avatar key={i} className="h-8 w-8 border-2 border-background">
                      <AvatarImage src={member.avatar} alt={member.name} />
                      <AvatarFallback>{member.initials}</AvatarFallback>
                    </Avatar>
                  ))}
                </div>
                <div className="text-sm text-muted-foreground">{project.imageCount} images</div>
              </div>
            </div>
          </CardContent>
          <CardFooter className="flex justify-between">
            <div className="text-xs text-muted-foreground">Updated {project.lastUpdated}</div>
            <Link href={`/dashboard/projects/${project.id}`}>
              <Button variant="ghost" size="sm">
                View
              </Button>
            </Link>
          </CardFooter>
        </Card>
      ))}
    </div>
  )
}

