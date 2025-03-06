"use client"

import type React from "react"

import { useState, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Upload, X } from "lucide-react"
import { Progress } from "@/components/ui/progress"
import { IMAGE_ENDPOINTS, fetchWithAuth } from "@/app/api/api-config"
import { useToast } from "@/components/ui/use-toast"

interface ImageUploaderProps {
  projectId: string;
  onUploadComplete?: () => void;
}

export default function ImageUploader({ projectId, onUploadComplete }: ImageUploaderProps) {
  const [files, setFiles] = useState<File[]>([])
  const [uploading, setUploading] = useState(false)
  const [progress, setProgress] = useState(0)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const { toast } = useToast()

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const newFiles = Array.from(e.target.files)
      setFiles((prev) => [...prev, ...newFiles])
    }
  }

  const removeFile = (index: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== index))
  }

  const handleUpload = async () => {
    if (files.length === 0) return

    setUploading(true)
    setProgress(0)

    try {
      let successCount = 0;
      let errorCount = 0;
      
      // Nahrávat soubory postupně jeden po druhém
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        
        // Aktualizace průběhu celkového nahrávání
        setProgress(Math.floor((i / files.length) * 100));
        
        // Vytvoření FormData pro aktuální soubor
        const formData = new FormData();
        formData.append('project_id', projectId);
        formData.append('file', file);
        
        try {
          // Upload the file
          const response = await fetchWithAuth(IMAGE_ENDPOINTS.upload, {
            method: 'POST',
            body: formData,
          });
          
          if (response.ok) {
            successCount++;
          } else {
            errorCount++;
            const errorData = await response.json().catch(() => ({}));
            console.error(`Failed to upload ${file.name}:`, errorData);
          }
        } catch (error) {
          errorCount++;
          console.error(`Failed to upload ${file.name}:`, error);
        }
      }
      
      // Nastavit 100% po dokončení všech nahrávání
      setProgress(100);
      
      // Reset after upload with appropriate message
      setTimeout(() => {
        setFiles([]);
        setUploading(false);
        setProgress(0);
        
        if (successCount > 0) {
          toast({
            title: `${successCount} z ${files.length} úspěšně nahráno`,
            description: errorCount > 0 ? `${errorCount} souborů se nepodařilo nahrát` : `Všechny obrázky byly úspěšně nahrány`,
            variant: errorCount > 0 ? "default" : "default",
          });
        } else {
          toast({
            title: "Chyba",
            description: "Nepodařilo se nahrát žádné obrázky",
            variant: "destructive",
          });
        }
        
        // Call the callback if provided and at least one file was uploaded successfully
        if (onUploadComplete && successCount > 0) {
          onUploadComplete();
        }
      }, 1000);
    } catch (error) {
      console.error("Upload process failed:", error);
      toast({
        title: "Chyba",
        description: "Nepodařilo se nahrát obrázky",
        variant: "destructive",
      });
      setUploading(false);
    }
  }

  return (
    <Card className="p-6">
      <div className="flex flex-col items-center justify-center">
        <div
          className="border-2 border-dashed border-gray-300 rounded-lg p-8 w-full text-center cursor-pointer hover:bg-gray-50 transition-colors"
          onClick={() => fileInputRef.current?.click()}
        >
          <Upload className="mx-auto h-12 w-12 text-gray-400" />
          <h3 className="mt-2 text-sm font-medium text-gray-900">Nahrajte obrázky pro segmentaci</h3>
          <p className="mt-1 text-xs text-gray-500">PNG, JPG, TIFF až do 50MB</p>
          <input
            type="file"
            multiple
            accept="image/*"
            className="hidden"
            ref={fileInputRef}
            onChange={handleFileChange}
          />
        </div>

        {files.length > 0 && (
          <div className="mt-4 w-full">
            <h4 className="text-sm font-medium mb-2">Vybrané soubory ({files.length})</h4>
            <ul className="space-y-2 max-h-40 overflow-y-auto">
              {files.map((file, index) => (
                <li key={index} className="flex justify-between items-center p-2 bg-gray-50 rounded">
                  <span className="text-sm truncate max-w-[80%]">{file.name}</span>
                  <Button variant="ghost" size="sm" onClick={() => removeFile(index)} className="h-6 w-6 p-0">
                    <X className="h-4 w-4" />
                  </Button>
                </li>
              ))}
            </ul>

            {uploading ? (
              <div className="mt-4">
                <Progress value={progress} className="h-2 w-full" />
                <p className="text-xs text-center mt-1">Nahrávání... {progress}%</p>
              </div>
            ) : (
              <Button onClick={handleUpload} className="mt-4 w-full">
                Nahrát a segmentovat ({files.length} souborů)
              </Button>
            )}
          </div>
        )}
      </div>
    </Card>
  )
}

