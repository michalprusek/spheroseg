"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { MoreHorizontal, UserPlus, Mail, Shield, Users, UserCog, Search } from "lucide-react"

const teamMembers = [
  {
    id: "1",
    name: "John Doe",
    email: "john.doe@example.com",
    role: "Owner",
    avatar: "/placeholder.svg?height=40&width=40",
    initials: "JD",
    online: true,
  },
  {
    id: "2",
    name: "Sarah Johnson",
    email: "sarah.johnson@example.com",
    role: "Admin",
    avatar: "/placeholder.svg?height=40&width=40",
    initials: "SJ",
    online: true,
  },
  {
    id: "3",
    name: "Michael Chen",
    email: "michael.chen@example.com",
    role: "Member",
    avatar: "/placeholder.svg?height=40&width=40",
    initials: "MC",
    online: false,
  },
  {
    id: "4",
    name: "Emily Wilson",
    email: "emily.wilson@example.com",
    role: "Member",
    avatar: "/placeholder.svg?height=40&width=40",
    initials: "EW",
    online: false,
  },
  {
    id: "5",
    name: "David Kumar",
    email: "david.kumar@example.com",
    role: "Member",
    avatar: "/placeholder.svg?height=40&width=40",
    initials: "DK",
    online: true,
  },
]

const teams = [
  {
    id: "team1",
    name: "Research Lab",
    description: "Main research laboratory team",
    members: 5,
  },
  {
    id: "team2",
    name: "Clinical Project",
    description: "Clinical research collaboration",
    members: 3,
  },
]

export function TeamSettings() {
  const [searchQuery, setSearchQuery] = useState("")
  const [isInviteDialogOpen, setIsInviteDialogOpen] = useState(false)
  const [isNewTeamDialogOpen, setIsNewTeamDialogOpen] = useState(false)
  const [activeTeam, setActiveTeam] = useState("team1")

  const filteredMembers = teamMembers.filter(
    (member) =>
      member.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      member.email.toLowerCase().includes(searchQuery.toLowerCase()),
  )

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <h3 className="text-2xl font-medium">Team Management</h3>
          <p className="text-sm text-muted-foreground">
            Manage your team members and control who has access to your projects
          </p>
        </div>
        <Button onClick={() => setIsInviteDialogOpen(true)}>
          <UserPlus className="mr-2 h-4 w-4" />
          Invite Member
        </Button>
      </div>

      <div className="flex flex-col xl:flex-row gap-6">
        <Card className="xl:w-72">
          <CardHeader>
            <CardTitle>Teams</CardTitle>
            <CardDescription>Your research teams</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {teams.map((team) => (
              <Button
                key={team.id}
                variant={activeTeam === team.id ? "secondary" : "ghost"}
                className="w-full justify-start"
                onClick={() => setActiveTeam(team.id)}
              >
                <Users className="mr-2 h-4 w-4" />
                {team.name}
                <Badge className="ml-auto" variant="outline">
                  {team.members}
                </Badge>
              </Button>
            ))}
          </CardContent>
          <CardFooter>
            <Button variant="outline" className="w-full" onClick={() => setIsNewTeamDialogOpen(true)}>
              <UserPlus className="mr-2 h-4 w-4" />
              New Team
            </Button>
          </CardFooter>
        </Card>

        <div className="flex-1 space-y-4">
          <div className="flex flex-col sm:flex-row gap-2 sm:items-center sm:justify-between">
            <h3 className="text-lg font-medium">{teams.find((t) => t.id === activeTeam)?.name} Members</h3>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  type="search"
                  placeholder="Search members..."
                  className="pl-8"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
            </div>
          </div>

          <Separator />

          <div className="space-y-2">
            {filteredMembers.map((member) => (
              <div key={member.id} className="flex items-center justify-between rounded-lg border p-3">
                <div className="flex items-center gap-3">
                  <div className="relative">
                    <Avatar>
                      <AvatarImage src={member.avatar} alt={member.name} />
                      <AvatarFallback>{member.initials}</AvatarFallback>
                    </Avatar>
                    {member.online && (
                      <span className="absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full bg-green-500 ring-1 ring-background"></span>
                    )}
                  </div>
                  <div>
                    <div className="font-medium">{member.name}</div>
                    <div className="text-sm text-muted-foreground">{member.email}</div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge
                    variant={member.role === "Owner" ? "default" : member.role === "Admin" ? "secondary" : "outline"}
                  >
                    {member.role}
                  </Badge>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon">
                        <MoreHorizontal className="h-4 w-4" />
                        <span className="sr-only">More options</span>
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem>
                        <UserCog className="mr-2 h-4 w-4" />
                        <span>Change Role</span>
                      </DropdownMenuItem>
                      <DropdownMenuItem>
                        <Mail className="mr-2 h-4 w-4" />
                        <span>Send Message</span>
                      </DropdownMenuItem>
                      <DropdownMenuItem>
                        <Shield className="mr-2 h-4 w-4" />
                        <span>View Permissions</span>
                      </DropdownMenuItem>
                      <DropdownMenuItem className="text-destructive">
                        <span>Remove Member</span>
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Invite Dialog */}
      <Dialog open={isInviteDialogOpen} onOpenChange={setIsInviteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Invite Team Member</DialogTitle>
            <DialogDescription>Send an invitation to join your team</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email Address</Label>
              <Input id="email" placeholder="colleague@example.com" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="role">Role</Label>
              <Select defaultValue="member">
                <SelectTrigger>
                  <SelectValue placeholder="Select role" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="admin">Admin</SelectItem>
                  <SelectItem value="member">Member</SelectItem>
                  <SelectItem value="viewer">Viewer</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="team">Team</Label>
              <Select defaultValue={activeTeam}>
                <SelectTrigger>
                  <SelectValue placeholder="Select team" />
                </SelectTrigger>
                <SelectContent>
                  {teams.map((team) => (
                    <SelectItem key={team.id} value={team.id}>
                      {team.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsInviteDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={() => setIsInviteDialogOpen(false)}>Send Invitation</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* New Team Dialog */}
      <Dialog open={isNewTeamDialogOpen} onOpenChange={setIsNewTeamDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create New Team</DialogTitle>
            <DialogDescription>Create a new team to organize your members and projects</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="teamName">Team Name</Label>
              <Input id="teamName" placeholder="Research Group Alpha" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="teamDescription">Description</Label>
              <Input id="teamDescription" placeholder="Brief description of the team" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsNewTeamDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={() => setIsNewTeamDialogOpen(false)}>Create Team</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

