import type { Metadata } from "next"
import { AnalysisDashboard } from "@/components/analysis/analysis-dashboard"

export const metadata: Metadata = {
  title: "Analysis | SpheroSeg",
  description: "Analyze and visualize your image processing results",
}

export default function AnalysisPage() {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Analysis</h1>
        <p className="text-muted-foreground">Visualize and analyze your image processing results</p>
      </div>
      <AnalysisDashboard />
    </div>
  )
}

