"use client"

import { useTheme } from "next-themes"

interface AnalysisChartProps {
  type: "bar" | "line" | "pie"
  detailed?: boolean
}

export function AnalysisChart({ type, detailed = false }: AnalysisChartProps) {
  const { theme } = useTheme()
  const isDark = theme === "dark"

  // Generate random data for visualization
  const generateData = () => {
    if (type === "pie") {
      return [
        { value: Math.floor(Math.random() * 40) + 10, label: "Small" },
        { value: Math.floor(Math.random() * 40) + 20, label: "Medium" },
        { value: Math.floor(Math.random() * 40) + 15, label: "Large" },
        { value: Math.floor(Math.random() * 20) + 5, label: "Extra Large" },
      ]
    }

    return Array.from({ length: detailed ? 20 : 10 }, (_, i) => ({
      value: Math.floor(Math.random() * 80) + 20,
      label: `${i * 5}-${(i + 1) * 5} µm`,
    }))
  }

  const data = generateData()

  if (type === "bar") {
    return (
      <div className="h-full w-full">
        <div className="flex h-[calc(100%-24px)] w-full items-end justify-between gap-1 px-2">
          {data.map((item, i) => (
            <div key={i} className="group relative flex flex-1 flex-col items-center">
              <div className="w-full rounded-t bg-primary" style={{ height: `${item.value}%` }}></div>
              <div className="absolute bottom-0 left-1/2 -translate-x-1/2 translate-y-full opacity-0 transition-opacity group-hover:opacity-100">
                <div className="rounded bg-popover px-2 py-1 text-xs">{item.value}</div>
              </div>
            </div>
          ))}
        </div>
        <div className="mt-2 flex justify-between overflow-hidden text-xs text-muted-foreground">
          <span>{data[0].label}</span>
          <span>{data[data.length - 1].label}</span>
        </div>
      </div>
    )
  }

  if (type === "pie") {
    const total = data.reduce((sum, item) => sum + item.value, 0)
    let cumulativePercent = 0

    return (
      <div className="flex h-full items-center justify-center">
        <div className="relative h-48 w-48">
          <svg viewBox="0 0 100 100" className="h-full w-full -rotate-90">
            {data.map((item, i) => {
              const percent = (item.value / total) * 100
              const startPercent = cumulativePercent
              cumulativePercent += percent

              return (
                <circle
                  key={i}
                  cx="50"
                  cy="50"
                  r="40"
                  fill="none"
                  stroke={
                    i === 0
                      ? "hsl(var(--primary))"
                      : i === 1
                        ? "hsl(var(--secondary))"
                        : i === 2
                          ? "hsl(var(--accent))"
                          : "hsl(var(--muted))"
                  }
                  strokeWidth="20"
                  strokeDasharray={`${percent} ${100 - percent}`}
                  strokeDashoffset={`${-startPercent}`}
                />
              )
            })}
          </svg>
          <div className="absolute inset-0 flex items-center justify-center text-lg font-semibold">{total}</div>
        </div>
        <div className="ml-4 space-y-2">
          {data.map((item, i) => (
            <div key={i} className="flex items-center gap-2">
              <div
                className="h-3 w-3 rounded-full"
                style={{
                  backgroundColor:
                    i === 0
                      ? "hsl(var(--primary))"
                      : i === 1
                        ? "hsl(var(--secondary))"
                        : i === 2
                          ? "hsl(var(--accent))"
                          : "hsl(var(--muted))",
                }}
              ></div>
              <span className="text-sm">
                {item.label} ({Math.round((item.value / total) * 100)}%)
              </span>
            </div>
          ))}
        </div>
      </div>
    )
  }

  if (type === "line") {
    const points = data.map((item, i) => `${(i / (data.length - 1)) * 100},${100 - item.value}`).join(" ")

    return (
      <div className="h-full w-full">
        <div className="h-[calc(100%-24px)] w-full px-2">
          <svg viewBox="0 0 100 100" className="h-full w-full" preserveAspectRatio="none">
            <polyline points={points} fill="none" stroke="hsl(var(--primary))" strokeWidth="2" />
            {data.map((item, i) => (
              <circle
                key={i}
                cx={`${(i / (data.length - 1)) * 100}`}
                cy={`${100 - item.value}`}
                r="2"
                fill="hsl(var(--primary))"
              />
            ))}
          </svg>
        </div>
        <div className="mt-2 flex justify-between overflow-hidden text-xs text-muted-foreground">
          <span>Day 1</span>
          <span>Day {data.length}</span>
        </div>
      </div>
    )
  }

  return null
}

