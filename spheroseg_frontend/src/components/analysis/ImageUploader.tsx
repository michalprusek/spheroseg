import { useState, useCallback } from 'react'
import { useDropzone } from 'react-dropzone'
import { api, endpoints } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { Upload, X, CheckCircle, AlertCircle } from 'lucide-react'

interface UploadStatus {
  file: File
  progress: number
  status: 'pending' | 'uploading' | 'success' | 'error'
  error?: string
}

export function ImageUploader({ projectId }: { projectId: string }) {
  const [uploads, setUploads] = useState<UploadStatus[]>([])

  const onDrop = useCallback((acceptedFiles: File[]) => {
    const newUploads = acceptedFiles.map(file => ({
      file,
      progress: 0,
      status: 'pending' as const
    }))
    setUploads(prev => [...prev, ...newUploads])
    
    acceptedFiles.forEach((file, index) => {
      uploadFile(file, uploads.length + index)
    })
  }, [uploads.length])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'image/*': ['.png', '.jpg', '.jpeg', '.tiff']
    }
  })

  const uploadFile = async (file: File, index: number) => {
    const formData = new FormData()
    formData.append('file', file)
    formData.append('project_id', projectId)

    try {
      setUploads(prev => prev.map((u, i) => 
        i === index ? { ...u, status: 'uploading' } : u
      ))

      await api.post(`${endpoints.projects.get(projectId)}/images`, formData, {
        onUploadProgress: (progressEvent) => {
          const progress = progressEvent.loaded / (progressEvent.total || 0) * 100
          setUploads(prev => prev.map((u, i) => 
            i === index ? { ...u, progress } : u
          ))
        }
      })

      setUploads(prev => prev.map((u, i) => 
        i === index ? { ...u, status: 'success' } : u
      ))
    } catch (error) {
      setUploads(prev => prev.map((u, i) => 
        i === index ? { ...u, status: 'error', error: 'Upload failed' } : u
      ))
    }
  }

  return (
    <div className="space-y-4">
      <div
        {...getRootProps()}
        className={`
          border-2 border-dashed rounded-lg p-8 text-center cursor-pointer
          ${isDragActive ? 'border-primary bg-primary/5' : 'border-gray-300'}
        `}
      >
        <input {...getInputProps()} />
        <Upload className="h-12 w-12 mx-auto mb-4 text-gray-400" />
        <p className="text-sm text-gray-600">
          {isDragActive
            ? 'Drop the files here...'
            : 'Drag & drop images here, or click to select files'}
        </p>
        <p className="text-xs text-gray-500 mt-2">
          Supported formats: PNG, JPG, JPEG, TIFF
        </p>
      </div>

      {uploads.length > 0 && (
        <div className="space-y-2">
          {uploads.map((upload, index) => (
            <div
              key={index}
              className="flex items-center gap-4 p-2 border rounded-lg"
            >
              <div className="flex-1">
                <p className="text-sm font-medium">{upload.file.name}</p>
                <Progress value={upload.progress} className="h-1 mt-1" />
              </div>
              
              <div className="flex items-center gap-2">
                {upload.status === 'uploading' && (
                  <p className="text-sm text-gray-500">
                    {Math.round(upload.progress)}%
                  </p>
                )}
                {upload.status === 'success' && (
                  <CheckCircle className="h-5 w-5 text-green-500" />
                )}
                {upload.status === 'error' && (
                  <AlertCircle className="h-5 w-5 text-red-500" />
                )}
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setUploads(prev => prev.filter((_, i) => i !== index))}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ))}
          
          <div className="flex justify-end gap-2">
            <Button
              variant="outline"
              onClick={() => setUploads([])}
            >
              Clear All
            </Button>
            <Button>
              Process Images
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}