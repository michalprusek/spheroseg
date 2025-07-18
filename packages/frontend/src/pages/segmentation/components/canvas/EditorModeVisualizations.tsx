import { Point } from '@/lib/segmentation';
import { TempPointsState } from '@/pages/segmentation/types';
import TemporaryEditPath from './TemporaryEditPath';
import SlicingModeVisualizer from './SlicingModeVisualizer';
import PointAddingVisualizer from './PointAddingVisualizer';

interface EditorModeVisualizationsProps {
  editMode: boolean;
  slicingMode: boolean;
  pointAddingMode: boolean;
  tempPoints: TempPointsState;
  cursorPosition: Point | null;
  sliceStartPoint: Point | null;
  hoveredSegment: {
    polygonId: string | null;
    segmentIndex: number | null;
    projectedPoint: Point | null;
  };
  isShiftPressed?: boolean;
  selectedPolygonPoints?: Point[] | null;
  pointAddingTempPoints?: Point[];
  selectedVertexIndex?: number | null;
  sourcePolygonId?: string | null;
}

/**
 * Renders visualizations for different editing modes using image coordinates.
 * Assumes parent SVG handles zoom/offset transformations.
 */
const EditorModeVisualizations = ({
  editMode,
  slicingMode,
  pointAddingMode,
  tempPoints,
  cursorPosition,
  sliceStartPoint,
  hoveredSegment,
  isShiftPressed,
  selectedPolygonPoints,
  pointAddingTempPoints = [],
  selectedVertexIndex,
  sourcePolygonId,
}: EditorModeVisualizationsProps) => {
  // Odstranil jsem console.log pro lepší výkon a čistotu kódu

  return (
    <>
      {/* Create Polygon Mode Visualization */}
      {editMode && (
        <TemporaryEditPath tempPoints={tempPoints} cursorPosition={cursorPosition} isShiftPressed={isShiftPressed} />
      )}

      {/* Slicing Mode Visualization */}
      {slicingMode && <SlicingModeVisualizer sliceStartPoint={sliceStartPoint} cursorPosition={cursorPosition} />}

      {/* Point Adding Mode Visualization */}
      {pointAddingMode && (
        <PointAddingVisualizer
          hoveredSegment={hoveredSegment}
          tempPoints={pointAddingTempPoints || []}
          selectedVertexIndex={selectedVertexIndex || null}
          sourcePolygonId={sourcePolygonId || null}
          polygonPoints={selectedPolygonPoints}
          cursorPosition={cursorPosition}
        />
      )}
    </>
  );
};

export default EditorModeVisualizations;
