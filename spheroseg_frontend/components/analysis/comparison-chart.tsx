export function ComparisonChart() {
  const projects = [
    { name: "Cell Membrane Analysis", value1: 24.3, value2: 0.42 },
    { name: "Neuron Cluster Identification", value1: 18.7, value2: 0.31 },
    { name: "Bacterial Colony Counting", value1: 12.5, value2: 0.78 },
    { name: "Tissue Sample Analysis", value1: 32.1, value2: 0.25 },
    { name: "Protein Localization Study", value1: 15.9, value2: 0.53 },
  ]

  const maxValue1 = Math.max(...projects.map((p) => p.value1))
  const maxValue2 = Math.max(...projects.map((p) => p.value2))

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between text-sm">
        <div className="flex items-center gap-2">
          <div className="h-3 w-3 rounded-full bg-primary"></div>
          <span>Average Size (px)</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="h-3 w-3 rounded-full bg-secondary"></div>
          <span>Density (obj/μm²)</span>
        </div>
      </div>
      <div className="space-y-4">
        {projects.map((project, i) => (
          <div key={i} className="space-y-2">
            <div className="text-sm font-medium">{project.name}</div>
            <div className="flex gap-2">
              <div
                className="h-8 bg-primary rounded-md"
                style={{ width: `${(project.value1 / maxValue1) * 100}%` }}
              ></div>
              <div className="text-sm">{project.value1.toFixed(1)}</div>
            </div>
            <div className="flex gap-2">
              <div
                className="h-8 bg-secondary rounded-md"
                style={{ width: `${(project.value2 / maxValue2) * 100}%` }}
              ></div>
              <div className="text-sm">{project.value2.toFixed(2)}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

