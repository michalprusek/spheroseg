export function DensityMapChart() {
  return (
    <div className="h-[300px] w-full bg-muted rounded-md p-4 grid grid-cols-10 grid-rows-10 gap-1">
      {Array.from({ length: 100 }).map((_, i) => {
        const intensity = Math.floor(Math.random() * 100)
        return (
          <div
            key={i}
            className="rounded-sm"
            style={{
              backgroundColor: `rgba(37, 99, 235, ${intensity / 100})`,
              width: "100%",
              height: "100%",
            }}
          ></div>
        )
      })}
    </div>
  )
}

