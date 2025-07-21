import { Point } from '@/lib/segmentation';

/**
 * Creates an SVG path string for a polygon with optional holes
 */
export function createSvgPath(mainPoints: Point[], holePaths: Point[][] = []): string {
  if (!mainPoints || mainPoints.length < 3) return '';
  
  // Create main polygon path
  let path = 'M ' + mainPoints.map(p => `${p.x},${p.y}`).join(' L ') + ' Z';
  
  // Add hole paths
  for (const hole of holePaths) {
    if (hole && hole.length >= 3) {
      path += ' M ' + hole.map(p => `${p.x},${p.y}`).join(' L ') + ' Z';
    }
  }
  
  return path;
}

/**
 * Calculates the fill color for a polygon based on its state
 */
export function getPolygonFillColor(
  type: 'external' | 'internal',
  baseColor: string,
  isSelected: boolean,
  isHovered: boolean
): string {
  if (type === 'internal') {
    return 'rgba(0, 0, 255, 0.1)'; // Blue with low opacity for holes
  }
  
  // Convert hex color to rgba with opacity
  const opacity = isSelected ? 0.3 : isHovered ? 0.2 : 0.1;
  
  // Simple hex to rgba conversion (assumes 6-digit hex)
  if (baseColor.startsWith('#') && baseColor.length === 7) {
    const r = parseInt(baseColor.slice(1, 3), 16);
    const g = parseInt(baseColor.slice(3, 5), 16);
    const b = parseInt(baseColor.slice(5, 7), 16);
    return `rgba(${r}, ${g}, ${b}, ${opacity})`;
  }
  
  // Handle named colors like "red", "blue", etc.
  const namedColors: Record<string, [number, number, number]> = {
    red: [255, 0, 0],
    blue: [0, 0, 255],
    green: [0, 255, 0],
    black: [0, 0, 0],
    white: [255, 255, 255],
  };
  
  if (namedColors[baseColor]) {
    const [r, g, b] = namedColors[baseColor];
    return `rgba(${r}, ${g}, ${b}, ${opacity})`;
  }
  
  // Fallback for other color formats
  return baseColor;
}

/**
 * Calculates the stroke width for a polygon based on its state
 */
export function getPolygonStrokeWidth(isSelected: boolean, baseWidth: number): number {
  return isSelected ? baseWidth * 1.5 : baseWidth;
}

/**
 * Finds holes that are related to a given external polygon
 * This is a placeholder implementation - the actual logic would depend on
 * how holes are associated with their parent polygons
 */
export function findRelatedHoles(
  polygonId: string,
  allPolygons: Array<{ id: string; type: 'external' | 'internal'; points: Point[] }>
): Array<{ id: string; points: Point[] }> {
  // In a real implementation, this would check if internal polygons
  // are contained within the external polygon
  return allPolygons
    .filter(p => p.type === 'internal')
    .map(p => ({ id: p.id, points: p.points }));
}