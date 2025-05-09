// Export types
export * from './types';

// Export constants
export * from './constants';

// Export main hook
export { useSegmentationV2 } from './useSegmentationV2';

// Export utility functions
export { 
  getScreenCoordinates, 
  getCanvasCoordinates,
  calculateCenteringTransform
} from './coordinates';

export {
  isPointInPolygon,
  distanceToSegment,
  slicePolygon,
  createPolygon,
  updateSegmentationWithPolygons
} from './geometry';

export {
  fetchImageData,
  fetchSegmentationData,
  createEmptySegmentation,
  saveSegmentationData
} from './api';

export {
  handleMouseDown,
  handleMouseMove,
  handleMouseUp,
  handleWheel,
  handleDeletePolygon
} from './interactions';
