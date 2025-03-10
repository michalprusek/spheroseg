"use client"

import { useState } from "react"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Input } from "@/components/ui/input"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Button } from "@/components/ui/button"
import { ChevronDown, Search } from "lucide-react"

interface DataItem {
  id: number
  project: string
  image: string
  objectId: number
  size: number
  circularity: number
  intensity: number
  date: string
}

// Generate random data
const generateData = (): DataItem[] => {
  const projects = ["Brain Cell Analysis", "Tumor Spheroid Study", "Embryoid Bodies"]
  const dates = ["2023-05-12", "2023-05-15", "2023-05-18", "2023-05-20"]

  return Array.from({ length: 50 }, (_, i) => ({
    id: i + 1,
    project: projects[Math.floor(Math.random() * projects.length)],
    image: `Image_${Math.floor(Math.random() * 10) + 1}.tiff`,
    objectId: Math.floor(Math.random() * 1000) + 1,
    size: Math.round((Math.random() * 40 + 10) * 10) / 10,
    circularity: Math.round((Math.random() * 0.3 + 0.7) * 100) / 100,
    intensity: Math.floor(Math.random() * 200) + 50,
    date: dates[Math.floor(Math.random() * dates.length)],
  }))
}

export function AnalysisTable() {
  const [data] = useState<DataItem[]>(generateData)
  const [searchTerm, setSearchTerm] = useState("")

  const filteredData = data.filter(
    (item) =>
      item.project.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.image.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.objectId.toString().includes(searchTerm),
  )

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            type="search"
            placeholder="Search..."
            className="pl-8"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" className="gap-1">
              Export
              <ChevronDown className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent>
            <DropdownMenuItem>Export as CSV</DropdownMenuItem>
            <DropdownMenuItem>Export as Excel</DropdownMenuItem>
            <DropdownMenuItem>Export as JSON</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>ID</TableHead>
              <TableHead>Project</TableHead>
              <TableHead>Image</TableHead>
              <TableHead>Object ID</TableHead>
              <TableHead className="text-right">Size (µm)</TableHead>
              <TableHead className="text-right">Circularity</TableHead>
              <TableHead className="text-right">Intensity</TableHead>
              <TableHead className="text-right">Date</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredData.map((item) => (
              <TableRow key={item.id}>
                <TableCell>{item.id}</TableCell>
                <TableCell>{item.project}</TableCell>
                <TableCell>{item.image}</TableCell>
                <TableCell>{item.objectId}</TableCell>
                <TableCell className="text-right">{item.size}</TableCell>
                <TableCell className="text-right">{item.circularity}</TableCell>
                <TableCell className="text-right">{item.intensity}</TableCell>
                <TableCell className="text-right">{item.date}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}

