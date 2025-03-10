import React, { useCallback, useRef, useEffect } from 'react'
import { useVirtualizer } from '@tanstack/react-virtual'
import { useIntersectionObserver } from '@/hooks/useIntersectionObserver'
import { ImageProcessor } from '@/lib/image-processing'

interface ImageViewerProps {
  images: ImageData[]
  onImageSelect: (imageId: string) => void
}

export const ImageViewer: React.FC<ImageViewerProps> = ({
  images,
  onImageSelect
}) => {
  const containerRef = useRef<HTMLDivElement>(null)
  const imageProcessor = useRef(new ImageProcessor())
  
  // Virtualizace seznamu obrázků
  const rowVirtualizer = useVirtualizer({
    count: images.length,
    getScrollElement: () => containerRef.current,
    estimateSize: () => 200,
    overscan: 5
  })

  // Lazy loading obrázků
  const observerCallback = useCallback((entries: IntersectionObserverEntry[]) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        const img = entry.target as HTMLImageElement
        const originalSrc = img.dataset.src
        if (originalSrc) {
          img.src = originalSrc
          img.removeAttribute('data-src')
        }
      }
    })
  }, [])

  const { observe, unobserve } = useIntersectionObserver(observerCallback)

  // Předzpracování obrázků
  const processImage = useCallback(async (imageData: ImageData) => {
    const processed = await imageProcessor.current.process(imageData)
    return processed
  }, [])

  return (
    <div
      ref={containerRef}
      className="h-screen overflow-auto"
      style={{
        contain: 'strict'
      }}
    >
      <div
        style={{
          height: `${rowVirtualizer.getTotalSize()}px`,
          width: '100%',
          position: 'relative'
        }}
      >
        {rowVirtualizer.getVirtualItems().map((virtualRow) => {
          const image = images[virtualRow.index]
          return (
            <div
              key={virtualRow.index}
              ref={(el) => {
                if (el) {
                  observe(el)
                }
              }}
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                height: `${virtualRow.size}px`,
                transform: `translateY(${virtualRow.start}px)`
              }}
              className="p-2"
            >
              <img
                data-src={image.url}
                alt={image.name}
                className="w-full h-full object-cover rounded-lg"
                loading="lazy"
                onClick={() => onImageSelect(image.id)}
              />
            </div>
          )
        })}
      </div>
    </div>
  )
}