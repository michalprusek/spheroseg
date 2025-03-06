"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Plus } from "lucide-react"
import { useRouter } from "next/navigation"
import { PROJECT_ENDPOINTS, fetchWithAuth } from "@/app/api/api-config"
import { useToast } from "@/components/ui/use-toast"

interface NewProjectDialogProps {
  onProjectCreated?: () => void;
}

export default function NewProjectDialog({ onProjectCreated }: NewProjectDialogProps) {
  const [open, setOpen] = useState(false)
  const [projectName, setProjectName] = useState("")
  const [projectDescription, setProjectDescription] = useState("")
  const [isCreating, setIsCreating] = useState(false)
  const router = useRouter()
  const { toast } = useToast()

  const handleCreateProject = async () => {
    setIsCreating(true)

    try {
      const response = await fetchWithAuth(PROJECT_ENDPOINTS.create, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: projectName,
          description: projectDescription
        }),
      })

      if (response.ok) {
        const data = await response.json()
        setOpen(false)
        toast({
          title: "Úspěch",
          description: "Projekt byl úspěšně vytvořen",
        })
        if (onProjectCreated) {
          onProjectCreated()
        }
        router.push(`/projects/${data.id}`) // Redirect to the new project
      } else {
        console.error("Failed to create project")
        toast({
          title: "Chyba",
          description: "Nepodařilo se vytvořit projekt",
          variant: "destructive",
        })
      }
    } catch (error) {
      console.error("Failed to create project:", error)
      toast({
        title: "Chyba",
        description: "Nepodařilo se vytvořit projekt",
        variant: "destructive",
      })
    } finally {
      setIsCreating(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="mr-2 h-4 w-4" />
          Nový projekt
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Vytvořit nový projekt</DialogTitle>
          <DialogDescription>Zadejte název a popis pro váš nový segmentační projekt.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="name" className="text-right">
              Název
            </Label>
            <Input
              id="name"
              value={projectName}
              onChange={(e) => setProjectName(e.target.value)}
              className="col-span-3"
              placeholder="Zadejte název projektu"
            />
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="description" className="text-right">
              Popis
            </Label>
            <Textarea
              id="description"
              value={projectDescription}
              onChange={(e) => setProjectDescription(e.target.value)}
              className="col-span-3"
              placeholder="Zadejte popis projektu"
            />
          </div>
        </div>
        <DialogFooter>
          <Button onClick={handleCreateProject} disabled={isCreating || !projectName}>
            {isCreating ? "Vytváření..." : "Vytvořit projekt"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

