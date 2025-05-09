/**
 * Funkce pro dynamické zjednodušení kontur na základě úrovně přiblížení
 *
 * Tato funkce zjednodušuje kontury polygonů na základě úrovně přiblížení,
 * aby se zlepšil výkon při vykreslování velkého počtu bodů.
 */

import { Polygon, Point } from '@/types';

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
  maxPoints: number = 1000
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
    Math.max(
      minPoints,
      Math.floor(minPoints + (maxPoints - minPoints) * (1 - Math.exp(-zoomFactor / 2)))
    )
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
      color
    };
  }

  // Zjednodušíme polygon pomocí Ramer-Douglas-Peucker algoritmu
  // Tolerance závisí na úrovni přiblížení - čím větší přiblížení, tím menší tolerance
  const tolerance = Math.max(0.1, 1.0 / Math.max(1, zoom));
  const simplifiedPoints = rdpSimplify(points, tolerance);

  // Pokud je výsledek příliš zjednodušený, použijeme rovnoměrné vzorkování
  if (simplifiedPoints.length < minPoints) {
    return {
      id,
      points: uniformSample(points, minPoints),
      type,
      color
    };
  }

  // Pokud je výsledek stále příliš velký, použijeme rovnoměrné vzorkování
  if (simplifiedPoints.length > targetPoints) {
    return {
      id,
      points: uniformSample(simplifiedPoints, targetPoints),
      type,
      color
    };
  }

  return {
    id,
    points: simplifiedPoints,
    type,
    color
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
  maxPoints: number = 1000
): Polygon[] => {
  return polygons.map(polygon => simplifyPolygon(polygon, zoom, minPoints, maxPoints));
};

/**
 * Implementace Ramer-Douglas-Peucker algoritmu pro zjednodušení křivky
 *
 * @param points Pole bodů
 * @param epsilon Tolerance (menší hodnota = více bodů)
 * @returns Zjednodušené pole bodů
 */
const rdpSimplify = (points: Point[], epsilon: number): Point[] => {
  if (points.length <= 2) {
    return [...points];
  }

  // Najdeme bod s největší vzdáleností od přímky mezi prvním a posledním bodem
  let maxDistance = 0;
  let maxIndex = 0;

  const firstPoint = points[0];
  const lastPoint = points[points.length - 1];

  for (let i = 1; i < points.length - 1; i++) {
    const distance = perpendicularDistance(points[i], firstPoint, lastPoint);

    if (distance > maxDistance) {
      maxDistance = distance;
      maxIndex = i;
    }
  }

  // Pokud je maximální vzdálenost větší než epsilon, rekurzivně zjednodušíme obě části
  if (maxDistance > epsilon) {
    const firstPart = rdpSimplify(points.slice(0, maxIndex + 1), epsilon);
    const secondPart = rdpSimplify(points.slice(maxIndex), epsilon);

    // Spojíme obě části (bez duplikace bodu v maxIndex)
    return [...firstPart.slice(0, -1), ...secondPart];
  } else {
    // Pokud je maximální vzdálenost menší než epsilon, vrátíme pouze první a poslední bod
    return [firstPoint, lastPoint];
  }
};

/**
 * Vypočítá kolmou vzdálenost bodu od přímky definované dvěma body
 *
 * @param point Bod, jehož vzdálenost počítáme
 * @param lineStart První bod přímky
 * @param lineEnd Druhý bod přímky
 * @returns Kolmá vzdálenost bodu od přímky
 */
const perpendicularDistance = (point: Point, lineStart: Point, lineEnd: Point): number => {
  const dx = lineEnd.x - lineStart.x;
  const dy = lineEnd.y - lineStart.y;

  // Pokud jsou body přímky shodné, vrátíme vzdálenost od bodu
  if (dx === 0 && dy === 0) {
    return Math.sqrt(
      Math.pow(point.x - lineStart.x, 2) + Math.pow(point.y - lineStart.y, 2)
    );
  }

  // Normalizovaná délka přímky
  const norm = Math.sqrt(dx * dx + dy * dy);

  // Kolmá vzdálenost bodu od přímky
  return Math.abs(
    (dy * point.x - dx * point.y + lineEnd.x * lineStart.y - lineEnd.y * lineStart.x) / norm
  );
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
