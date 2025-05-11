import React from 'react';
import { EditMode } from '../../hooks/segmentation';
import { useLanguage } from '@/contexts/LanguageContext';

interface Point {
  x: number;
  y: number;
}

interface StatusBarV2Props {
  zoom: number;
  imageCoords: Point | null;
  editMode: EditMode;
  selectedPolygonId: string | null;
  polygonCount?: number;
  vertexCount?: number;
  imageWidth?: number;
  imageHeight?: number;
}

export const StatusBarV2: React.FC<StatusBarV2Props> = ({
  zoom,
  imageCoords,
  editMode,
  selectedPolygonId,
  polygonCount = 0,
  vertexCount = 0,
  imageWidth,
  imageHeight,
}) => {
  const { t } = useLanguage();

  // Format zoom as percentage
  const zoomPercent = Math.round(zoom * 100);

  // Get mode name based on EditMode enum
  const getModeName = () => {
    switch (editMode) {
      case EditMode.View:
        return t('segmentation.modes.view') || 'View';
      case EditMode.EditVertices:
        return t('segmentation.modes.editVertices') || 'Edit Vertices';
      case EditMode.AddPoints:
        return t('segmentation.modes.addPoints') || 'Add Points';
      case EditMode.Slice:
        return t('segmentation.modes.slice') || 'Slice';
      case EditMode.CreatePolygon:
        return t('segmentation.modes.createPolygon') || 'Create Polygon';
      case EditMode.DeletePolygon:
        return t('segmentation.modes.deletePolygon') || 'Delete Polygon';
      default:
        return 'Unknown Mode';
    }
  };

  return (
    <div className="flex items-center justify-between px-4 py-1.5 bg-background border-t border-border text-xs text-muted-foreground">
      <div className="flex items-center space-x-4">
        {/* Zoom Level */}
        <div>
          <span className="font-medium text-foreground">{t('segmentation.zoom') || 'Zoom'}:</span> {zoomPercent}%
        </div>

        {/* Image Resolution */}
        {imageWidth && imageHeight && (
          <div>
            <span className="font-medium text-foreground">{t('segmentation.resolution') || 'Resolution'}:</span>{' '}
            {imageWidth} × {imageHeight} px
          </div>
        )}

        {/* Cursor Position */}
        {imageCoords && (
          <div>
            <span className="font-medium text-foreground">{t('segmentation.position') || 'Position'}:</span> X:{' '}
            {Math.round(imageCoords.x)}, Y: {Math.round(imageCoords.y)}
          </div>
        )}

        {/* Edit Mode */}
        <div>
          <span className="font-medium text-foreground">{t('segmentation.mode') || 'Mode'}:</span> {getModeName()}
        </div>
      </div>

      <div className="flex items-center space-x-4">
        {/* Selected Polygon */}
        <div>
          <span className="font-medium text-foreground">{t('segmentation.selected') || 'Selected'}:</span>{' '}
          {selectedPolygonId ? `#${selectedPolygonId.substring(0, 8)}` : t('segmentation.none') || 'None'}
        </div>

        {/* Polygon Count */}
        <div>
          <span className="font-medium text-foreground">{t('segmentation.polygons') || 'Polygons'}:</span>{' '}
          {polygonCount}
        </div>

        {/* Vertex Count */}
        <div>
          <span className="font-medium text-foreground">{t('segmentation.vertices') || 'Vertices'}:</span> {vertexCount}
        </div>
      </div>
    </div>
  );
};
