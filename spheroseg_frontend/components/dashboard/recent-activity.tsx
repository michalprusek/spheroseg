import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

interface ActivityItem {
  id: string
  user: {
    name: string
    avatar?: string
    initials: string
  }
  action: string
  target: string
  time: string
}

const activities: ActivityItem[] = [
  {
    id: "1",
    user: {
      name: "John Doe",
      initials: "JD",
    },
    action: "created a new project",
    target: "Brain Cell Analysis",
    time: "2 hours ago",
  },
  {
    id: "2",
    user: {
      name: "Sarah Johnson",
      initials: "SJ",
    },
    action: "uploaded 15 images to",
    target: "Tumor Spheroid Study",
    time: "5 hours ago",
  },
  {
    id: "3",
    user: {
      name: "Michael Chen",
      initials: "MC",
    },
    action: "completed analysis on",
    target: "Embryoid Bodies",
    time: "Yesterday",
  },
  {
    id: "4",
    user: {
      name: "Emily Wilson",
      initials: "EW",
    },
    action: "shared results from",
    target: "Cell Aggregation Study",
    time: "2 days ago",
  },
]

export function RecentActivity() {
  return (
    <Card className="col-span-3">
      <CardHeader>
        <CardTitle>Recent Activity</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {activities.map((activity) => (
            <div key={activity.id} className="flex items-center gap-4">
              <Avatar className="h-8 w-8">
                <AvatarImage src={activity.user.avatar} alt={activity.user.name} />
                <AvatarFallback>{activity.user.initials}</AvatarFallback>
              </Avatar>
              <div className="space-y-1">
                <p className="text-sm font-medium leading-none">
                  <span className="font-semibold">{activity.user.name}</span> {activity.action}{" "}
                  <span className="font-semibold">{activity.target}</span>
                </p>
                <p className="text-xs text-muted-foreground">{activity.time}</p>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}

