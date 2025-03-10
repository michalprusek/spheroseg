import type { Metadata } from "next"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { ProjectsList } from "@/components/projects/projects-list"
import { ProjectFilters } from "@/components/projects/project-filters"
import { PlusCircle } from "lucide-react"

export const metadata: Metadata = {
  title: "Projects | SpheroSeg",
  description: "Manage your SpheroSeg projects",
}

export default function ProjectsPage() {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Projects</h1>
          <p className="text-muted-foreground">Create and manage your image analysis projects</p>
        </div>
        <Link href="/dashboard/projects/new">
          <Button>
            <PlusCircle className="mr-2 h-4 w-4" />
            New Project
          </Button>
        </Link>
      </div>
      <ProjectFilters />
      <ProjectsList />
    </div>
  )
}

