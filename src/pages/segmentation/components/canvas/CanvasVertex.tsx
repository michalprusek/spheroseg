
import React from 'react';
import { cn } from '@/lib/utils';
import { Point } from '@/lib/segmentation';

interface CanvasVertexProps {
  point: Point;
  polygonId: string;
  vertexIndex: number;
  isSelected: boolean;
  isHovered: boolean;
  isDragging: boolean;
  zoom: number;
}

const CanvasVertex = ({ 
  point, 
  isSelected, 
  isHovered, 
  isDragging, 
  zoom 
}: CanvasVertexProps) => {
  const getPointRadius = () => {
    // Základní velikost bodu
    let radius = isSelected ? 5 : 4;
    
    // Zvětšit při hoveru nebo tažení
    if (isHovered || isDragging) {
      radius = 7;
    }
    
    // Přizpůsobit velikost zoomu pro lepší viditelnost
    return radius / zoom;
  };

  const radius = getPointRadius();
  
  return (
    <g pointerEvents="all">
      {/* Zvýraznění při hoveru nebo tažení */}
      {(isHovered || isDragging) && (
        <circle
          cx={point.x}
          cy={point.y}
          r={radius * 2.5}
          fill={isDragging ? "rgba(255, 255, 255, 0.5)" : "rgba(255, 255, 255, 0.3)"}
          filter="url(#hover-glow)"
          className={isDragging ? "" : "animate-pulse"}
          style={{ transformOrigin: 'center center', animationDuration: '1.5s' }}
        />
      )}
      
      {/* Neviditelný větší bod pro snazší zachycení myší */}
      <circle
        cx={point.x}
        cy={point.y}
        r={radius * 3.5}
        fill="transparent"
        style={{ cursor: isDragging ? 'grabbing' : 'grab' }}
        pointerEvents="all"
      />
      
      {/* Samotný bod */}
      <circle
        cx={point.x}
        cy={point.y}
        r={radius}
        fill={isSelected ? "#FF3B30" : "#FFFFFF"}
        stroke={isSelected ? "#FF3B30" : "#0077FF"}
        strokeWidth={1.5 / zoom}
        className={cn(
          "transition-transform duration-150",
          isHovered ? "scale-125" : ""
        )}
        style={{ 
          cursor: isDragging ? 'grabbing' : 'grab',
          transformOrigin: 'center center',
          transform: isHovered ? `scale(1.25)` : 'scale(1)'
        }}
      />
    </g>
  );
};

export default CanvasVertex;
