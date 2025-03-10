"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

export function StatisticsOverview() {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle>Processing Metrics</CardTitle>
          <CardDescription>Performance statistics for image processing</CardDescription>
        </CardHeader>
        <CardContent className="h-[300px]">
          <div className="flex h-full flex-col">
            <div className="flex h-full items-end justify-between gap-2 px-4">
              {Array.from({ length: 12 }).map((_, i) => {
                const height = 30 + Math.random() * 70
                return (
                  <div key={i} className="relative flex w-full flex-col items-center">
                    <div className="w-full rounded-t bg-primary" style={{ height: `${height}%` }}></div>
                    <span className="mt-2 text-xs">{`M${i + 1}`}</span>
                  </div>
                )
              })}
            </div>
            <div className="mt-2 flex justify-between text-sm text-muted-foreground">
              <span>Jan</span>
              <span>Dec</span>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Detection Statistics</CardTitle>
          <CardDescription>Object detection statistics by project type</CardDescription>
        </CardHeader>
        <CardContent className="h-[300px]">
          <div className="flex h-full items-center justify-center">
            <div className="relative h-56 w-56">
              <svg viewBox="0 0 100 100" className="h-full w-full -rotate-90">
                <circle
                  cx="50"
                  cy="50"
                  r="40"
                  fill="none"
                  stroke="hsl(var(--primary))"
                  strokeWidth="20"
                  strokeDasharray="60 40"
                  strokeDashoffset="0"
                />
                <circle
                  cx="50"
                  cy="50"
                  r="40"
                  fill="none"
                  stroke="hsl(var(--secondary))"
                  strokeWidth="20"
                  strokeDasharray="25 75"
                  strokeDashoffset="-60"
                />
                <circle
                  cx="50"
                  cy="50"
                  r="40"
                  fill="none"
                  stroke="hsl(var(--accent))"
                  strokeWidth="20"
                  strokeDasharray="15 85"
                  strokeDashoffset="-85"
                />
              </svg>
              <div className="absolute inset-0 flex items-center justify-center text-lg font-semibold">1,284</div>
            </div>
            <div className="ml-8 space-y-2">
              <div className="flex items-center gap-2">
                <div className="h-3 w-3 rounded-full bg-primary"></div>
                <span className="text-sm">Cell Studies (60%)</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="h-3 w-3 rounded-full bg-secondary"></div>
                <span className="text-sm">Embryoid Bodies (25%)</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="h-3 w-3 rounded-full bg-accent"></div>
                <span className="text-sm">Tumor Analysis (15%)</span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

