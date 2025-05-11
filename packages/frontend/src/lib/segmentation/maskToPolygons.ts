/**
 * Funkce pro převod segmentační masky na polygony
 *
 * Tato funkce používá algoritmus pro detekci kontur v obraze a převádí je na polygony
 * vhodné pro zobrazení v editoru segmentace.
 */

import { v4 as uuidv4 } from 'uuid';
import { CanvasSegmentationData, Polygon } from '@/types';

// Barvy pro jednotlivé polygony
const POLYGON_COLORS = [
  '#FF5733',
  '#33FF57',
  '#3357FF',
  '#F033FF',
  '#FF33F0',
  '#33FFF0',
  '#F0FF33',
  '#FF3333',
  '#33FF33',
  '#3333FF',
];

/**
 * Převede segmentační masku na polygony
 *
 * @param maskUrl URL segmentační masky
 * @param imageWidth Šířka obrázku
 * @param imageHeight Výška obrázku
 * @returns Promise s daty segmentace obsahujícími polygony
 */
export const maskToPolygons = async (
  maskUrl: string,
  imageWidth: number,
  imageHeight: number,
): Promise<CanvasSegmentationData> => {
  return new Promise((resolve, reject) => {
    // Vytvoříme nový obrázek a načteme do něj masku
    const img = new Image();
    img.crossOrigin = 'anonymous';

    img.onload = () => {
      try {
        // Vytvoříme canvas pro zpracování masky
        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;

        const ctx = canvas.getContext('2d');
        if (!ctx) {
          throw new Error('Failed to get canvas context');
        }

        // Vykreslíme masku na canvas
        ctx.drawImage(img, 0, 0);

        // Získáme data pixelů
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const data = imageData.data;

        // Vytvoříme mapu segmentů (každý unikátní pixel barvy = jeden segment)
        const segments = new Map<number, { points: Set<string>; color: string }>();

        // Projdeme všechny pixely a identifikujeme segmenty
        for (let y = 0; y < canvas.height; y++) {
          for (let x = 0; x < canvas.width; x++) {
            const idx = (y * canvas.width + x) * 4;
            const r = data[idx];
            const g = data[idx + 1];
            const b = data[idx + 2];
            const a = data[idx + 3];

            // Přeskočíme černé pixely (pozadí) nebo průhledné pixely
            if ((r === 0 && g === 0 && b === 0) || a === 0) continue;

            // Vytvoříme unikátní ID pro tuto barvu
            // Použijeme všechny tři barevné kanály pro lepší rozlišení segmentů
            const colorId = (r << 16) | (g << 8) | b;

            // Přidáme bod do příslušného segmentu
            if (!segments.has(colorId)) {
              console.log(`Found new segment with color: rgb(${r},${g},${b})`);
              segments.set(colorId, {
                points: new Set<string>(),
                color: POLYGON_COLORS[segments.size % POLYGON_COLORS.length],
              });
            }

            segments.get(colorId)?.points.add(`${x},${y}`);
          }
        }

        // Logujeme počet nalezených segmentů
        console.log(`Found ${segments.size} unique color segments in the mask`);

        console.log(`Found ${segments.size} segments in the mask`);

        // Převedeme segmenty na polygony
        const polygons: Polygon[] = [];

        segments.forEach((segment, colorId) => {
          // Vytvoříme skutečný tvar segmentu pomocí algoritmu pro detekci kontur
          // Nejprve vytvoříme binární masku pro tento segment
          const width = canvas.width;
          const height = canvas.height;
          const segmentMask = new Uint8Array(width * height);

          // Naplníme masku hodnotami 255 pro body segmentu
          segment.points.forEach((pointStr) => {
            const [x, y] = pointStr.split(',').map(Number);
            segmentMask[y * width + x] = 255;
          });

          // Najdeme hranice segmentu pomocí algoritmu sledování kontur
          const boundaryPoints: { x: number; y: number }[] = [];
          const visited = new Set<string>();

          // Funkce pro kontrolu, zda je bod součástí segmentu
          const isSegmentPoint = (x: number, y: number) => {
            if (x < 0 || y < 0 || x >= width || y >= height) return false;
            return segmentMask[y * width + x] === 255;
          };

          // Funkce pro přidání bodu do kontur, pokud ještě nebyl navštíven
          const addBoundaryPoint = (x: number, y: number) => {
            const key = `${x},${y}`;
            if (!visited.has(key)) {
              boundaryPoints.push({ x, y });
              visited.add(key);
            }
          };

          // Najdeme první bod segmentu jako výchozí bod pro sledování kontury
          let startX = -1,
            startY = -1;
          for (let y = 0; y < height && startY === -1; y++) {
            for (let x = 0; x < width && startX === -1; x++) {
              if (isSegmentPoint(x, y)) {
                startX = x;
                startY = y;
                break;
              }
            }
          }

          if (startX !== -1 && startY !== -1) {
            // Směry pro sledování kontury (8 směrů)
            const dx = [1, 1, 0, -1, -1, -1, 0, 1];
            const dy = [0, 1, 1, 1, 0, -1, -1, -1];

            let x = startX;
            let y = startY;
            let dir = 0; // Výchozí směr

            // Sledujeme konturu dokud se nevrátíme do výchozího bodu
            do {
              addBoundaryPoint(x, y);

              // Hledáme další bod kontury
              let found = false;
              let count = 0;
              let newDir = (dir + 6) % 8; // Začínáme hledat vlevo od aktuálního směru

              while (count < 8 && !found) {
                const nx = x + dx[newDir];
                const ny = y + dy[newDir];

                if (isSegmentPoint(nx, ny)) {
                  x = nx;
                  y = ny;
                  dir = newDir;
                  found = true;
                } else {
                  newDir = (newDir + 1) % 8;
                  count++;
                }
              }

              if (!found) break; // Nemůžeme pokračovat v kontuře
            } while (x !== startX || y !== startY);
          }

          // Seřadíme hraniční body ve směru hodinových ručiček
          // Nejprve najdeme těžiště
          const centroid = boundaryPoints.reduce((acc, point) => ({ x: acc.x + point.x, y: acc.y + point.y }), {
            x: 0,
            y: 0,
          });
          centroid.x /= boundaryPoints.length;
          centroid.y /= boundaryPoints.length;

          // Seřadíme body podle úhlu od těžiště
          boundaryPoints.sort((a, b) => {
            const angleA = Math.atan2(a.y - centroid.y, a.x - centroid.x);
            const angleB = Math.atan2(b.y - centroid.y, b.x - centroid.x);
            return angleA - angleB;
          });

          // Logujeme počet bodů pro debugging
          console.log(`Segment ${polygons.length + 1}: ${boundaryPoints.length} points`);

          // Použijeme všechny body bez aproximace
          // Pouze zajistíme, že polygon je uzavřený a má dostatek bodů
          if (boundaryPoints.length >= 3) {
            console.log(`Adding polygon with ${boundaryPoints.length} points`);
            polygons.push({
              id: uuidv4(),
              points: boundaryPoints,
              color: segment.color,
              type: 'external', // Explicitně označíme jako externí polygon
            });
          } else {
            // Pokud nemáme dostatek bodů, vytvoříme obdélník
            let minX = Infinity;
            let minY = Infinity;
            let maxX = -Infinity;
            let maxY = -Infinity;

            segment.points.forEach((pointStr) => {
              const [x, y] = pointStr.split(',').map(Number);
              minX = Math.min(minX, x);
              minY = Math.min(minY, y);
              maxX = Math.max(maxX, x);
              maxY = Math.max(maxY, y);
            });

            // Zajistíme, že obdélník má nějakou velikost
            if (maxX - minX > 5 && maxY - minY > 5) {
              console.log(`Adding rectangular polygon with bounds: (${minX},${minY}) - (${maxX},${maxY})`);
              polygons.push({
                id: uuidv4(),
                points: [
                  { x: minX, y: minY },
                  { x: maxX, y: minY },
                  { x: maxX, y: maxY },
                  { x: minX, y: maxY },
                ],
                color: segment.color,
                type: 'external', // Explicitně označíme jako externí polygon
              });
            } else {
              console.log(`Skipping too small segment with bounds: (${minX},${minY}) - (${maxX},${maxY})`);
            }
          }
        });

        // Pokud nemáme žádné polygony, vrátíme prázdné pole
        if (polygons.length === 0) {
          console.warn('No polygons found in the segmentation mask');
        }

        // Vrátíme data segmentace
        resolve({
          polygons,
          imageWidth,
          imageHeight,
        });
      } catch (error) {
        console.error('Error processing segmentation mask:', error);
        reject(error);
      }
    };

    img.onerror = (error) => {
      console.error('Error loading segmentation mask:', error);
      reject(new Error('Failed to load segmentation mask'));
    };

    // Načteme masku
    img.src = maskUrl;
  });
};
