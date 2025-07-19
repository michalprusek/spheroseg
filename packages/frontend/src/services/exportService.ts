/**
 * Služba pro export dat
 *
 * Tato služba poskytuje funkce pro export dat v různých formátech:
 * - Export metrik do Excel (XLSX)
 * - Export metrik do CSV
 * - Export segmentací do COCO formátu
 * - Export segmentací do YOLO formátu
 * - Export všech dat do ZIP archivu
 * - Generování vizualizací segmentací
 */

import { utils, writeFile } from 'xlsx';
import JSZip from 'jszip';
import { saveAs } from 'file-saver';
import { toast } from 'sonner';
import { createLogger } from '@/lib/logger';
import { formatISODate } from '@/utils/dateUtils';
import { format } from 'date-fns';
import apiClient from '@/services/api/client';
import { calculateMetrics } from '@/pages/segmentation/utils/metricCalculations';
import type { ProjectImage, Polygon, SegmentationResult } from '@/pages/segmentation/types';

// Vytvoření loggeru
const logger = createLogger('exportService');

// Typy exportu
export enum ExportFormat {
  EXCEL = 'EXCEL',
  CSV = 'CSV',
  COCO = 'COCO',
  YOLO = 'YOLO',
  ZIP = 'ZIP',
}

// Možnosti exportu
export interface ExportOptions {
  includeMetadata?: boolean;
  includeObjectMetrics?: boolean;
  includeSegmentation?: boolean;
  includeImages?: boolean;
  annotationFormat?: 'COCO' | 'YOLO' | 'POLYGONS';
  metricsFormat?: 'EXCEL' | 'CSV';
  generateVisualizations?: boolean;
  includeRawData?: boolean;
}

/**
 * Exportuje metriky do Excel souboru
 */
export async function exportMetricsAsXlsx(images: ProjectImage[], projectTitle: string = 'project'): Promise<void> {
  try {
    logger.info(`Exportování metrik pro ${images.length} obrázků do Excel`);

    // Příprava dat pro export
    const worksheetRows = await prepareMetricsData(images);

    // Vytvoření pracovního sešitu
    const workbook = utils.book_new();
    const worksheet = utils.json_to_sheet(worksheetRows);

    // Nastavení šířky sloupců
    const colWidths = [
      { wch: 20 }, // Image Name
      { wch: 36 }, // Image ID
      { wch: 16 }, // Image Resolution
      { wch: 10 }, // Object ID
      { wch: 12 }, // Area
      { wch: 15 }, // Perimeter
      { wch: 12 }, // Circularity
      { wch: 22 }, // Equivalent Diameter
      { wch: 12 }, // Aspect Ratio
      { wch: 12 }, // Compactness
      { wch: 12 }, // Convexity
      { wch: 12 }, // Solidity
      { wch: 12 }, // Sphericity
      { wch: 20 }, // Feret Diameter Max
      { wch: 20 }, // Feret Diameter Min
      { wch: 20 }, // Created At
    ];

    worksheet['!cols'] = colWidths;

    // Přidání listu do sešitu
    utils.book_append_sheet(workbook, worksheet, 'Object Metrics');

    // Stažení souboru
    const filename = `${projectTitle || 'project'}_metrics_${formatISODate(new Date())}.xlsx`;
    writeFile(workbook, filename);

    logger.info(`Metriky úspěšně exportovány do souboru ${filename}`);
    toast.success(`Metriky úspěšně exportovány do souboru ${filename}`);
  } catch (error) {
    logger.error('Chyba při exportu metrik do Excel:', error);
    toast.error(`Export selhal: ${error instanceof Error ? error.message : 'Neznámá chyba'}`);
  }
}

/**
 * Exportuje metriky do CSV souboru
 */
export async function exportMetricsAsCsv(images: ProjectImage[], projectTitle: string = 'project'): Promise<void> {
  try {
    logger.info(`Exportování metrik pro ${images.length} obrázků do CSV`);

    // Příprava dat pro export
    const worksheetRows = await prepareMetricsData(images);

    // Vytvoření CSV obsahu
    const headers = Object.keys(worksheetRows[0] || {});
    let csvContent = headers.join(',') + '\n';

    // Přidání řádků
    worksheetRows.forEach((row) => {
      const rowValues = headers.map((header) => {
        // Escapování čárek a uvozovek v hodnotách
        const value = String(row[header] || '').replace(/"/g, '""');
        return `"${value}"`;
      });
      csvContent += rowValues.join(',') + '\n';
    });

    // Vytvoření a stažení souboru
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const filename = `${projectTitle || 'project'}_metrics_${format(new Date(), 'yyyy-MM-dd')}.csv`;
    saveAs(blob, filename);

    logger.info(`Metriky úspěšně exportovány do souboru ${filename}`);
    toast.success(`Metriky úspěšně exportovány do souboru ${filename}`);
  } catch (error) {
    logger.error('Chyba při exportu metrik do CSV:', error);
    toast.error(`Export selhal: ${error instanceof Error ? error.message : 'Neznámá chyba'}`);
  }
}

/**
 * Exportuje segmentace do COCO formátu
 */
export async function exportSegmentationsAsCoco(
  images: ProjectImage[],
  projectTitle: string = 'project',
): Promise<void> {
  try {
    logger.info(`Exportování segmentací pro ${images.length} obrázků do COCO formátu`);

    // Konverze do COCO formátu
    const cocoData = convertToCOCO(images, projectTitle);

    // Vytvoření a stažení souboru
    const blob = new Blob([JSON.stringify(cocoData, null, 2)], {
      type: 'application/json',
    });
    const filename = `${projectTitle || 'project'}_coco_${format(new Date(), 'yyyy-MM-dd')}.json`;
    saveAs(blob, filename);

    logger.info(`Segmentace úspěšně exportovány do souboru ${filename}`);
    toast.success(`Segmentace úspěšně exportovány do souboru ${filename}`);
  } catch (error) {
    logger.error('Chyba při exportu segmentací do COCO formátu:', error);
    toast.error(`Export selhal: ${error instanceof Error ? error.message : 'Neznámá chyba'}`);
  }
}

/**
 * Exportuje segmentace do YOLO formátu
 */
export async function exportSegmentationsAsYolo(
  images: ProjectImage[],
  projectTitle: string = 'project',
): Promise<void> {
  try {
    logger.info(`Exportování segmentací pro ${images.length} obrázků do YOLO formátu`);

    // Konverze do YOLO formátu a vytvoření ZIP archivu
    const zip = new JSZip();

    // Přidání README souboru
    zip.file(
      'README.txt',
      `YOLO format export for project: ${projectTitle}
Generated: ${new Date().toISOString()}

This archive contains YOLO format annotations for ${images.length} images.
Each image has a corresponding .txt file with the same name.

Format:
<class_id> <x1> <y1> <x2> <y2> ... <xn> <yn>

Where:
- class_id: 0 for spheroid/cell
- x, y: normalized coordinates (0-1) of polygon vertices
`,
    );

    // Přidání souborů s anotacemi
    for (const image of images) {
      try {
        // Získání segmentačních dat
        const segData = await getSegmentationData(image);

        if (!segData || !segData.polygons || segData.polygons.length === 0) {
          continue;
        }

        // Konverze do YOLO formátu
        const yoloData = convertToYOLO(segData, image.width || 800, image.height || 600);

        // Přidání souboru do ZIP
        const filename = `${image.name.split('.')[0]}.txt`;
        zip.file(filename, yoloData);
      } catch (error) {
        logger.error(`Chyba při zpracování obrázku ${image.id}:`, error);
      }
    }

    // Generování a stažení ZIP souboru
    const content = await zip.generateAsync({ type: 'blob' });
    const filename = `${projectTitle || 'project'}_yolo_${format(new Date(), 'yyyy-MM-dd')}.zip`;
    saveAs(content, filename);

    logger.info(`Segmentace úspěšně exportovány do souboru ${filename}`);
    toast.success(`Segmentace úspěšně exportovány do souboru ${filename}`);
  } catch (error) {
    logger.error('Chyba při exportu segmentací do YOLO formátu:', error);
    toast.error(`Export selhal: ${error instanceof Error ? error.message : 'Neznámá chyba'}`);
  }
}

/**
 * Exportuje všechna data do ZIP archivu
 */
export async function exportAllDataAsZip(
  images: ProjectImage[],
  projectTitle: string = 'project',
  options: ExportOptions = {},
): Promise<void> {
  try {
    logger.info(`Exportování všech dat pro ${images.length} obrázků do ZIP archivu`);

    // Vytvoření ZIP archivu
    const zip = new JSZip();

    // Přidání README souboru
    zip.file(
      'README.txt',
      `Export for project: ${projectTitle}
Generated: ${new Date().toISOString()}

This archive contains:
${options.includeMetadata ? '- Metadata for all images\n' : ''}${options.includeObjectMetrics ? '- Object metrics in CSV and HTML format\n' : ''}${options.includeSegmentation ? `- Segmentation data in ${options.annotationFormat || 'POLYGONS'} format\n` : ''}${options.includeImages ? '- Original images\n' : ''}${options.generateVisualizations ? '- Visualizations of segmentations\n' : ''}
`,
    );

    // Přidání metadat
    if (options.includeMetadata) {
      const metadata = images.map((img) => ({
        id: img.id,
        name: img.name,
        url: img.url,
        createdAt: typeof img.createdAt === 'string' ? img.createdAt : img.createdAt?.toISOString(),
        updatedAt: typeof img.updatedAt === 'string' ? img.updatedAt : img.updatedAt?.toISOString(),
        status: img.segmentationStatus,
        width: img.width,
        height: img.height,
      }));

      zip.file('metadata.json', JSON.stringify(metadata, null, 2));
    }

    // Přidání metrik
    if (options.includeObjectMetrics) {
      const metricsFolder = zip.folder('metrics');

      // Příprava dat pro export
      const worksheetRows = await prepareMetricsData(images);

      // Přidání CSV souboru
      const headers = Object.keys(worksheetRows[0] || {});
      let csvContent = headers.join(',') + '\n';

      worksheetRows.forEach((row) => {
        const rowValues = headers.map((header) => {
          const value = String(row[header] || '').replace(/"/g, '""');
          return `"${value}"`;
        });
        csvContent += rowValues.join(',') + '\n';
      });

      metricsFolder.file(`${projectTitle || 'project'}_metrics.csv`, csvContent);

      // Přidání HTML souboru pro lepší zobrazení
      const htmlContent = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>${projectTitle} - Metrics</title>
  <style>
    body { font-family: Arial, sans-serif; margin: 20px; }
    table { border-collapse: collapse; width: 100%; }
    th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
    th { background-color: #f2f2f2; }
    tr:nth-child(even) { background-color: #f9f9f9; }
  </style>
</head>
<body>
  <h1>${projectTitle} - Object Metrics</h1>
  <div style="overflow-x: auto;">
    <table>
      <thead>
        <tr>
          ${headers.map((header) => `<th>${header}</th>`).join('')}
        </tr>
      </thead>
      <tbody>
        ${worksheetRows
          .map(
            (row) => `
          <tr>
            ${headers.map((header) => `<td>${row[header] || ''}</td>`).join('')}
          </tr>
        `,
          )
          .join('')}
      </tbody>
    </table>
  </div>
</body>
</html>
`;

      metricsFolder.file(`${projectTitle || 'project'}_metrics.html`, htmlContent);

      // Vytvoření vizualizací
      if (options.generateVisualizations) {
        const visualizationsFolder = metricsFolder.folder('visualizations');

        // Generování vizualizací bude implementováno později
        // Vyžaduje Canvas API pro vykreslení obrázků a segmentací
      }
    }

    // Přidání segmentačních dat
    if (options.includeSegmentation) {
      const segmentationFolder = zip.folder('segmentations');

      // Přidání segmentačních dat podle zvoleného formátu
      if (options.annotationFormat === 'COCO') {
        // Export do COCO formátu
        const cocoData = convertToCOCO(images, projectTitle);
        segmentationFolder.file(`${projectTitle || 'project'}_coco.json`, JSON.stringify(cocoData, null, 2));
      } else if (options.annotationFormat === 'YOLO') {
        // Export do YOLO formátu
        for (const image of images) {
          try {
            const segData = await getSegmentationData(image);

            if (!segData || !segData.polygons || segData.polygons.length === 0) {
              continue;
            }

            const yoloData = convertToYOLO(segData, image.width || 800, image.height || 600);
            const filename = `${image.name.split('.')[0]}.txt`;
            segmentationFolder.file(filename, yoloData);
          } catch (error) {
            logger.error(`Chyba při zpracování obrázku ${image.id}:`, error);
          }
        }
      } else {
        // Export do formátu POLYGONS (JSON)
        for (const image of images) {
          try {
            const segData = await getSegmentationData(image);

            if (!segData || !segData.polygons || segData.polygons.length === 0) {
              continue;
            }

            const filename = `${image.name.split('.')[0]}.json`;
            segmentationFolder.file(filename, JSON.stringify(segData, null, 2));
          } catch (error) {
            logger.error(`Chyba při zpracování obrázku ${image.id}:`, error);
          }
        }
      }
    }

    // Přidání originálních obrázků
    if (options.includeImages) {
      const imagesFolder = zip.folder('images');

      // Stažení a přidání obrázků
      for (const image of images) {
        try {
          if (!image.url) continue;

          // Stažení obrázku
          const response = await fetch(image.url);
          const blob = await response.blob();

          // Přidání do ZIP
          imagesFolder.file(image.name, blob);
        } catch (error) {
          logger.error(`Chyba při stahování obrázku ${image.id}:`, error);
        }
      }
    }

    // Generování a stažení ZIP souboru
    const content = await zip.generateAsync({ type: 'blob' });
    const filename = `${projectTitle || 'project'}_export_${format(new Date(), 'yyyy-MM-dd')}.zip`;
    saveAs(content, filename);

    logger.info(`Data úspěšně exportována do souboru ${filename}`);
    toast.success(`Data úspěšně exportována do souboru ${filename}`);
  } catch (error) {
    logger.error('Chyba při exportu dat do ZIP archivu:', error);
    toast.error(`Export selhal: ${error instanceof Error ? error.message : 'Neznámá chyba'}`);
  }
}

/**
 * Připraví data metrik pro export
 */
async function prepareMetricsData(images: ProjectImage[]): Promise<Record<string, unknown>[]> {
  const worksheetRows: Record<string, unknown>[] = [];

  for (const image of images) {
    try {
      // Získání segmentačních dat
      const segData = await getSegmentationData(image);

      if (!segData || !segData.polygons || segData.polygons.length === 0) {
        continue;
      }

      // Získání pouze externích polygonů
      const externalPolygons = segData.polygons.filter((polygon) => polygon.type === 'external');

      // Výpočet metrik pro každý externí polygon
      externalPolygons.forEach((polygon, index) => {
        // Nalezení interních polygonů (děr) souvisejících s tímto externím polygonem
        const holes = segData.polygons.filter((p) => p.type === 'internal');

        // Výpočet metrik s uvažováním děr
        const metrics = calculateMetrics(polygon, holes);

        // Přidání řádku do výsledku
        worksheetRows.push({
          'Image Name': image.name || 'Unknown',
          'Image ID': image.id || '',
          'Image Resolution': `${image.width || 0}x${image.height || 0}`,
          'Object ID': index + 1,
          Area: metrics.area,
          Perimeter: metrics.perimeter,
          Circularity: metrics.circularity,
          'Equivalent Diameter': metrics.equivalentDiameter,
          'Aspect Ratio': metrics.aspectRatio,
          Compactness: metrics.compactness,
          Convexity: metrics.convexity,
          Solidity: metrics.solidity,
          Sphericity: metrics.sphericity,
          'Feret Diameter Max': metrics.feretDiameterMax,
          'Feret Diameter Min': metrics.feretDiameterMin,
          'Created At': image.createdAt ? new Date(image.createdAt).toISOString() : '',
        });
      });
    } catch (error) {
      logger.error(`Chyba při zpracování metrik pro obrázek ${image.id}:`, error);
    }
  }

  return worksheetRows;
}

/**
 * Získá segmentační data pro obrázek
 */
async function getSegmentationData(image: ProjectImage): Promise<SegmentationResult | null> {
  // Pokud již máme segmentační data, použijeme je
  if (image.segmentationResult) {
    return image.segmentationResult;
  }

  // Pokud máme segmentační data v jiném formátu
  if (image.segmentationData) {
    return image.segmentationData;
  }

  // Pokud nemáme segmentační data, zkusíme je získat z API
  try {
    const response = await apiClient.get(`/api/images/${image.id}/segmentation`);
    return response.data;
  } catch (error) {
    logger.error(`Chyba při získávání segmentačních dat pro obrázek ${image.id}:`, error);
    return null;
  }
}

/**
 * Konvertuje segmentace do COCO formátu
 */
function convertToCOCO(images: ProjectImage[], projectTitle: string = 'project'): {
  info: {
    description: string;
    url: string;
    version: string;
    year: number;
    contributor: string;
    date_created: string;
  };
  licenses: Array<{ id: number; name: string; url: string }>;
  images: Array<{
    id: number;
    file_name: string;
    width: number;
    height: number;
    date_captured: string;
  }>;
  annotations: Array<{
    id: number;
    image_id: number;
    category_id: number;
    segmentation: number[][];
    area: number;
    bbox: [number, number, number, number];
    iscrowd: number;
  }>;
  categories: Array<{ id: number; name: string; supercategory: string }>;
} {
  // Používáme dvě kategorie: "cell" pro externí polygony a "hole" pro interní polygony (díry)
  const categories = [
    { id: 1, name: 'cell', supercategory: 'cell' },
    { id: 2, name: 'hole', supercategory: 'cell' },
  ];
  const annotations: Array<{
    id: number;
    image_id: number;
    category_id: number;
    segmentation: number[][];
    area: number;
    bbox: [number, number, number, number];
    iscrowd: number;
  }> = [];
  const cocoImages: Array<{
    id: number;
    file_name: string;
    width: number;
    height: number;
    date_captured: string;
  }> = [];

  let annotationId = 1;

  images.forEach((image, imageIndex) => {
    // Přidání obrázku do COCO formátu
    cocoImages.push({
      id: imageIndex + 1,
      file_name: image.name,
      width: image.width || 800,
      height: image.height || 600,
      date_captured: image.createdAt ? new Date(image.createdAt).toISOString() : new Date().toISOString(),
    });

    // Extrakce polygonů
    const segData = image.segmentationResult || image.segmentationData;

    if (!segData || !segData.polygons || segData.polygons.length === 0) {
      return;
    }

    // Zpracování polygonů
    segData.polygons.forEach((polygon: Polygon) => {
      // Převod bodů na COCO formát
      const segmentation = [polygon.points.flat()];

      // Výpočet bounding boxu
      const xs = polygon.points.map((p) => p[0]);
      const ys = polygon.points.map((p) => p[1]);
      const minX = Math.min(...xs);
      const minY = Math.min(...ys);
      const width = Math.max(...xs) - minX;
      const height = Math.max(...ys) - minY;

      // Přidání anotace
      annotations.push({
        id: annotationId++,
        image_id: imageIndex + 1,
        category_id: polygon.type === 'external' ? 1 : 2,
        segmentation,
        area: width * height, // Přibližná plocha
        bbox: [minX, minY, width, height],
        iscrowd: 0,
      });
    });
  });

  return {
    info: {
      description: `${projectTitle} export`,
      url: '',
      version: '1.0',
      year: new Date().getFullYear(),
      contributor: 'SpheroidSegmentation',
      date_created: new Date().toISOString(),
    },
    licenses: [{ id: 1, name: 'Unknown', url: '' }],
    images: cocoImages,
    annotations,
    categories,
  };
}

/**
 * Konvertuje segmentace do YOLO formátu
 */
function convertToYOLO(segData: SegmentationResult, width: number, height: number): string {
  if (!segData || !segData.polygons || segData.polygons.length === 0) {
    return '';
  }

  // Zpracování pouze externích polygonů
  const externalPolygons = segData.polygons.filter((polygon) => polygon.type === 'external');

  // Vytvoření YOLO formátu
  return externalPolygons
    .map((polygon) => {
      // Normalizace bodů (0-1)
      const normalizedPoints = polygon.points.map((point) => [point[0] / width, point[1] / height]).flat();

      // Formát: <class_id> <x1> <y1> <x2> <y2> ... <xn> <yn>
      return `0 ${normalizedPoints.join(' ')}`;
    })
    .join('\n');
}

export default {
  exportMetricsAsXlsx,
  exportMetricsAsCsv,
  exportSegmentationsAsCoco,
  exportSegmentationsAsYolo,
  exportAllDataAsZip,
};
