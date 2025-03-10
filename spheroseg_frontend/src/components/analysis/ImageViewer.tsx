import { useState } from 'react'
import { Card } from '@/components/ui/card'
import { Slider } from '@/components/ui/slider'
import { Button } from '@/components/ui/button'
import { 
  ZoomIn, 
  ZoomOut, 
  RotateCcw, 
  Play,
  Save,
  Download
} from 'lucide-react'

interface ImageViewerProps {
  imageUrl: string
  results?: {
    spheroids: Array<{
      id: string
      x: number
      y: number
      diameter: number
      confidence: number
    }>
  }
  onAnalyze?: () => void
  onSave?: () => void
  onExport?: () => void
}

export function ImageViewer({
  imageUrl,
  results,
  onAnalyze,
  onSave,
  onExport
}: ImageViewerProps) {
  const [zoom, setZoom] = useState(100)
  const [showDetections, setShowDetections] = useState(true)

  return (
    <Card className="p-4">
      <div className="flex justify-between items-center mb-4">
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="icon"
            onClick={() => setZoom(z => Math.min(z + 10, 200))}
          >
            <ZoomIn className="h-4 w-4" />
          </Button>
          <Slider
            value={[zoom]}
            onValueChange={([value]) => setZoom(value)}
            min={50}
            max={200}
            step={1}
            className="w-32"
          />
          <Button
            variant="outline"
            size="icon"
            onClick={() => setZoom(z => Math.max(z - 10, 50))}
          >
            <ZoomOut className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="icon"
            onClick={() => setZoom(100)}
          >
            <RotateCcw className="h-4 w-4" />
          </Button>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={() => setShowDetections(s => !s)}
          >
            {showDetections ? 'Hide Detections' : 'Show Detections'}
          </Button>
          <Button onClick={onAnalyze}>
            <Play className="h-4 w-4 mr-2" />
            Analyze
          </Button>
          <Button variant="outline" onClick={onSave}>
            <Save className="h-4 w-4 mr-2" />
            Save
          </Button>
          <Button variant="outline" onClick={onExport}>
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
        </div>
      </div>

      <div 
        className="relative border rounded-lg overflow-hidden"
        style={{ height: '600px' }}
      >
        <img
          src={imageUrl}
          alt="Analysis"
          className="w-full h-full object-contain"
          style={{ 
            transform: `scale(${zoom / 100})`,
            transition: 'transform 0.2s'
          }}
        />
        
        {showDetections && results?.spheroids && (
          <svg className="absolute inset-0">
            {results.spheroids.map(spheroid => (
              <circle
                key={spheroid.id}
                cx={spheroid.x}
                cy={spheroid.y}
                r={spheroid.diameter / 2}
                fill="none"
                stroke={`rgba(0, 255, 0, ${spheroid.confidence})`}
                strokeWidth="2"
              />
            ))}
          </svg>
        )}
      </div>
    </Card>
  )
}