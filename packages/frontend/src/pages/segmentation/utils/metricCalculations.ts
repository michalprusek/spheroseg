import polygonUtils from '@spheroseg/shared/utils/polygonUtils';
import logger from '@/utils/logger';

/**
 * Interface for polygon metrics
 * @deprecated Use polygonUtils.PolygonMetrics instead
 */
export interface PolygonMetrics {
  Area: number;
  Perimeter: number;
  EquivalentDiameter: number;
  Circularity: number;
  FeretDiameterMax: number;
  FeretDiameterMaxOrthogonalDistance: number;
  FeretDiameterMin: number;
  FeretAspectRatio: number;
  LengthMajorDiameterThroughCentroid: number;
  LengthMinorDiameterThroughCentroid: number;
  Compactness: number;
  Convexity: number;
  Solidity: number;
  Sphericity: number;
}

// Convert polygon points to contour format for calculations
const pointsToContour = (points: Array<{ x: number; y: number }>): number[][] => {
  return points.map((p) => [p.x, p.y]);
};

// Calculate area from contour
const calculateAreaFromContour = (contour: number[][]): number => {
  // Implementation of cv2.contourArea
  let area = 0;
  const n = contour.length;

  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    area += contour[i][0] * contour[j][1];
    area -= contour[j][0] * contour[i][1];
  }

  return Math.abs(area) / 2;
};

// Calculate perimeter from contour
const calculatePerimeterFromContour = (contour: number[][]): number => {
  // Implementation of cv2.arcLength
  let perimeter = 0;
  const n = contour.length;

  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    const dx = contour[j][0] - contour[i][0];
    const dy = contour[j][1] - contour[i][1];
    perimeter += Math.sqrt(dx * dx + dy * dy);
  }

  return perimeter;
};

// Calculate equivalent diameter from contour
const calculateEquivalentDiameterFromContour = (contour: number[][]): number => {
  const area = calculateAreaFromContour(contour);
  return Math.sqrt((4 * area) / Math.PI);
};

// Calculate convex hull of a contour
const calculateConvexHull = (contour: number[][]): number[][] => {
  // Simple implementation of convex hull using Graham scan
  if (contour.length <= 3) return contour;

  // Find the point with the lowest y-coordinate
  let lowestPoint = contour[0];
  let lowestIndex = 0;
  for (let i = 1; i < contour.length; i++) {
    if (contour[i][1] < lowestPoint[1] || (contour[i][1] === lowestPoint[1] && contour[i][0] < lowestPoint[0])) {
      lowestPoint = contour[i];
      lowestIndex = i;
    }
  }

  // Sort points by polar angle with respect to the lowest point
  const sortedPoints = [...contour];
  const pivot = sortedPoints.splice(lowestIndex, 1)[0];
  sortedPoints.sort((a, b) => {
    const angleA = Math.atan2(a[1] - pivot[1], a[0] - pivot[0]);
    const angleB = Math.atan2(b[1] - pivot[1], b[0] - pivot[0]);
    return angleA - angleB;
  });
  sortedPoints.unshift(pivot);

  // Graham scan
  const hull = [sortedPoints[0], sortedPoints[1]];
  for (let i = 2; i < sortedPoints.length; i++) {
    while (hull.length > 1) {
      const a = hull[hull.length - 2];
      const b = hull[hull.length - 1];
      const c = sortedPoints[i];

      // Check if the turn is counterclockwise
      const crossProduct = (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
      if (crossProduct > 0) break;
      hull.pop();
    }
    hull.push(sortedPoints[i]);
  }

  return hull;
};

// Calculate convex perimeter from contour
const calculateConvexPerimeterFromContour = (contour: number[][]): number => {
  const convexHull = calculateConvexHull(contour);
  return calculatePerimeterFromContour(convexHull);
};

// Calculate circularity from contour
const calculateCircularityFromContour = (contour: number[][]): number => {
  const area = calculateAreaFromContour(contour);
  const convexPerimeter = calculateConvexPerimeterFromContour(contour);
  return convexPerimeter ? (4 * Math.PI * area) / convexPerimeter ** 2 : 0;
};

// Calculate compactness from contour
const calculateCompactnessFromContour = (contour: number[][]): number => {
  const area = calculateAreaFromContour(contour);
  const perimeter = calculatePerimeterFromContour(contour);
  return perimeter ? (4 * Math.PI * area) / perimeter ** 2 : 0;
};

// Calculate convexity from contour
const calculateConvexityFromContour = (contour: number[][]): number => {
  const convexHull = calculateConvexHull(contour);
  const hullPerimeter = calculatePerimeterFromContour(convexHull);
  const contourPerimeter = calculatePerimeterFromContour(contour);
  return contourPerimeter ? hullPerimeter / contourPerimeter : 0;
};

// Calculate solidity from contour
const calculateSolidityFromContour = (contour: number[][]): number => {
  const area = calculateAreaFromContour(contour);
  const convexHull = calculateConvexHull(contour);
  const hullArea = calculateAreaFromContour(convexHull);
  return hullArea ? area / hullArea : 0;
};

// Calculate sphericity from contour
const calculateSphericityFromContour = (contour: number[][]): number => {
  const area = calculateAreaFromContour(contour);
  const perimeter = calculatePerimeterFromContour(contour);
  return perimeter ? (Math.PI * Math.sqrt((4 * area) / Math.PI)) / perimeter : 0;
};

// Calculate minimum area rectangle
const calculateMinAreaRect = (contour: number[][]): { center: number[]; size: number[]; angle: number } => {
  // Find the convex hull
  const hull = calculateConvexHull(contour);

  // Find the minimum area rectangle
  let minArea = Number.MAX_VALUE;
  let minRect = { center: [0, 0], size: [0, 0], angle: 0 };

  // Try all possible edge orientations
  for (let i = 0; i < hull.length; i++) {
    const p1 = hull[i];
    const p2 = hull[(i + 1) % hull.length];

    // Calculate the edge direction
    const dx = p2[0] - p1[0];
    const dy = p2[1] - p1[1];
    const edgeLength = Math.sqrt(dx * dx + dy * dy);

    if (edgeLength === 0) continue;

    // Normalize the direction
    const nx = dx / edgeLength;
    const ny = dy / edgeLength;

    // Calculate the perpendicular direction
    const px = -ny;
    const py = nx;

    // Find the extreme points along these directions
    let minProj1 = Number.MAX_VALUE;
    let maxProj1 = Number.MIN_VALUE;
    let minProj2 = Number.MAX_VALUE;
    let maxProj2 = Number.MIN_VALUE;

    for (const point of hull) {
      const proj1 = point[0] * nx + point[1] * ny;
      const proj2 = point[0] * px + point[1] * py;

      minProj1 = Math.min(minProj1, proj1);
      maxProj1 = Math.max(maxProj1, proj1);
      minProj2 = Math.min(minProj2, proj2);
      maxProj2 = Math.max(maxProj2, proj2);
    }

    // Calculate the rectangle dimensions
    const width = maxProj1 - minProj1;
    const height = maxProj2 - minProj2;
    const area = width * height;

    if (area < minArea) {
      minArea = area;

      // Calculate the center of the rectangle
      const centerProj1 = (minProj1 + maxProj1) / 2;
      const centerProj2 = (minProj2 + maxProj2) / 2;
      const centerX = centerProj1 * nx + centerProj2 * px;
      const centerY = centerProj1 * ny + centerProj2 * py;

      // Calculate the angle of the rectangle
      const angle = (Math.atan2(ny, nx) * 180) / Math.PI;

      minRect = {
        center: [centerX, centerY],
        size: [width, height],
        angle: angle,
      };
    }
  }

  return minRect;
};

// Calculate Feret properties from contour
const calculateFeretPropertiesFromContour = (contour: number[][]): { max: number; min: number; ratio: number } => {
  if (contour.length < 3) {
    return { max: 0, min: 0, ratio: 0 };
  }

  const rect = calculateMinAreaRect(contour);
  const width = rect.size[0];
  const height = rect.size[1];

  const feretDiameterMax = Math.max(width, height);
  const feretDiameterMin = Math.min(width, height);
  const feretAspectRatio = feretDiameterMin ? feretDiameterMax / feretDiameterMin : 0;

  return {
    max: feretDiameterMax,
    min: feretDiameterMin,
    ratio: feretAspectRatio,
  };
};

// Calculate orthogonal diameter
const calculateOrthogonalDiameter = (contour: number[][]): number => {
  if (contour.length < 3) {
    return 0;
  }

  const rect = calculateMinAreaRect(contour);
  return Math.min(rect.size[0], rect.size[1]);
};

// Calculate diameters through centroid
const calculateDiametersFromContour = (contour: number[][]): { major: number; minor: number } => {
  if (contour.length < 3) {
    return { major: 0, minor: 0 };
  }

  // Calculate centroid
  let sumX = 0;
  let sumY = 0;
  for (const point of contour) {
    sumX += point[0];
    sumY += point[1];
  }
  const centroidX = sumX / contour.length;
  const centroidY = sumY / contour.length;

  // Calculate covariance matrix
  let sumXX = 0;
  let sumYY = 0;
  let sumXY = 0;
  for (const point of contour) {
    const dx = point[0] - centroidX;
    const dy = point[1] - centroidY;
    sumXX += dx * dx;
    sumYY += dy * dy;
    sumXY += dx * dy;
  }

  // Calculate eigenvalues
  const avgXX = sumXX / contour.length;
  const avgYY = sumYY / contour.length;
  const avgXY = sumXY / contour.length;

  const trace = avgXX + avgYY;
  const det = avgXX * avgYY - avgXY * avgXY;

  const lambda1 = (trace + Math.sqrt(trace * trace - 4 * det)) / 2;
  const lambda2 = (trace - Math.sqrt(trace * trace - 4 * det)) / 2;

  // Major and minor axis lengths
  const majorAxisLength = 2 * Math.sqrt(lambda1);
  const minorAxisLength = 2 * Math.sqrt(lambda2);

  return {
    major: majorAxisLength,
    minor: minorAxisLength,
  };
};

/**
 * Calculate all metrics for a contour
 * @deprecated Use polygonUtils.calculateMetrics instead
 */
export const calculateMetrics = (
  polygon: { points: Array<{ x: number; y: number }> },
  holes: Array<{ points: Array<{ x: number; y: number }> }> = [],
): PolygonMetrics => {
  try {
    // Use the centralized polygon utilities
    const metrics = polygonUtils.calculateMetrics(
      { id: 'temp', points: polygon.points, type: 'external' },
      holes.map((hole) => ({
        id: 'temp-hole',
        points: hole.points,
        type: 'internal',
      })),
    );

    // Convert to the legacy format
    return {
      Area: metrics.area,
      Perimeter: metrics.perimeter,
      EquivalentDiameter: metrics.equivalentDiameter,
      Circularity: metrics.circularity,
      FeretDiameterMax: metrics.feretDiameter.max,
      FeretDiameterMaxOrthogonalDistance: metrics.feretDiameter.min, // Approximation
      FeretDiameterMin: metrics.feretDiameter.min,
      FeretAspectRatio: metrics.feretDiameter.max / metrics.feretDiameter.min || 1,
      LengthMajorDiameterThroughCentroid: metrics.feretDiameter.max, // Approximation
      LengthMinorDiameterThroughCentroid: metrics.feretDiameter.min, // Approximation
      Compactness: metrics.compactness,
      Convexity: metrics.convexity,
      Solidity: metrics.solidity,
      Sphericity: metrics.sphericity,
    };
  } catch (error) {
    logger.error('Error calculating metrics:', { error });

    // Return default values in case of error
    return {
      Area: 0,
      Perimeter: 0,
      EquivalentDiameter: 0,
      Circularity: 0,
      FeretDiameterMax: 0,
      FeretDiameterMaxOrthogonalDistance: 0,
      FeretDiameterMin: 0,
      FeretAspectRatio: 0,
      LengthMajorDiameterThroughCentroid: 0,
      LengthMinorDiameterThroughCentroid: 0,
      Compactness: 0,
      Convexity: 0,
      Solidity: 0,
      Sphericity: 0,
    };
  }
};

// Format number for display
export const formatNumber = (value: number): string => {
  return value.toFixed(4);
};
