// Index file for @spheroseg/shared

// Export all polygon utilities
export { 
  distance,
  calculateBoundingBox,
  calculateBoundingBoxRect,
  calculatePolygonArea,
  calculatePolygonPerimeter,
  calculateCentroid,
  isPointInPolygon,
  isPointInPolygonXY,
  getPointSideOfLine,
  perpendicularDistance,
  calculateIntersection,
  calculateLinePolygonIntersections,
  calculateConvexHull,
  isClockwise,
  ensureClockwise,
  ensureCounterClockwise,
  slicePolygon,
  slicePolygonObject,
  simplifyPolygon,
  simplifyClosedPolygon,
  doPolygonsIntersect,
  calculateFeretDiameter,
  calculateMetrics,
  isBoxVisible,
  executePolygonWorkerOperation,
  calculatePolygonAreaAsync,
  calculatePolygonPerimeterAsync,
  calculateBoundingBoxAsync,
  PolygonBoundingBoxCache,
  polygonBoundingBoxCache,
  createPolygon,
  clonePolygon,
  isValidPolygon,
  isPointInPolygonObj,
  calculateLineIntersection,
  getBoundingBox,
  getPolygonArea,
  getPolygonPerimeter,
  distanceToLineSegment
} from './utils/polygonUtils';
export { default as polygonUtils } from './utils/polygonUtils';

// Export monitoring utilities
export * from './monitoring';
