import { useState } from 'react'
import { api, endpoints } from '@/lib/api'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Checkbox } from '@/components/ui/checkbox'
import { Download, FileSpreadsheet, FileJson, FileImage } from 'lucide-react'

interface ExportDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  projectId: string
  selectedImages?: string[]
}

export function ExportDialog({
  open,
  onOpenChange,
  projectId,
  selectedImages
}: ExportDialogProps) {
  const [format, setFormat] = useState('csv')
  const [options, setOptions] = useState({
    includeMetadata: true,
    includeConfidence: true,
    includeThumbnails: false
  })

  const handleExport = async () => {
    try {
      const response = await api.post(
        endpoints.projects.get(projectId) + '/export',
        {
          format,
          options,
          images: selectedImages
        },
        { responseType: 'blob' }
      )

      const url = window.URL.createObjectURL(response.data)
      const link = document.createElement('a')
      link.href = url
      link.download = `spheroseg-export-${projectId}.${format}`
      document.body.appendChild(link)
      link.click()
      link.remove()
      window.URL.revokeObjectURL(url)
      
      onOpenChange(false)
    } catch (error) {
      console.error('Export failed:', error)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Export Results</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <label className="text-sm font-medium">Export Format</label>
            <Select value={format} onValueChange={setFormat}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="csv">
                  <div className="flex items-center gap-2">
                    <FileSpreadsheet className="h-4 w-4" />
                    CSV
                  </div>
                </SelectItem>
                <SelectItem value="json">
                  <div className="flex items-center gap-2">
                    <FileJson className="h-4 w-4" />
                    JSON
                  </div>
                </SelectItem>
                <SelectItem value="zip">
                  <div className="flex items-center gap-2">
                    <FileImage className="h-4 w-4" />
                    ZIP (with images)
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Export Options</label>
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Checkbox
                  checked={options.includeMetadata}
                  onCheckedChange={(checked) => 
                    setOptions(prev => ({ ...prev, includeMetadata: !!checked }))
                  }
                />
                <label className="text-sm">Include metadata</label>
              </div>
              <div className="flex items-center gap-2">
                <Checkbox
                  checked={options.includeConfidence}
                  onCheckedChange={(checked) =>
                    setOptions(prev => ({ ...prev, includeConfidence: !!checked }))
                  }
                />
                <label className="text-sm">Include confidence scores</label>
              </div>
              <div className="flex items-center gap-2">
                <Checkbox
                  checked={options.includeThumbnails}
                  onCheckedChange={(checked) =>
                    setOptions(prev => ({ ...prev, includeThumbnails: !!checked }))
                  }
                />
                <label className="text-sm">Include thumbnails</label>
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button onClick={handleExport}>
              <Download className="h-4 w-4 mr-2" />
              Export
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}