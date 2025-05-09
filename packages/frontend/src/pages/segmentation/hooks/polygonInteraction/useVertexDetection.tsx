import { useCallback } from 'react';
import { Point } from '@/lib/segmentation';
import { screenToImageCoordinates, imageToScreenCoordinates } from './coordinateUtils';

/**
 * Hook pro detekci bodů polygonu
 */
export const useVertexDetection = (
  zoom: number,
  offset: { x: number; y: number }
) => {

  /**
   * Detekuje, zda je bod kurzoru v blízkosti bodu polygonu
   * Přepočítává souřadnice s ohledem na zoom a offset
   */
  const isNearVertex = useCallback((
    screenX: number,
    screenY: number,
    point: Point,
    detectionRadius: number = 10
  ): boolean => {
    const image = screenToImageCoordinates({ x: screenX, y: screenY }, zoom, offset);
    const screen = imageToScreenCoordinates(point, zoom, offset);

    // Výpočet vzdálenosti mezi bodem kurzoru a bodem polygonu v prostoru obrazovky
    const dx = screen.x - screenX;
    const dy = screen.y - screenY;
    const distance = Math.sqrt(dx * dx + dy * dy);

    // Dynamicky upravíme radius detekce podle zoomu - OBRÁCENĚ
    let adjustedRadius;
    if (zoom > 4) {
      // Při extrémním přiblížení zvětšíme radius výrazněji
      adjustedRadius = (detectionRadius * 2) / zoom;
    } else if (zoom > 3) {
      // Při velkém přiblížení zvětšíme radius
      adjustedRadius = (detectionRadius * 1.5) / zoom;
    } else if (zoom < 0.5) {
      // Při velkém oddálení snížíme radius výrazněji
      adjustedRadius = (detectionRadius * 0.6) / zoom;
    } else if (zoom < 0.7) {
      // Při mírném oddálení snížíme radius
      adjustedRadius = (detectionRadius * 0.8) / zoom;
    } else {
      // Standardní radius v normálním zoomu
      adjustedRadius = detectionRadius / zoom;
    }

    const isNear = distance <= adjustedRadius;

    // Logging removed for better performance

    return isNear;
  }, [zoom, offset, screenToImageCoordinates, imageToScreenCoordinates]);

  return { isNearVertex };
};
