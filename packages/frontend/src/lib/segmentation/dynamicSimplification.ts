/**
 * Funkce pro dynamické zjednodušení kontur na základě úrovně přiblížení
 *
 * Tato funkce zjednodušuje kontury polygonů na základě úrovně přiblížení,
 * aby se zlepšil výkon při vykreslování velkého počtu bodů.
 */

import { Polygon, Point } from '@/types';
import { simplifyPolygon as simplifyPolygonUtil } from '@spheroseg/shared';

/**
 * Zjednodušuje polygon na základě úrovně přiblížení
 *
 * @param polygon Původní polygon
 * @param zoom Aktuální úroveň přiblížení
 * @param minPoints Minimální počet bodů, které budou zachovány
 * @param maxPoints Maximální počet bodů, které budou zachovány
 * @returns Zjednodušený polygon
 */
export const simplifyPolygon = (
  polygon: Polygon,
  zoom: number,
  minPoints: number = 8,
  maxPoints: number = 1000,
): Polygon => {
  const { id, points, type, color } = polygon;

  // Pokud má polygon méně bodů než minPoints, vrátíme ho beze změny
  if (points.length <= minPoints) {
    return polygon;
  }

  // Adaptivní výpočet cílového počtu bodů na základě úrovně přiblížení
  // Používáme exponenciální funkci pro lepší škálování
  // Při nízkém přiblížení (zoom < 1) používáme méně bodů
  // Při vysokém přiblížení (zoom > 2) používáme více bodů
  const zoomFactor = Math.min(5, Math.max(0.2, zoom)); // Omezíme zoom faktor na rozumný rozsah
  const targetPoints = Math.min(
    maxPoints,
    Math.max(minPoints, Math.floor(minPoints + (maxPoints - minPoints) * (1 - Math.exp(-zoomFactor / 2)))),
  );

  // Pokud má polygon méně bodů než targetPoints, vrátíme ho beze změny
  if (points.length <= targetPoints) {
    return polygon;
  }

  // Optimalizace pro různé úrovně přiblížení
  if (zoom < 0.5 && points.length > 100) {
    // Při velmi nízkém přiblížení použijeme přímo rovnoměrné vzorkování
    // pro maximální výkon
    return {
      id,
      points: uniformSample(points, Math.min(50, targetPoints)),
      type,
      color,
    };
  }

  // Zjednodušíme polygon pomocí Ramer-Douglas-Peucker algoritmu
  // Tolerance závisí na úrovni přiblížení - čím větší přiblížení, tím menší tolerance
  const tolerance = Math.max(0.1, 1.0 / Math.max(1, zoom));
  const simplifiedPoints = simplifyPolygonUtil(points, tolerance);

  // Pokud je výsledek příliš zjednodušený, použijeme rovnoměrné vzorkování
  if (simplifiedPoints.length < minPoints) {
    return {
      id,
      points: uniformSample(points, minPoints),
      type,
      color,
    };
  }

  // Pokud je výsledek stále příliš velký, použijeme rovnoměrné vzorkování
  if (simplifiedPoints.length > targetPoints) {
    return {
      id,
      points: uniformSample(simplifiedPoints, targetPoints),
      type,
      color,
    };
  }

  return {
    id,
    points: simplifiedPoints,
    type,
    color,
  };
};

/**
 * Zjednodušuje všechny polygony v poli na základě úrovně přiblížení
 *
 * @param polygons Pole polygonů
 * @param zoom Aktuální úroveň přiblížení
 * @param minPoints Minimální počet bodů, které budou zachovány
 * @param maxPoints Maximální počet bodů, které budou zachovány
 * @returns Pole zjednodušených polygonů
 */
export const simplifyPolygons = (
  polygons: Polygon[],
  zoom: number,
  minPoints: number = 8,
  maxPoints: number = 1000,
): Polygon[] => {
  return polygons.map((polygon) => simplifyPolygon(polygon, zoom, minPoints, maxPoints));
};

/**
 * Rovnoměrně vzorkuje pole bodů na požadovaný počet
 *
 * @param points Pole bodů
 * @param count Požadovaný počet bodů
 * @returns Vzorkované pole bodů
 */
const uniformSample = (points: Point[], count: number): Point[] => {
  if (points.length <= count) {
    return [...points];
  }

  const result: Point[] = [];
  const step = (points.length - 1) / (count - 1);

  // Vždy zahrneme první a poslední bod
  result.push(points[0]);

  // Přidáme rovnoměrně rozložené body mezi nimi
  for (let i = 1; i < count - 1; i++) {
    const index = Math.floor(i * step);
    result.push(points[index]);
  }

  // Přidáme poslední bod
  result.push(points[points.length - 1]);

  return result;
};
