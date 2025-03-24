
import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from "framer-motion";
import { Loader2 } from 'lucide-react';
import { SegmentationResult, Point } from '@/lib/segmentation';
import { DragState, VertexDragState } from '../types';
import { cn } from '@/lib/utils';

interface EditorCanvasProps {
  loading: boolean;
  segmentation: SegmentationResult | null;
  zoom: number;
  offset: { x: number; y: number };
  selectedPolygonId: string | null;
  hoveredVertex: { polygonId: string | null, vertexIndex: number | null };
  imageSrc: string;
  onMouseDown: (e: React.MouseEvent) => void;
  onMouseMove: (e: React.MouseEvent) => void;
  onMouseUp: () => void;
  dragState: React.MutableRefObject<DragState>;
  vertexDragState: React.MutableRefObject<VertexDragState>;
  containerRef: React.MutableRefObject<HTMLDivElement | null>;
}

const EditorCanvas = ({
  loading,
  segmentation,
  zoom,
  offset,
  selectedPolygonId,
  hoveredVertex,
  imageSrc,
  onMouseDown,
  onMouseMove,
  onMouseUp,
  dragState,
  vertexDragState,
  containerRef
}: EditorCanvasProps) => {
  const [imageSize, setImageSize] = useState({ width: 0, height: 0 });
  
  // Načtení obrázku a zjištění jeho velikosti
  useEffect(() => {
    if (!segmentation) return;
    
    const img = new Image();
    img.onload = () => {
      setImageSize({
        width: img.width,
        height: img.height
      });
    };
    
    img.src = segmentation.imageSrc || imageSrc;
  }, [segmentation, imageSrc]);

  // SVG manipulace s bodem pro lepší UX
  const getPointRadius = (polygonId: string, vertexIndex: number) => {
    const isSelected = selectedPolygonId === polygonId;
    const isHovered = hoveredVertex.polygonId === polygonId && hoveredVertex.vertexIndex === vertexIndex;
    
    // Základní velikost bodu
    let radius = isSelected ? 5 : 4;
    
    // Zvětšit při hoveru
    if (isHovered) {
      radius = 7;
    }
    
    // Přizpůsobit velikost zooma, ale ne příliš
    return radius / (zoom > 1 ? Math.sqrt(zoom) : 1);
  };

  return (
    <div 
      ref={containerRef} 
      className="flex-1 overflow-hidden relative cursor-move bg-[#161616] bg-opacity-90 bg-[radial-gradient(#1a1f2c_1px,transparent_1px)] bg-[size:20px_20px]"
      onMouseDown={onMouseDown}
      onMouseMove={onMouseMove}
      onMouseUp={onMouseUp}
      onMouseLeave={onMouseUp}
    >
      <AnimatePresence>
        {loading ? (
          <motion.div 
            className="absolute inset-0 flex items-center justify-center z-30"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
          >
            <div className="flex flex-col items-center bg-slate-800/80 p-6 rounded-lg shadow-lg backdrop-blur-sm">
              <Loader2 className="h-10 w-10 text-blue-500 animate-spin mb-4" />
              <p className="text-slate-300">Načítání dat segmentace...</p>
            </div>
          </motion.div>
        ) : (
          <motion.div 
            className="absolute inset-0 flex items-center justify-center overflow-visible"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.3 }}
          >
            <div 
              style={{ 
                transform: `scale(${zoom}) translate(${offset.x}px, ${offset.y}px)`,
                transformOrigin: '0 0',
              }}
              className="relative"
            >
              {/* Obrázek na pozadí */}
              {segmentation && (
                <img 
                  src={segmentation.imageSrc || imageSrc} 
                  alt="Source"
                  className="max-w-none"
                  style={{
                    maxWidth: "none",
                    display: "block"
                  }}
                />
              )}
              
              {/* SVG vrstva s polygony */}
              {segmentation && imageSize.width > 0 && (
                <svg 
                  width={imageSize.width}
                  height={imageSize.height}
                  className="absolute top-0 left-0 pointer-events-none"
                  style={{
                    maxWidth: "none"
                  }}
                >
                  <defs>
                    <filter id="glow" x="-30%" y="-30%" width="160%" height="160%">
                      <feGaussianBlur stdDeviation="2" result="blur" />
                      <feComposite in="SourceGraphic" in2="blur" operator="over" />
                    </filter>
                  </defs>
                  
                  {segmentation.polygons.map(polygon => {
                    const isSelected = selectedPolygonId === polygon.id;
                    const points = polygon.points.map(p => `${p.x},${p.y}`).join(' ');
                    
                    return (
                      <g key={polygon.id}>
                        {/* Polygon s výplní */}
                        <polygon 
                          points={points}
                          fill={isSelected ? "rgba(255, 59, 48, 0.2)" : "rgba(0, 191, 255, 0.2)"}
                          stroke={isSelected ? "#FF3B30" : "#00BFFF"}
                          strokeWidth={isSelected ? 2 : 1.5}
                          strokeLinejoin="round"
                          className={cn(
                            "transition-colors duration-150",
                            isSelected ? "filter-glow-red" : ""
                          )}
                        />
                        
                        {/* Body (vertexy) */}
                        {polygon.points.map((point, index) => {
                          const isVertexHovered = hoveredVertex.polygonId === polygon.id && 
                                                  hoveredVertex.vertexIndex === index;
                          const radius = getPointRadius(polygon.id, index);
                          
                          return (
                            <g key={`vertex-${index}`}>
                              {/* Zvýraznění při hoveru */}
                              {isVertexHovered && (
                                <circle
                                  cx={point.x}
                                  cy={point.y}
                                  r={radius + 3}
                                  fill="rgba(255, 255, 255, 0.2)"
                                  className="animate-pulse"
                                />
                              )}
                              
                              {/* Samotný bod */}
                              <circle
                                cx={point.x}
                                cy={point.y}
                                r={radius}
                                fill={isSelected ? "#FF3B30" : "#FFFFFF"}
                                stroke={isSelected ? "#FF3B30" : "#0077FF"}
                                strokeWidth={1.5 / Math.sqrt(zoom)}
                                className={cn(
                                  "transition-all duration-150 cursor-pointer",
                                  isVertexHovered ? "scale-110" : ""
                                )}
                                style={{ pointerEvents: 'all' }}
                              />
                            </g>
                          );
                        })}
                      </g>
                    );
                  })}
                </svg>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      
      {/* Informace o zoomu dole */}
      <div className="absolute bottom-4 left-4 bg-slate-800/80 px-3 py-1 rounded-md text-sm backdrop-blur-sm">
        {Math.round(zoom * 100)}%
      </div>
    </div>
  );
};

export default EditorCanvas;
