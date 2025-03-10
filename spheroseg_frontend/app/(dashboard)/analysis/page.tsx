import type { Metadata } from "next"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Button } from "@/components/ui/button"
import { BarChart, PieChart, LineChart, Download, Filter } from "lucide-react"
import { AnalysisChart } from "@/components/analysis/analysis-chart"
import { AnalysisTable } from "@/components/analysis/analysis-table"
import { AnalysisHeatmap } from "@/components/analysis/analysis-heatmap"

export const metadata: Metadata = {
  title: "Analysis - SpheroSeg",
  description: "Analyze and visualize your spherical object data",
}

export default function AnalysisPage() {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold tracking-tight">Analysis</h1>
        <div className="flex gap-2">
          <Button variant="outline" className="gap-1">
            <Filter className="h-4 w-4" />
            Filters
          </Button>
          <Button variant="outline" className="gap-1">
            <Download className="h-4 w-4" />
            Export
          </Button>
        </div>
      </div>

      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="size-distribution">Size Distribution</TabsTrigger>
          <TabsTrigger value="spatial-analysis">Spatial Analysis</TabsTrigger>
          <TabsTrigger value="time-series">Time Series</TabsTrigger>
          <TabsTrigger value="raw-data">Raw Data</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <BarChart className="h-5 w-5 text-primary" />
                  Size Distribution
                </CardTitle>
                <CardDescription>Distribution of spherical object sizes</CardDescription>
              </CardHeader>
              <CardContent className="h-[300px]">
                <AnalysisChart type="bar" />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <PieChart className="h-5 w-5 text-primary" />
                  Object Classification
                </CardTitle>
                <CardDescription>Classification of detected objects</CardDescription>
              </CardHeader>
              <CardContent className="h-[300px]">
                <AnalysisChart type="pie" />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <LineChart className="h-5 w-5 text-primary" />
                  Trend Analysis
                </CardTitle>
                <CardDescription>Trends in object characteristics over time</CardDescription>
              </CardHeader>
              <CardContent className="h-[300px]">
                <AnalysisChart type="line" />
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Spatial Distribution</CardTitle>
              <CardDescription>Heatmap of object distribution in the sample</CardDescription>
            </CardHeader>
            <CardContent className="h-[400px]">
              <AnalysisHeatmap />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="size-distribution">
          <Card>
            <CardHeader>
              <CardTitle>Size Distribution Analysis</CardTitle>
              <CardDescription>Detailed analysis of object size distribution</CardDescription>
            </CardHeader>
            <CardContent className="h-[500px]">
              <AnalysisChart type="bar" detailed />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="spatial-analysis">
          <Card>
            <CardHeader>
              <CardTitle>Spatial Analysis</CardTitle>
              <CardDescription>Detailed spatial analysis of object distribution</CardDescription>
            </CardHeader>
            <CardContent className="h-[500px]">
              <AnalysisHeatmap detailed />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="time-series">
          <Card>
            <CardHeader>
              <CardTitle>Time Series Analysis</CardTitle>
              <CardDescription>Analysis of object characteristics over time</CardDescription>
            </CardHeader>
            <CardContent className="h-[500px]">
              <AnalysisChart type="line" detailed />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="raw-data">
          <Card>
            <CardHeader>
              <CardTitle>Raw Data</CardTitle>
              <CardDescription>Raw measurement data for all detected objects</CardDescription>
            </CardHeader>
            <CardContent>
              <AnalysisTable />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}

