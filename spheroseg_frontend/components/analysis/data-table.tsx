import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"

export function DataTable() {
  const data = Array.from({ length: 10 }).map((_, i) => ({
    id: i + 1,
    project: ["Cell Membrane Analysis", "Neuron Cluster Identification", "Bacterial Colony Counting"][i % 3],
    image: `Image_${i + 1}.tiff`,
    objects: Math.floor(Math.random() * 100) + 50,
    avgSize: (Math.random() * 30 + 10).toFixed(1),
    density: (Math.random() * 0.8 + 0.2).toFixed(2),
    date: new Date(Date.now() - i * 86400000).toLocaleDateString(),
  }))

  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>ID</TableHead>
            <TableHead>Project</TableHead>
            <TableHead>Image</TableHead>
            <TableHead className="text-right">Objects</TableHead>
            <TableHead className="text-right">Avg. Size (px)</TableHead>
            <TableHead className="text-right">Density (obj/μm²)</TableHead>
            <TableHead className="text-right">Date</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.map((row) => (
            <TableRow key={row.id}>
              <TableCell>{row.id}</TableCell>
              <TableCell>{row.project}</TableCell>
              <TableCell>{row.image}</TableCell>
              <TableCell className="text-right">{row.objects}</TableCell>
              <TableCell className="text-right">{row.avgSize}</TableCell>
              <TableCell className="text-right">{row.density}</TableCell>
              <TableCell className="text-right">{row.date}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}

