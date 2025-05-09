
import { SegmentationResult } from '@/lib/segmentation';
import { usePolygonSimplifyAction } from './actions/usePolygonSimplifyAction';
import { usePointEditor } from './geometry/usePointEditor';
import { usePolygonEditModeActions } from './actions/usePolygonEditModeActions';
import { toast } from 'sonner';
import { useLanguage } from '@/contexts/LanguageContext';
import { v4 as uuidv4 } from 'uuid';

/**
 * SINGLE ENTRY POINT for all polygon and vertex actions in the segmentation editor.
 * Inlines logic from former usePolygonModifyActions and useVertexActions for simplicity and maintainability.
 */
export const usePolygonActions = (
  segmentation: SegmentationResult | null,
  setSegmentation: (seg: SegmentationResult | null) => void,
  selectedPolygonId: string | null,
  setSelectedPolygonId: (id: string | null) => void,
  togglePointAddingMode: () => void,
  toggleSlicingMode: () => void
) => {
  const { t } = useLanguage();
  // Point editor utilities
  const pointEditor = usePointEditor(segmentation, setSegmentation);
  // Simplification actions
  const { simplifySelectedPolygon } = usePolygonSimplifyAction(
    segmentation, 
    setSegmentation, 
    selectedPolygonId
  );
  
  // --- Vertex actions ---
  // Delete vertex
  const handleDeleteVertex = (polygonId: string, vertexIndex: number) => {
    const success = pointEditor.removePoint(polygonId, vertexIndex);
    if (success) {
      toast.success(t('segmentation.vertexDeleted'));
    } else {
      toast.error(t('segmentation.vertexDeleteFailed'));
    }
  };
  // Duplicate vertex
  const handleDuplicateVertex = (polygonId: string, vertexIndex: number) => {
    const success = pointEditor.duplicatePoint(polygonId, vertexIndex);
    if (success) {
      toast.success(t('segmentation.vertexDuplicated'));
    } else {
      toast.error(t('segmentation.vertexDuplicateFailed'));
    }
  };
  // Add/remove point to polygon
  const addPointToPolygon = pointEditor.addPoint;
  const removePointFromPolygon = pointEditor.removePoint;

  // --- Polygon modification actions ---
  // Duplicate polygon
  const handleDuplicatePolygon = () => {
    if (!segmentation) return;
    const polygon = segmentation.polygons.find(p => p.id === selectedPolygonId);
    if (!polygon) return;
    const offsetX = 20;
    const offsetY = 20;
    const newPolygon = {
      ...polygon,
      id: uuidv4(),
      points: polygon.points.map(p => ({ x: p.x + offsetX, y: p.y + offsetY }))
    };
    setSegmentation({
      ...segmentation,
      polygons: [...segmentation.polygons, newPolygon]
    });
    setSelectedPolygonId(newPolygon.id);
    toast.success(t('segmentation.polygonDuplicated'));
  };
  // Delete polygon
  const handleDeletePolygon = () => {
    if (!selectedPolygonId || !segmentation) return;
    setSegmentation({
      ...segmentation,
      polygons: segmentation.polygons.filter(polygon => polygon.id !== selectedPolygonId)
    });
    setSelectedPolygonId(null);
    toast.success(t('segmentation.polygonDeleted'));
  };

  
  // Edit mode actions
  const { 
    handleSlicePolygon, 
    handleEditPolygon 
  } = usePolygonEditModeActions(
    setSelectedPolygonId, 
    togglePointAddingMode, 
    toggleSlicingMode
  );

  return {
    // Simplification
    simplifySelectedPolygon,
    
    // Vertex operations
    handleDeleteVertex,
    handleDuplicateVertex,
    
    // Edit mode operations
    handleSlicePolygon,
    handleEditPolygon,
    
    // Polygon operations
    handleDuplicatePolygon,
    handleDeletePolygon,
    
    // Point editor direct methods
    addPointToPolygon,
    removePointFromPolygon
  };
};
