import { Microscope, Users, BarChart, Layers, Zap, Shield } from "lucide-react"

export function FeaturesSection() {
  return (
    <section id="features" className="w-full py-12 md:py-24 lg:py-32 bg-muted/50">
      <div className="container px-4 md:px-6">
        <div className="flex flex-col items-center justify-center space-y-4 text-center">
          <div className="space-y-2">
            <div className="inline-block rounded-lg bg-muted px-3 py-1 text-sm">Features</div>
            <h2 className="text-3xl font-bold tracking-tighter sm:text-5xl">Everything You Need for Image Analysis</h2>
            <p className="max-w-[900px] text-muted-foreground md:text-xl/relaxed lg:text-base/relaxed xl:text-xl/relaxed">
              SpheroSeg provides a comprehensive suite of tools for scientific image analysis, collaboration, and data
              visualization.
            </p>
          </div>
        </div>
        <div className="mx-auto grid max-w-5xl grid-cols-1 gap-6 py-12 md:grid-cols-2 lg:grid-cols-3">
          <div className="flex flex-col items-center space-y-2 rounded-lg border p-6 shadow-sm">
            <div className="rounded-full bg-primary/10 p-4">
              <Microscope className="h-6 w-6 text-primary" />
            </div>
            <h3 className="text-xl font-bold">Advanced Image Processing</h3>
            <p className="text-center text-muted-foreground">
              Powerful algorithms for precise spherical object detection and measurement.
            </p>
          </div>
          <div className="flex flex-col items-center space-y-2 rounded-lg border p-6 shadow-sm">
            <div className="rounded-full bg-primary/10 p-4">
              <Users className="h-6 w-6 text-primary" />
            </div>
            <h3 className="text-xl font-bold">Real-time Collaboration</h3>
            <p className="text-center text-muted-foreground">
              Work together with your team in real-time with shared cursors and annotations.
            </p>
          </div>
          <div className="flex flex-col items-center space-y-2 rounded-lg border p-6 shadow-sm">
            <div className="rounded-full bg-primary/10 p-4">
              <BarChart className="h-6 w-6 text-primary" />
            </div>
            <h3 className="text-xl font-bold">Interactive Visualization</h3>
            <p className="text-center text-muted-foreground">
              Explore your data with interactive charts and customizable visualizations.
            </p>
          </div>
          <div className="flex flex-col items-center space-y-2 rounded-lg border p-6 shadow-sm">
            <div className="rounded-full bg-primary/10 p-4">
              <Layers className="h-6 w-6 text-primary" />
            </div>
            <h3 className="text-xl font-bold">Project Management</h3>
            <p className="text-center text-muted-foreground">
              Organize your work with comprehensive project management tools.
            </p>
          </div>
          <div className="flex flex-col items-center space-y-2 rounded-lg border p-6 shadow-sm">
            <div className="rounded-full bg-primary/10 p-4">
              <Zap className="h-6 w-6 text-primary" />
            </div>
            <h3 className="text-xl font-bold">High Performance</h3>
            <p className="text-center text-muted-foreground">
              Fast processing and optimized performance for large datasets.
            </p>
          </div>
          <div className="flex flex-col items-center space-y-2 rounded-lg border p-6 shadow-sm">
            <div className="rounded-full bg-primary/10 p-4">
              <Shield className="h-6 w-6 text-primary" />
            </div>
            <h3 className="text-xl font-bold">Secure & Reliable</h3>
            <p className="text-center text-muted-foreground">
              Enterprise-grade security and reliability for your sensitive research data.
            </p>
          </div>
        </div>
      </div>
    </section>
  )
}

