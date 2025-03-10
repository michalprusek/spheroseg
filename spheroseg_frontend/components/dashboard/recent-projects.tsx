import Link from "next/link"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"

export function RecentProjects() {
  const projects = [
    {
      id: "1",
      name: "Cell Membrane Analysis",
      status: "Active",
      lastUpdated: "2 hours ago",
      progress: 75,
    },
    {
      id: "2",
      name: "Neuron Cluster Identification",
      status: "Completed",
      lastUpdated: "1 day ago",
      progress: 100,
    },
    {
      id: "3",
      name: "Bacterial Colony Counting",
      status: "In Review",
      lastUpdated: "3 days ago",
      progress: 90,
    },
    {
      id: "4",
      name: "Tissue Sample Analysis",
      status: "Draft",
      lastUpdated: "1 week ago",
      progress: 30,
    },
  ]

  return (
    <div className="space-y-4">
      {projects.map((project) => (
        <div key={project.id} className="flex items-center justify-between space-x-4 rounded-lg border p-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <h3 className="font-medium">{project.name}</h3>
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
            <p className="text-sm text-muted-foreground">Last updated {project.lastUpdated}</p>
          </div>
          <div className="flex items-center gap-2">
            <div className="hidden md:block">
              <div className="flex h-2 w-24 overflow-hidden rounded-full bg-muted">
                <div className="bg-primary" style={{ width: `${project.progress}%` }} />
              </div>
            </div>
            <Link href={`/dashboard/projects/${project.id}`}>
              <Button variant="ghost" size="sm">
                View
              </Button>
            </Link>
          </div>
        </div>
      ))}
      <div className="flex justify-end">
        <Link href="/dashboard/projects">
          <Button variant="outline">View All Projects</Button>
        </Link>
      </div>
    </div>
  )
}

