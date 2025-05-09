
import { useCallback } from 'react';
import { SegmentationResult } from '@/lib/segmentation';
import { toast } from 'sonner';
import { useLanguage } from '@/contexts/LanguageContext';
import { usePointEditor } from '../geometry/usePointEditor';

/**
 * Hook providing polygon simplification functionality
 */
export const usePolygonSimplifyAction = (
  segmentation: SegmentationResult | null,
  setSegmentation: (seg: SegmentationResult | null) => void,
  selectedPolygonId: string | null
) => {
  const { t } = useLanguage();
  // Editor for point operations
  const pointEditor = usePointEditor(segmentation, setSegmentation);

  /**
   * Zjednodušení polygonu
   */
  const simplifySelectedPolygon = useCallback((tolerance: number = 1.0) => {
    if (!selectedPolygonId) {
      toast.error(t('segmentation.selectPolygonFirst'));
      return false;
    }
    
    const success = pointEditor.simplifyPolygon(selectedPolygonId, tolerance);
    
    if (success) {
      toast.success(t('segmentation.polygonSimplified'));
    } else {
      toast.error(t('segmentation.polygonSimplifyFailed'));
    }
    
    return success;
  }, [selectedPolygonId, pointEditor, t]);

  return {
    simplifySelectedPolygon
  };
};
