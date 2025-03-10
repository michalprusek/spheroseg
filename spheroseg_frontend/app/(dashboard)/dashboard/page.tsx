import { StatCard } from "@/components/dashboard/stat-card"
import { RecentActivity } from "@/components/dashboard/recent-activity"
import { ProjectList } from "@/components/dashboard/project-list"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { FileImage, FolderKanban, Plus, Users, Activity, BarChart } from "lucide-react"

export default function DashboardPage() {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
        <Button className="gap-1">
          <Plus className="h-4 w-4" />
          New Project
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Total Projects"
          value="24"
          description="+4 from last month"
          icon={<FolderKanban className="h-4 w-4 text-muted-foreground" />}
        />
        <StatCard
          title="Processed Images"
          value="1,284"
          description="+180 from last month"
          icon={<FileImage className="h-4 w-4 text-muted-foreground" />}
        />
        <StatCard
          title="Team Members"
          value="12"
          description="+2 new this month"
          icon={<Users className="h-4 w-4 text-muted-foreground" />}
        />
        <StatCard
          title="Active Sessions"
          value="3"
          description="2 processing, 1 analysis"
          icon={<Activity className="h-4 w-4 text-muted-foreground" />}
        />
      </div>

      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="analytics">Analytics</TabsTrigger>
          <TabsTrigger value="reports">Reports</TabsTrigger>
          <TabsTrigger value="notifications">Notifications</TabsTrigger>
        </TabsList>
        <TabsContent value="overview" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
            <ProjectList />
            <div className="grid gap-4 lg:col-span-4">
              <Card className="col-span-4">
                <CardHeader>
                  <CardTitle>Processing Activity</CardTitle>
                  <CardDescription>Image processing volume over time</CardDescription>
                </CardHeader>
                <CardContent className="h-[200px] w-full">
                  <div className="flex h-full w-full items-center justify-center rounded-md border border-dashed">
                    <div className="flex flex-col items-center gap-1 text-center">
                      <BarChart className="h-8 w-8 text-muted-foreground" />
                      <div className="text-sm font-medium">Activity Chart</div>
                      <div className="text-xs text-muted-foreground">Processing volume visualization</div>
                    </div>
                  </div>
                </CardContent>
              </Card>
              <RecentActivity />
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}

