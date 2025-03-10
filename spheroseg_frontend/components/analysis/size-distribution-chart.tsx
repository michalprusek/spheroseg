export function SizeDistributionChart() {
  return (
    <div className="h-[300px] w-full">
      <div className="h-full w-full bg-muted rounded-md flex items-end justify-between p-4">
        {Array.from({ length: 20 }).map((_, i) => (
          <div
            key={i}
            className="bg-primary w-3 rounded-t-sm"
            style={{
              height: `${Math.floor(Math.random() * 80) + 20}%`,
            }}
          ></div>
        ))}
      </div>
      <div className="mt-2 flex justify-between text-xs text-muted-foreground">
        <span>5 px</span>
        <span>50 px</span>
      </div>
    </div>
  )
}

