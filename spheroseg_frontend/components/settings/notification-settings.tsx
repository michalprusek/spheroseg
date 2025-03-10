"use client"

import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

export function NotificationSettings() {
  return (
    <div className="space-y-6">
      <div className="space-y-4">
        <h3 className="text-lg font-medium">Email Notifications</h3>
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label htmlFor="email-project-updates">Project updates</Label>
            <Switch id="email-project-updates" defaultChecked />
          </div>
          <div className="flex items-center justify-between">
            <Label htmlFor="email-processing-complete">Processing complete</Label>
            <Switch id="email-processing-complete" defaultChecked />
          </div>
          <div className="flex items-center justify-between">
            <Label htmlFor="email-comments">Comments and mentions</Label>
            <Switch id="email-comments" defaultChecked />
          </div>
          <div className="flex items-center justify-between">
            <Label htmlFor="email-team-changes">Team changes</Label>
            <Switch id="email-team-changes" defaultChecked />
          </div>
        </div>
      </div>

      <Separator />

      <div className="space-y-4">
        <h3 className="text-lg font-medium">In-App Notifications</h3>
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label htmlFor="app-project-updates">Project updates</Label>
            <Switch id="app-project-updates" defaultChecked />
          </div>
          <div className="flex items-center justify-between">
            <Label htmlFor="app-processing-complete">Processing complete</Label>
            <Switch id="app-processing-complete" defaultChecked />
          </div>
          <div className="flex items-center justify-between">
            <Label htmlFor="app-comments">Comments and mentions</Label>
            <Switch id="app-comments" defaultChecked />
          </div>
          <div className="flex items-center justify-between">
            <Label htmlFor="app-team-changes">Team changes</Label>
            <Switch id="app-team-changes" defaultChecked />
          </div>
        </div>
      </div>

      <Separator />

      <div className="space-y-4">
        <h3 className="text-lg font-medium">Notification Frequency</h3>
        <div className="space-y-2">
          <Label htmlFor="notification-frequency">Email digest frequency</Label>
          <Select defaultValue="daily">
            <SelectTrigger id="notification-frequency">
              <SelectValue placeholder="Select frequency" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="realtime">Real-time</SelectItem>
              <SelectItem value="daily">Daily digest</SelectItem>
              <SelectItem value="weekly">Weekly digest</SelectItem>
              <SelectItem value="never">Never</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <Separator />

      <Button className="w-full">Save Notification Preferences</Button>
    </div>
  )
}

