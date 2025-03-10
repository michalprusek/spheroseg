import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api, endpoints, Project } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Plus, Trash2, Edit2, FolderOpen } from 'lucide-react'

export function ProjectManager() {
  const [newProject, setNewProject] = useState({ name: '', description: '' })
  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const queryClient = useQueryClient()

  const { data: projects, isLoading } = useQuery({
    queryKey: ['projects'],
    queryFn: async () => {
      const { data } = await api.get(endpoints.projects.list)
      return data as Project[]
    }
  })

  const createProject = useMutation({
    mutationFn: async (project: typeof newProject) => {
      const { data } = await api.post(endpoints.projects.create, project)
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['projects'])
      setIsCreateOpen(false)
      setNewProject({ name: '', description: '' })
    }
  })

  const deleteProject = useMutation({
    mutationFn: async (id: string) => {
      await api.delete(endpoints.projects.delete(id))
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['projects'])
    }
  })

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">Projects</h2>
        <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              New Project
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create New Project</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium">Name</label>
                <Input
                  value={newProject.name}
                  onChange={(e) => setNewProject(p => ({ ...p, name: e.target.value }))}
                />
              </div>
              <div>
                <label className="text-sm font-medium">Description</label>
                <Input
                  value={newProject.description}
                  onChange={(e) => setNewProject(p => ({ ...p, description: e.target.value }))}
                />
              </div>
              <Button 
                onClick={() => createProject.mutate(newProject)}
                disabled={createProject.isLoading}
              >
                Create Project
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {projects?.map((project) => (
          <Card key={project.id}>
            <CardHeader>
              <CardTitle className="flex justify-between items-center">
                <span>{project.name}</span>
                <div className="flex gap-2">
                  <Button variant="ghost" size="icon">
                    <Edit2 className="h-4 w-4" />
                  </Button>
                  <Button 
                    variant="ghost" 
                    size="icon"
                    onClick={() => deleteProject.mutate(project.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-gray-500 mb-4">{project.description}</p>
              <div className="flex justify-between items-center">
                <div className="text-sm">
                  <p>Images: {project.image_count}</p>
                  <p>Updated: {new Date(project.updated_at).toLocaleDateString()}</p>
                </div>
                <Button variant="outline">
                  <FolderOpen className="h-4 w-4 mr-2" />
                  Open
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}