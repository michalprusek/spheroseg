import React, { useMemo } from 'react';
import { Point } from '@/types';
import { EditMode } from '@/pages/segmentation/hooks/segmentation';
import filterVisiblePolygons from '../../utils/polygonVisibility';
import { createNamespacedLogger } from '@/utils/logger';

const logger = createNamespacedLogger('segmentation:canvas:polygonLayer');

interface Polygon {
  id: string;
  points: Point[];
  type?: 'external' | 'internal';
  class?: string;
  color?: string;
  parentId?: string;
}

interface SegmentationData {
  polygons: Polygon[];
}

interface CanvasPolygonLayerProps {
  segmentationData: SegmentationData | null;
  transform: { zoom: number; translateX: number; translateY: number };
  selectedPolygonId: string | null;
  editMode: EditMode;
  canvasRef: React.RefObject<HTMLDivElement | null>;
}

const CanvasPolygonLayer: React.FC<CanvasPolygonLayerProps> = ({
  segmentationData,
  transform,
  selectedPolygonId,
  editMode,
  canvasRef,
}) => {
  const formatPoints = (points: Point[]): string => {
    return points.map((p) => `${p.x},${p.y}`).join(' ');
  };

  const getPolygonStyle = (polygon: Polygon) => {
    const isSelected = polygon.id === selectedPolygonId;
    const baseColor = polygon.type === 'internal' ? 'blue' : 'red';

    const baseFillOpacity = isSelected ? 0.5 : 0.3;
    const baseFill =
      polygon.type === 'internal' ? `rgba(0, 0, 255, ${baseFillOpacity})` : `rgba(255, 0, 0, ${baseFillOpacity})`;

    let strokeColor = baseColor;
    if (isSelected && editMode === EditMode.Slice) {
      strokeColor = '#00FF00';
    }

    return {
      fill: baseFill,
      stroke: strokeColor,
      strokeWidth: isSelected ? 2 / transform.zoom : 1 / transform.zoom,
      cursor: 'default',
    };
  };

  return (
    <>
      {useMemo(() => {
        if (!segmentationData?.polygons || segmentationData.polygons.length < 50) {
          return segmentationData?.polygons.map((polygon) => (
            <polygon
              key={polygon.id}
              points={formatPoints(polygon.points)}
              style={getPolygonStyle(polygon)}
              vectorEffect="non-scaling-stroke"
            />
          ));
        }

        const canvasWidth = canvasRef.current?.clientWidth || 1000;
        const canvasHeight = canvasRef.current?.clientHeight || 800;

        const visiblePolygons = filterVisiblePolygons(
          segmentationData.polygons,
          canvasWidth,
          canvasHeight,
          transform,
        );

        logger.debug(`Rendering ${visiblePolygons.length} of ${segmentationData.polygons.length} polygons`);

        return visiblePolygons.map((polygon) => (
          <polygon
            key={polygon.id}
            points={formatPoints(polygon.points)}
            style={getPolygonStyle(polygon)}
            vectorEffect="non-scaling-stroke"
          />
        ));
      }, [
        segmentationData?.polygons,
        transform,
        selectedPolygonId,
        canvasRef.current?.clientWidth,
        canvasRef.current?.clientHeight,
      ])}
    </>
  );
};

CanvasPolygonLayer.displayName = 'CanvasPolygonLayer';

export default CanvasPolygonLayer;