import { Point } from '@/lib/segmentation';

// Fixed values for radius and stroke width
const FIXED_POINT_RADIUS = 4;
const FIXED_STROKE_WIDTH = 1.5;

/**
 * Utility for getting the fixed point radius.
 * Removed zoom dependency.
 */
export const getPointRadius = (): number => {
  // Return fixed value
  return FIXED_POINT_RADIUS;
};

/**
 * Utility for getting the fixed stroke width.
 * Removed zoom dependency.
 */
export const getStrokeWidth = (): number => {
  // Return fixed value
  return FIXED_STROKE_WIDTH;
};

/**
 * Barvy pro různé součásti vizualizace
 */
export const getColors = () => {
  return {
    // Počáteční bod
    startPoint: {
      fill: '#FFA500',      // Oranžová
      stroke: '#FFFFFF',
      innerFill: '#FF8C00', // Tmavší oranžová
      glowColor: 'rgba(255, 165, 0, 0.3)'
    },
    // Potenciální koncový bod
    potentialEndpoint: {
      fill: '#3498db80',    // Modrá s průhledností
      stroke: '#3498db'     // Modrá
    },
    // Bod pod kurzorem
    hoverPoint: {
      fill: '#3498db',      // Sytá modrá
      stroke: '#FFFFFF',    // Bílý okraj
      glowColor: 'rgba(52, 152, 219, 0.3)'
    },
    // Dočasný bod
    tempPoint: {
      fill: '#3498db',      // Modrá
      stroke: '#FFFFFF'     // Bílý okraj
    },
    // Linka mezi body
    line: {
      color: '#3498db',     // Modrá
      hoveredColor: '#4CAF50' // Zelená pro najeté
    }
  };
};

/**
 * Vytvoří SVG path pro spojnici bodů
 */
export const createPathFromPoints = (points: Point[]): string => {
  if (points.length === 0) return '';
  
  return `M ${points[0].x} ${points[0].y} ` + 
    points.slice(1).map(point => `L ${point.x} ${point.y}`).join(' ');
};
