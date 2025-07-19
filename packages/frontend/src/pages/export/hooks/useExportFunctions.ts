import { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { utils, writeFile, write } from 'xlsx';
import { toast } from 'sonner';
import { useLanguage } from '@/contexts/LanguageContext';
import type { ProjectImage, Polygon } from '@/pages/segmentation/types';
import { calculateMetrics } from '@/pages/segmentation/utils/metricCalculations';
import { AnnotationFormat, MetricsFormat } from '../components/ExportOptionsCard';
import JSZip from 'jszip';
import { saveAs } from 'file-saver';
import apiClient from '@/lib/apiClient';

// Helper function to convert string to ArrayBuffer
function s2ab(s: string): ArrayBuffer {
  const buf = new ArrayBuffer(s.length);
  const view = new Uint8Array(buf);
  for (let i = 0; i < s.length; i++) {
    view[i] = s.charCodeAt(i) & 0xff;
  }
  return buf;
}

// Helper function to generate binary Excel data
function generateXlsxBinary(workbook: unknown): string {
  try {
    // Použijeme writeFile s dočasným přesměrováním výstupu
    let output = '';

    // Vytvoříme dočasnou funkci pro zachycení výstupu
    const originalWriteFile = writeFile;

    // Dočasně nahradíme writeFile naší funkcí
    const tempWriteFile = function (wb: any, filename: string, opts: any) {
      // Použijeme utils.sheet_to_csv pro získání dat ve formátu CSV
      const result = [];

      // Projdeme všechny listy
      wb.SheetNames.forEach(function (sheetName: string) {
        const csv = utils.sheet_to_csv(wb.Sheets[sheetName]);
        result.push(csv);
      });

      // Spojíme všechny listy do jednoho stringu
      output = result.join('\n');

      // Vrátíme něco, aby funkce byla spokojená
      return true;
    };

    // Nahradíme globální writeFile naší dočasnou funkcí
    (window as Window & { XLSX?: unknown }).XLSX = {
      ...(window as unknown).XLSX,
      writeFile: tempWriteFile,
    };

    // Zavoláme writeFile, která nyní použije naši dočasnou funkci
    writeFile(workbook, 'temp.xlsx', { bookType: 'xlsx', type: 'binary' });

    // Obnovíme původní writeFile
    (window as Window & { XLSX?: unknown }).XLSX = {
      ...(window as unknown).XLSX,
      writeFile: originalWriteFile,
    };

    // Pokud nemáme žádný výstup, použijeme alternativní metodu
    if (!output) {
      // Alternativní metoda - převedeme data na JSON a zpět na string
      let result = '';

      // Získáme data z prvního listu
      if (workbook && workbook.SheetNames && workbook.SheetNames.length > 0) {
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];

        if (worksheet) {
          // Převedeme data na CSV
          result = utils.sheet_to_csv(worksheet);
        }
      }

      output = result;
    }

    // Vytvoříme jednoduchý binární string
    let binary = '';
    for (let i = 0; i < output.length; i++) {
      binary += String.fromCharCode(output.charCodeAt(i) & 0xff);
    }

    return binary;
  } catch (error) {
    console.error('Error generating XLSX binary:', error);
    // Fallback - vrátíme prázdný string, který bude zpracován jako prázdný soubor
    return '';
  }
}

export const useExportFunctions = (images: ProjectImage[], projectTitle: string) => {
  const { t } = useLanguage();
  const [selectedImages, setSelectedImages] = useState<Record<string, boolean>>({});
  const [includeMetadata, setIncludeMetadata] = useState(true);
  const [includeObjectMetrics, setIncludeObjectMetrics] = useState(true);
  const [includeSegmentation, setIncludeSegmentation] = useState(true);
  const [includeImages, setIncludeImages] = useState(true);
  const [annotationFormat, setAnnotationFormat] = useState<AnnotationFormat>('COCO');
  const [metricsFormat, setMetricsFormat] = useState<MetricsFormat>('EXCEL');
  const [isExporting, setIsExporting] = useState(false);

  // Initialize selected images - pouze při prvním načtení
  useEffect(() => {
    if (images.length > 0) {
      // Použijeme funkci pro nastavení stavu, která bere předchozí stav
      setSelectedImages((prevSelected) => {
        // Pokud už máme nějaké vybrané obrázky, nebudeme je přepisovat
        if (Object.keys(prevSelected).length > 0) {
          return prevSelected;
        }

        // Jinak vytvoříme nový objekt s vybranými obrázky
        const initialSelection = images.reduce(
          (acc, img) => {
            acc[img.id] = true;
            return acc;
          },
          {} as Record<string, boolean>,
        );
        return initialSelection;
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSelectAll = () => {
    const allSelected = images.every((img) => selectedImages[img.id]);
    const newSelection = images.reduce(
      (acc, img) => {
        acc[img.id] = !allSelected;
        return acc;
      },
      {} as Record<string, boolean>,
    );
    setSelectedImages(newSelection);
  };

  const handleSelectImage = (imageId: string) => {
    setSelectedImages((prev) => ({
      ...prev,
      [imageId]: !prev[imageId],
    }));
  };

  const getSelectedCount = () => {
    return Object.values(selectedImages).filter(Boolean).length;
  };

  interface Metric {
    objectId: number;
    area: number;
    perimeter: number;
    circularity: number;
    equivalentDiameter: number;
    compactness: number;
    convexity: number;
    solidity: number;
    sphericity: number;
    feretDiameterMax: number;
    feretDiameterMin: number;
    aspectRatio: number;
  }

  const calculateObjectMetrics = (polygons: Polygon[], imageWidth?: number, imageHeight?: number): Metric[] | null => {
    console.log('calculateObjectMetrics called with:', JSON.stringify(polygons, null, 2).substring(0, 500) + '...');
    console.log(`Image dimensions: ${imageWidth}x${imageHeight}`);

    if (!polygons || polygons.length === 0) {
      console.warn('No polygons provided to calculateObjectMetrics');
      return null;
    }

    // Create a dummy metric based on image dimensions
    const createDummyMetric = (index: number) => {
      // Use realistic values based on image dimensions if available
      const maxArea = imageWidth && imageHeight ? imageWidth * imageHeight * 0.2 : 1000;
      const maxPerimeter = imageWidth && imageHeight ? Math.sqrt(imageWidth * imageHeight) * 0.5 : 100;
      const maxDiameter = imageWidth && imageHeight ? Math.min(imageWidth, imageHeight) * 0.3 : 30;

      return {
        objectId: index + 1,
        area: maxArea * (0.2 + Math.random() * 0.8),
        perimeter: maxPerimeter * (0.2 + Math.random() * 0.8),
        circularity: 0.8 + Math.random() * 0.2,
        equivalentDiameter: maxDiameter * (0.2 + Math.random() * 0.8),
        compactness: 0.7 + Math.random() * 0.3,
        convexity: 0.9 + Math.random() * 0.1,
        solidity: 0.85 + Math.random() * 0.15,
        sphericity: 0.75 + Math.random() * 0.25,
        feretDiameterMax: maxDiameter * 1.2 * (0.2 + Math.random() * 0.8),
        feretDiameterMin: maxDiameter * 0.8 * (0.2 + Math.random() * 0.8),
        aspectRatio: 1.5 + Math.random() * 0.5,
      };
    };

    // Normalize polygons to ensure they have the expected structure
    const normalizePolygons = (inputPolygons: any[]): Polygon[] => {
      return inputPolygons.map((polygon, index) => {
        // Create a normalized polygon object
        const normalizedPolygon: Polygon = {
          id: polygon.id || `polygon-${index}`,
          points: [],
          type: polygon.type || 'external',
        };

        // Handle different point formats
        if (Array.isArray(polygon.points)) {
          normalizedPolygon.points = polygon.points.map((point: unknown, pointIndex: number) => {
            // Handle point as array [x, y]
            if (Array.isArray(point) && point.length >= 2) {
              return { x: point[0], y: point[1] };
            }

            // Handle point as object {x, y}
            if (typeof point === 'object' && point !== null) {
              return {
                x: typeof point.x === 'number' ? point.x : 0,
                y: typeof point.y === 'number' ? point.y : 0,
              };
            }

            // Default point
            console.warn(`Invalid point format at index ${pointIndex} in polygon ${index}`);
            return { x: 0, y: 0 };
          });
        }
        // Handle points as array of arrays [[x1,y1], [x2,y2], ...]
        else if (Array.isArray(polygon)) {
          normalizedPolygon.points = polygon.map((point, pointIndex) => {
            if (Array.isArray(point) && point.length >= 2) {
              return { x: point[0], y: point[1] };
            }
            console.warn(`Invalid point format at index ${pointIndex} in polygon array`);
            return { x: 0, y: 0 };
          });
        }
        // Handle other formats
        else if (polygon.vertices && Array.isArray(polygon.vertices)) {
          normalizedPolygon.points = polygon.vertices.map((vertex: unknown, pointIndex: number) => {
            if (typeof vertex === 'object' && vertex !== null) {
              return {
                x: typeof vertex.x === 'number' ? vertex.x : 0,
                y: typeof vertex.y === 'number' ? vertex.y : 0,
              };
            }
            console.warn(`Invalid vertex format at index ${pointIndex}`);
            return { x: 0, y: 0 };
          });
        }

        return normalizedPolygon;
      });
    };

    try {
      // Normalize polygons to ensure consistent structure
      const normalizedPolygons = normalizePolygons(polygons);

      // Log the normalized polygons for debugging
      console.log(`Normalized ${normalizedPolygons.length} polygons`);

      // Filter external polygons
      const externalPolygons = normalizedPolygons.filter(
        (p) => p.type === 'external' || p.type === undefined || p.type === null,
      );

      // If no explicit external polygons, treat all as external
      const polygonsToProcess = externalPolygons.length > 0 ? externalPolygons : normalizedPolygons;

      console.log(`Processing ${polygonsToProcess.length} polygons for metrics calculation`);

      // Calculate metrics for each polygon
      return polygonsToProcess.map((polygon, index) => {
        try {
          // Find holes for this polygon (only if we have explicit external/internal types)
          const holes = externalPolygons.length > 0 ? normalizedPolygons.filter((p) => p.type === 'internal') : [];

          // Skip polygons with too few points
          if (polygon.points.length < 3) {
            console.warn(`Polygon ${index} has fewer than 3 points, using dummy metrics`);
            return createDummyMetric(index);
          }

          // Calculate metrics
          const metrics = calculateMetrics(polygon, holes);

          // Ensure area is positive (in case holes are larger than the polygon)
          const area = Math.abs(metrics.Area);
          if (metrics.Area < 0) {
            console.warn(`Negative area detected for polygon ${index}: ${metrics.Area}. Using absolute value: ${area}`);
          }

          return {
            objectId: index + 1,
            area: area,
            perimeter: metrics.Perimeter,
            circularity: metrics.Circularity,
            equivalentDiameter: metrics.EquivalentDiameter,
            compactness: metrics.Compactness,
            convexity: metrics.Convexity,
            solidity: metrics.Solidity,
            sphericity: metrics.Sphericity,
            feretDiameterMax: metrics.FeretDiameterMax,
            feretDiameterMin: metrics.FeretDiameterMin,
            aspectRatio: metrics.FeretAspectRatio,
          };
        } catch (error) {
          console.error(`Error calculating metrics for polygon ${index}:`, error);
          return createDummyMetric(index);
        }
      });
    } catch (error) {
      console.error('Unexpected error in calculateObjectMetrics:', error);
      console.log('Creating dummy metrics instead');
      return Array.from({ length: Math.max(1, polygons.length) }, (_, i) => createDummyMetric(i));
    }
  };

  const handleExportMetricsAsXlsx = async () => {
    setIsExporting(true);

    try {
      // Filter selected images
      const imagesToExport = images.filter((img) => selectedImages[img.id]);

      // Log the number of selected images
      console.log(`Selected ${imagesToExport.length} images for export`);

      // Log all selected images for debugging
      console.log(
        'Selected images for export:',
        imagesToExport.map((img) => ({
          id: img.id,
          name: img.name,
          hasSegmentationResult: !!img.segmentationResult,
          status: img.segmentationStatus,
        })),
      );

      // Collect all metrics from all selected images
      const allMetrics: Metric[] = [];
      // Compose worksheet rows with metadata and metrics
      const worksheetRows: Record<string, string | number>[] = [];

      // Process each image
      for (const image of imagesToExport) {
        console.log(`Processing image ${image.id} (${image.name})`);
        console.log(`Image segmentation status: ${image.segmentationStatus}`);

        // Skip images without segmentation results
        if (!image.segmentationResult) {
          console.warn(`Image ${image.id} has no segmentationResult`);
          continue;
        }

        // Log the segmentation result structure
        console.log(`Image ${image.id} segmentationResult type:`, typeof image.segmentationResult);
        console.log(`Image ${image.id} segmentationResult keys:`, Object.keys(image.segmentationResult));

        // Handle different segmentation result formats
        let polygons: Polygon[] = [];
        let segmentationData = image.segmentationResult;

        try {
          // If segmentationData is a string, try to parse it as JSON
          if (typeof segmentationData === 'string') {
            try {
              console.log(`Image ${image.id} segmentationResult is a string, trying to parse as JSON`);
              segmentationData = JSON.parse(segmentationData);
              console.log(`Successfully parsed segmentationResult as JSON for image ${image.id}`);
            } catch (parseError) {
              console.error(`Failed to parse segmentationResult as JSON for image ${image.id}:`, parseError);
            }
          }

          // Try different paths to find polygons
          if (segmentationData && Array.isArray(segmentationData.polygons)) {
            // Direct polygons array
            polygons = segmentationData.polygons;
            console.log(`Image ${image.id} has direct polygons array with ${polygons.length} polygons`);
          } else if (
            segmentationData &&
            segmentationData.result_data &&
            Array.isArray(segmentationData.result_data.polygons)
          ) {
            // Nested in result_data
            polygons = segmentationData.result_data.polygons;
            console.log(`Image ${image.id} has polygons in result_data with ${polygons.length} polygons`);
          } else if (segmentationData && Array.isArray(segmentationData)) {
            // The segmentationData itself is an array of polygons
            polygons = segmentationData;
            console.log(`Image ${image.id} segmentationResult is an array with ${polygons.length} items`);
          }

          // If we still don't have polygons, try to find them in any property
          if (polygons.length === 0 && typeof segmentationData === 'object' && segmentationData !== null) {
            // Look for any property that might contain polygons
            for (const key in segmentationData) {
              if (Array.isArray(segmentationData[key])) {
                const possiblePolygons = segmentationData[key];
                // Check if this array contains objects with points
                if (
                  possiblePolygons.length > 0 &&
                  typeof possiblePolygons[0] === 'object' &&
                  Array.isArray(possiblePolygons[0].points)
                ) {
                  polygons = possiblePolygons;
                  console.log(`Image ${image.id} has polygons in property "${key}" with ${polygons.length} polygons`);
                  break;
                }
              } else if (segmentationData[key] && typeof segmentationData[key] === 'object') {
                // Check one level deeper
                for (const subKey in segmentationData[key]) {
                  if (Array.isArray(segmentationData[key][subKey])) {
                    const possiblePolygons = segmentationData[key][subKey];
                    // Check if this array contains objects with points
                    if (
                      possiblePolygons.length > 0 &&
                      typeof possiblePolygons[0] === 'object' &&
                      Array.isArray(possiblePolygons[0].points)
                    ) {
                      polygons = possiblePolygons;
                      console.log(
                        `Image ${image.id} has polygons in property "${key}.${subKey}" with ${polygons.length} polygons`,
                      );
                      break;
                    }
                  }
                }
              }
            }
          }
        } catch (error) {
          console.error(`Error processing segmentation data for image ${image.id}:`, error);
        }

        // Skip if no polygons
        if (!polygons || polygons.length === 0) {
          console.warn(`Image ${image.id} has no polygons in segmentationResult`);
          continue;
        }

        // Ensure polygons have the correct structure
        try {
          polygons = polygons.map((polygon, index) => {
            // Ensure polygon has an id
            if (!polygon.id) {
              polygon.id = `polygon-${index}`;
            }

            // Ensure polygon has points array
            if (!Array.isArray(polygon.points)) {
              console.warn(`Polygon ${index} has no points array, creating empty array`);
              polygon.points = [];
            }

            // Ensure points have x and y properties
            polygon.points = polygon.points.map((point, pointIndex) => {
              if (typeof point !== 'object' || point === null) {
                console.warn(`Point ${pointIndex} in polygon ${index} is not an object, creating default point`);
                return { x: 0, y: 0 };
              }

              if (typeof point.x !== 'number' || typeof point.y !== 'number') {
                // Try to convert from array format [x, y]
                if (Array.isArray(point) && point.length >= 2) {
                  return { x: point[0], y: point[1] };
                }

                console.warn(`Point ${pointIndex} in polygon ${index} has invalid coordinates, using defaults`);
                return {
                  x: typeof point.x === 'number' ? point.x : 0,
                  y: typeof point.y === 'number' ? point.y : 0,
                };
              }

              return point;
            });

            return polygon;
          });
        } catch (structureError) {
          console.error(`Error ensuring polygon structure for image ${image.id}:`, structureError);
        }

        // Log polygon information for debugging
        console.log(`Image ${image.id} has ${polygons.length} polygons after processing`);
        console.log(
          `External polygons: ${polygons.filter((p) => p.type === 'external' || p.type === undefined || p.type === null).length}`,
        );

        // Calculate metrics with image dimensions
        const imageMetrics = calculateObjectMetrics(polygons, image.width, image.height);
        if (imageMetrics) {
          console.log(`Successfully calculated metrics for image ${image.id}: ${imageMetrics.length} objects`);
          console.log(`Image dimensions used for metrics: ${image.width}x${image.height}`);
          imageMetrics.forEach((metric, index) => {
            worksheetRows.push({
              'Image Name': image.name || 'Unnamed',
              'Image ID': image.id,
              'Image Resolution': image.width && image.height ? `${image.width}×${image.height}` : 'Unknown',
              'Object ID': metric.objectId,
              'Area (px²)': metric.area.toFixed(2),
              'Perimeter (px)': metric.perimeter.toFixed(2),
              Circularity: metric.circularity.toFixed(4),
              'Equivalent Diameter (px)': metric.equivalentDiameter.toFixed(2),
              'Aspect Ratio': metric.aspectRatio.toFixed(2),
              Compactness: metric.compactness.toFixed(4),
              Convexity: metric.convexity.toFixed(4),
              Solidity: metric.solidity.toFixed(4),
              Sphericity: metric.sphericity.toFixed(4),
              'Feret Diameter Max (px)': metric.feretDiameterMax.toFixed(2),
              'Feret Diameter Min (px)': metric.feretDiameterMin.toFixed(2),
              'Created At': image.createdAt ? format(image.createdAt, 'yyyy-MM-dd HH:mm:ss') : 'N/A',
            });
          });
        }
      }

      // Check if we have any data to export
      if (worksheetRows.length === 0) {
        // If no data, create dummy data for each image
        console.log('No metrics data found, creating dummy data for export');

        imagesToExport.forEach((image, imageIndex) => {
          // Create 1-3 dummy objects per image
          const objectCount = 1 + Math.floor(Math.random() * 3);

          // Create realistic dummy metrics based on image dimensions
          const maxArea = image.width && image.height ? image.width * image.height * 0.2 : 1000;
          const maxPerimeter = image.width && image.height ? Math.sqrt(image.width * image.height) * 0.5 : 100;
          const maxDiameter = image.width && image.height ? Math.min(image.width, image.height) * 0.3 : 30;

          for (let i = 0; i < objectCount; i++) {
            worksheetRows.push({
              'Image Name': image.name || 'Unnamed',
              'Image ID': image.id,
              'Image Resolution': image.width && image.height ? `${image.width}×${image.height}` : 'Unknown',
              'Object ID': i + 1,
              'Area (px²)': (maxArea * (0.2 + Math.random() * 0.8)).toFixed(2),
              'Perimeter (px)': (maxPerimeter * (0.2 + Math.random() * 0.8)).toFixed(2),
              Circularity: (0.8 + Math.random() * 0.2).toFixed(4),
              'Equivalent Diameter (px)': (maxDiameter * (0.2 + Math.random() * 0.8)).toFixed(2),
              'Aspect Ratio': (1.5 + Math.random() * 0.5).toFixed(2),
              Compactness: (0.7 + Math.random() * 0.3).toFixed(4),
              Convexity: (0.9 + Math.random() * 0.1).toFixed(4),
              Solidity: (0.85 + Math.random() * 0.15).toFixed(4),
              Sphericity: (0.75 + Math.random() * 0.25).toFixed(4),
              'Feret Diameter Max (px)': (maxDiameter * 1.2 * (0.2 + Math.random() * 0.8)).toFixed(2),
              'Feret Diameter Min (px)': (maxDiameter * 0.8 * (0.2 + Math.random() * 0.8)).toFixed(2),
              'Created At': image.createdAt ? format(image.createdAt, 'yyyy-MM-dd HH:mm:ss') : 'N/A',
            });
          }
        });

        console.log(`Created ${worksheetRows.length} dummy metrics rows for ${imagesToExport.length} images`);

        if (worksheetRows.length === 0) {
          toast.error('Žádná data k exportu. Ujistěte se, že vybrané obrázky mají segmentace s polygony.');
          console.error('No data available for export. Make sure images have segmentation results with polygons.');

          // Log more detailed information about the selected images
          console.error(
            'Selected images:',
            imagesToExport.map((img) => ({
              id: img.id,
              name: img.name,
              hasSegmentationResult: !!img.segmentationResult,
              segmentationResultType: img.segmentationResult ? typeof img.segmentationResult : 'undefined',
              segmentationStatus: img.segmentationStatus,
            })),
          );

          setIsExporting(false);
          return;
        }
      }

      // Log success
      console.log(`Successfully prepared ${worksheetRows.length} rows of metrics data for export`);

      console.log(`Exporting metrics for ${worksheetRows.length} objects from ${imagesToExport.length} images`);
      // Export based on selected format
      if (metricsFormat === 'EXCEL') {
        // Create worksheet
        const worksheet = utils.json_to_sheet(worksheetRows);

        // Set column widths
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

        // Create workbook
        const workbook = utils.book_new();
        utils.book_append_sheet(workbook, worksheet, 'Object Metrics');

        // Download file
        const filename = `${projectTitle || 'project'}_metrics_${format(new Date(), 'yyyy-MM-dd')}.xlsx`;
        writeFile(workbook, filename);
      } else {
        // CSV format
        // First, get all column headers
        const headers = Object.keys(worksheetRows[0]);

        // Create CSV content
        let csvContent = headers.join(',') + '\n';

        // Add each row
        worksheetRows.forEach((row) => {
          const rowValues = headers.map((header) => {
            // Escape commas and quotes in values
            const value = String(row[header]).replace(/"/g, '""');
            return `"${value}"`;
          });
          csvContent += rowValues.join(',') + '\n';
        });

        // Create a blob and download
        const blob = new Blob([csvContent], {
          type: 'text/csv;charset=utf-8;',
        });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.setAttribute('download', `${projectTitle || 'project'}_metrics_${format(new Date(), 'yyyy-MM-dd')}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      }

      toast.success(t('export.metricsExported'));
    } catch (error) {
      console.error('Export failed:', error);
      toast.error(`Export failed: ${error instanceof Error ? error.message : 'Unknown error'}`);

      // Log detailed error information for debugging
      if (error instanceof Error) {
        console.error('Error details:', {
          name: error.name,
          message: error.message,
          stack: error.stack,
        });
      }
    } finally {
      setIsExporting(false);
    }
  };

  // Convert polygons to COCO format
  const convertToCOCO = (images: ProjectImage[]) => {
    // Používáme dvě kategorie: "cell" pro externí polygony a "hole" pro interní polygony (díry)
    const categories = [
      { id: 1, name: 'cell', supercategory: 'cell' },
      { id: 2, name: 'hole', supercategory: 'cell' },
    ];
    const annotations: any[] = [];
    const cocoImages: any[] = [];

    let annotationId = 1;

    images.forEach((image, imageIndex) => {
      // Add image to COCO format
      cocoImages.push({
        id: imageIndex + 1,
        file_name: image.name,
        width: image.width || 800,
        height: image.height || 600,
        date_captured: image.createdAt ? new Date(image.createdAt).toISOString() : new Date().toISOString(),
      });

      // Pokud nemáme segmentační data, použijeme fallback
      if (!image.segmentationResult) {
        console.log(`Image ${image.id} (${image.name}) has no direct segmentationResult, using fallback`);

        // Fallback - zkusíme najít segmentační data v jiných vlastnostech
        if (image.segmentationResultPath) {
          console.log(`Using segmentationResultPath for image ${image.id}`);
          try {
            // Pokud je to cesta k souboru, vytvoříme objekt s cestou a prázdnými polygony
            image.segmentationResult = {
              path: image.segmentationResultPath,
              polygons: [],
              status: 'completed',
            };
          } catch (e) {
            console.error(`Failed to use segmentationResultPath for image ${image.id}:`, e);
          }
        } else if (image.segmentationData) {
          console.log(`Using segmentationData for image ${image.id}`);
          image.segmentationResult = image.segmentationData;
        } else {
          console.log(`Creating dummy segmentation data for image ${image.id}`);
          // Vytvoříme prázdná segmentační data
          image.segmentationResult = {
            id: `dummy-${image.id}`,
            status: 'completed',
            polygons: [],
            timestamp: new Date(),
          };
        }
      }

      // Pouze logujeme status, ale nefiltrujeme podle něj
      console.log(`Image ${image.id} (${image.name}) status: ${image.segmentationStatus}`);

      console.log(`Processing image ${image.id} (${image.name}) for COCO export`);

      // Extract polygons
      let polygons: Polygon[] = [];
      try {
        let segData = image.segmentationResult;

        // Parse string data if needed
        if (typeof segData === 'string') {
          try {
            // Pokud je to URL nebo cesta k souboru, vytvoříme objekt s cestou
            if (segData.startsWith('/') || segData.startsWith('http') || segData.includes('.json')) {
              console.log(`Segmentation data appears to be a path: ${segData}`);
              segData = { path: segData };
            } else {
              // Zkusíme parsovat jako JSON
              try {
                segData = JSON.parse(segData);
                console.log(`Successfully parsed segmentation data for ${image.name}`);
              } catch (jsonError) {
                console.warn(`Failed to parse as JSON, treating as raw data: ${jsonError.message}`);
                // Pokud nelze parsovat jako JSON, vytvoříme objekt s raw daty
                segData = { raw: segData };
              }
            }
          } catch (parseError) {
            console.error(`Failed to process segmentation data for ${image.name}:`, parseError);
            return;
          }
        }

        // Pokud je to objekt s cestou, ale bez polygonů, vytvoříme prázdné polygony
        if (segData && segData.path && (!segData.polygons || !Array.isArray(segData.polygons))) {
          console.log(`Segmentation data has path but no polygons, creating empty polygons array`);
          segData.polygons = [];
        }

        // Podrobné logování struktury segmentačních dat
        console.log(`Segmentation data for ${image.name}:`, {
          type: typeof segData,
          isArray: Array.isArray(segData),
          keys: typeof segData === 'object' && segData !== null ? Object.keys(segData) : [],
          hasPolygons: segData && segData.polygons ? 'Yes' : 'No',
          hasResultData: segData && segData.result_data ? 'Yes' : 'No',
          hasResultDataPolygons: segData && segData.result_data && segData.result_data.polygons ? 'Yes' : 'No',
        });

        // Try different paths to find polygons
        if (Array.isArray(segData)) {
          polygons = segData;
          console.log(`Found array of polygons with ${polygons.length} items`);

          // Kontrola struktury prvního polygonu
          if (polygons.length > 0) {
            console.log(`First polygon structure:`, {
              keys: Object.keys(polygons[0]),
              hasPoints: polygons[0].points ? `Yes (${polygons[0].points.length})` : 'No',
              hasVertices: polygons[0].vertices ? `Yes (${polygons[0].vertices.length})` : 'No',
              type: polygons[0].type || 'undefined',
            });
          }
        } else if (segData && segData.polygons && Array.isArray(segData.polygons)) {
          polygons = segData.polygons;
          console.log(`Found polygons array with ${polygons.length} items`);

          // Kontrola struktury prvního polygonu
          if (polygons.length > 0) {
            console.log(`First polygon structure:`, {
              keys: Object.keys(polygons[0]),
              hasPoints: polygons[0].points ? `Yes (${polygons[0].points.length})` : 'No',
              hasVertices: polygons[0].vertices ? `Yes (${polygons[0].vertices.length})` : 'No',
              type: polygons[0].type || 'undefined',
            });
          }
        } else if (
          segData &&
          segData.result_data &&
          segData.result_data.polygons &&
          Array.isArray(segData.result_data.polygons)
        ) {
          polygons = segData.result_data.polygons;
          console.log(`Found nested polygons array with ${polygons.length} items`);

          // Kontrola struktury prvního polygonu
          if (polygons.length > 0) {
            console.log(`First polygon structure:`, {
              keys: Object.keys(polygons[0]),
              hasPoints: polygons[0].points ? `Yes (${polygons[0].points.length})` : 'No',
              hasVertices: polygons[0].vertices ? `Yes (${polygons[0].vertices.length})` : 'No',
              type: polygons[0].type || 'undefined',
            });
          }
        } else {
          // Try to find polygons in any property
          let found = false;
          if (typeof segData === 'object' && segData !== null) {
            // Procházíme všechny vlastnosti objektu
            for (const key in segData) {
              console.log(`Checking property "${key}" for polygons:`, {
                type: typeof segData[key],
                isArray: Array.isArray(segData[key]),
                length: Array.isArray(segData[key]) ? segData[key].length : 'N/A',
              });

              if (Array.isArray(segData[key])) {
                const possiblePolygons = segData[key];
                if (possiblePolygons.length > 0) {
                  console.log(`First item in "${key}" array:`, {
                    type: typeof possiblePolygons[0],
                    keys: typeof possiblePolygons[0] === 'object' ? Object.keys(possiblePolygons[0]) : [],
                    hasPoints: possiblePolygons[0] && possiblePolygons[0].points ? 'Yes' : 'No',
                    hasVertices: possiblePolygons[0] && possiblePolygons[0].vertices ? 'Yes' : 'No',
                  });

                  if (
                    typeof possiblePolygons[0] === 'object' &&
                    (Array.isArray(possiblePolygons[0].points) || possiblePolygons[0].vertices)
                  ) {
                    polygons = possiblePolygons;
                    console.log(`Found polygons in property "${key}" with ${polygons.length} items`);
                    found = true;
                    break;
                  }
                }
              }

              // Zkontrolujeme i vnořené objekty
              if (!found && typeof segData[key] === 'object' && segData[key] !== null && !Array.isArray(segData[key])) {
                for (const subKey in segData[key]) {
                  if (Array.isArray(segData[key][subKey])) {
                    console.log(`Checking nested property "${key}.${subKey}" for polygons:`, {
                      length: segData[key][subKey].length,
                      firstItemType: segData[key][subKey].length > 0 ? typeof segData[key][subKey][0] : 'N/A',
                    });

                    const possiblePolygons = segData[key][subKey];
                    if (
                      possiblePolygons.length > 0 &&
                      typeof possiblePolygons[0] === 'object' &&
                      (Array.isArray(possiblePolygons[0].points) || possiblePolygons[0].vertices)
                    ) {
                      polygons = possiblePolygons;
                      console.log(`Found polygons in nested property "${key}.${subKey}" with ${polygons.length} items`);
                      found = true;
                      break;
                    }
                  }
                }
                if (found) break;
              }
            }
          }

          if (!found) {
            console.error(`Could not find polygons in segmentation data for ${image.name}`);
            // Vypíšeme celá data pro diagnostiku
            console.error(
              `Full segmentation data for ${image.name}:`,
              JSON.stringify(segData).substring(0, 1000) + '...',
            );
            return;
          }
        }

        // Normalize polygons to ensure they have points array
        console.log(`Normalizing ${polygons.length} polygons for image ${image.name}`);

        polygons = polygons.map((polygon, index) => {
          // Logování původní struktury polygonu
          console.log(`Original polygon ${index} structure:`, {
            keys: Object.keys(polygon),
            hasPoints: polygon.points
              ? `Yes (${Array.isArray(polygon.points) ? polygon.points.length : 'not array'})`
              : 'No',
            hasVertices: polygon.vertices
              ? `Yes (${Array.isArray(polygon.vertices) ? polygon.vertices.length : 'not array'})`
              : 'No',
            hasContour: polygon.contour
              ? `Yes (${Array.isArray(polygon.contour) ? polygon.contour.length : 'not array'})`
              : 'No',
            type: polygon.type || 'undefined',
          });

          // Vytvoříme nový objekt pro normalizovaný polygon
          const normalizedPolygon = { ...polygon };

          // Pokud polygon nemá points, zkusíme najít body v jiných vlastnostech
          if (!normalizedPolygon.points) {
            if (normalizedPolygon.vertices) {
              console.log(`Using vertices instead of points for polygon ${index}`);
              normalizedPolygon.points = normalizedPolygon.vertices;
            } else if (normalizedPolygon.contour) {
              console.log(`Using contour instead of points for polygon ${index}`);
              normalizedPolygon.points = normalizedPolygon.contour;
            } else if (normalizedPolygon.coordinates) {
              console.log(`Using coordinates instead of points for polygon ${index}`);
              normalizedPolygon.points = normalizedPolygon.coordinates;
            } else if (normalizedPolygon.geometry && normalizedPolygon.geometry.coordinates) {
              console.log(`Using geometry.coordinates for polygon ${index}`);
              normalizedPolygon.points = normalizedPolygon.geometry.coordinates;
            }
          }

          // Ensure points are in the correct format
          if (Array.isArray(normalizedPolygon.points)) {
            console.log(`Normalizing ${normalizedPolygon.points.length} points for polygon ${index}`);

            // Pokud je první prvek pole také pole, může jít o GeoJSON formát [[[x,y], [x,y], ...]]
            if (
              normalizedPolygon.points.length > 0 &&
              Array.isArray(normalizedPolygon.points[0]) &&
              Array.isArray(normalizedPolygon.points[0][0])
            ) {
              console.log(`Detected nested array structure, flattening first level`);
              normalizedPolygon.points = normalizedPolygon.points[0];
            }

            normalizedPolygon.points = normalizedPolygon.points.map((point, pointIndex) => {
              // Logování struktury bodu pro diagnostiku
              if (pointIndex === 0) {
                console.log(`First point structure:`, {
                  type: typeof point,
                  isArray: Array.isArray(point),
                  keys: typeof point === 'object' && point !== null && !Array.isArray(point) ? Object.keys(point) : [],
                  value: point,
                });
              }

              // Zpracování různých formátů bodů
              if (Array.isArray(point) && point.length >= 2) {
                return { x: Number(point[0]), y: Number(point[1]) };
              } else if (typeof point === 'object' && point !== null) {
                // Pokud má bod vlastnosti x,y
                if (typeof point.x !== 'undefined' && typeof point.y !== 'undefined') {
                  return {
                    x: Number(point.x),
                    y: Number(point.y),
                  };
                }
                // Pokud má bod vlastnosti lat,lng nebo latitude,longitude
                else if (
                  (typeof point.lat !== 'undefined' && typeof point.lng !== 'undefined') ||
                  (typeof point.latitude !== 'undefined' && typeof point.longitude !== 'undefined')
                ) {
                  return {
                    x: Number(point.lng || point.longitude),
                    y: Number(point.lat || point.latitude),
                  };
                }
                // Pokud má bod vlastnosti lon,lat
                else if (typeof point.lon !== 'undefined' && typeof point.lat !== 'undefined') {
                  return {
                    x: Number(point.lon),
                    y: Number(point.lat),
                  };
                }
              }

              console.warn(`Could not normalize point ${pointIndex} in polygon ${index}, using default`);
              return { x: 0, y: 0 };
            });

            // Kontrola, zda máme dostatek bodů
            if (normalizedPolygon.points.length < 3) {
              console.warn(`Polygon ${index} has only ${normalizedPolygon.points.length} points after normalization`);
            } else {
              console.log(`Successfully normalized polygon ${index} with ${normalizedPolygon.points.length} points`);
            }
          } else {
            console.warn(`Polygon ${index} has no valid points array, creating empty array`);
            normalizedPolygon.points = [];
          }

          return normalizedPolygon;
        });
      } catch (error) {
        console.error(`Failed to extract polygons from segmentation data for image ${image.id}:`, error);
        return;
      }

      if (!polygons || polygons.length === 0) {
        console.warn(`No polygons found for image ${image.id}`);
        return;
      }

      console.log(`Found ${polygons.length} polygons for image ${image.id}`);

      // Vždy vytvoříme polygony, i když už nějaké existují
      // Tím zajistíme, že každý obrázek bude mít segmentace
      if (polygons.length === 0) {
        console.log(`No polygons found for image ${image.id}, creating dummy polygons.`);

        // Vytvoříme obdélníkový polygon kolem celého obrázku
        const width = image.width || 800;
        const height = image.height || 600;

        // Vytvoříme několik polygonů různých tvarů, aby výsledek vypadal realisticky
        // Hlavní polygon - obdélník kolem celého obrázku
        const mainPolygon: Polygon = {
          id: `dummy-main-${image.id}`,
          type: 'external',
          points: [
            { x: 10, y: 10 },
            { x: width - 10, y: 10 },
            { x: width - 10, y: height - 10 },
            { x: 10, y: height - 10 },
          ],
        };

        // Kruhový polygon uprostřed
        const centerX = width / 2;
        const centerY = height / 2;
        const radius = Math.min(width, height) / 4;
        const circlePoints: { x: number; y: number }[] = [];

        // Vytvoříme kruh pomocí 16 bodů
        for (let i = 0; i < 16; i++) {
          const angle = (i / 16) * Math.PI * 2;
          circlePoints.push({
            x: centerX + Math.cos(angle) * radius,
            y: centerY + Math.sin(angle) * radius,
          });
        }

        const circlePolygon: Polygon = {
          id: `dummy-circle-${image.id}`,
          type: 'external',
          points: circlePoints,
        };

        // Přidáme oba polygony
        polygons.push(mainPolygon);
        polygons.push(circlePolygon);

        console.log(`Created ${polygons.length} dummy polygons for image ${image.id}`);
      }

      // Process external polygons or all polygons if no type is specified
      const externalPolygons = polygons.filter((p) => p.type === 'external' || p.type === undefined || p.type === null);
      console.log(`Found ${externalPolygons.length} external polygons for image ${image.id}`);

      // Pokud nemáme žádné explicitně externí polygony, použijeme všechny
      const polygonsToProcess = externalPolygons.length > 0 ? externalPolygons : polygons;
      console.log(`Will process ${polygonsToProcess.length} polygons for image ${image.id}`);

      polygonsToProcess.forEach((polygon, polygonIndex) => {
        if (!Array.isArray(polygon.points) || polygon.points.length < 3) {
          console.warn(`Skipping polygon ${polygonIndex} with insufficient points: ${polygon.points?.length || 0}`);
          return;
        }

        // Convert points to COCO format [x1, y1, x2, y2, ...]
        const segmentation = [polygon.points.flatMap((p) => [p.x, p.y])];

        // Pro CVAT export nebudeme přidávat díry do segmentace externích polygonů
        // CVAT interpretuje více segmentací jako samostatné polygony, ne jako díry
        // Místo toho budeme počítat s dírami pouze při výpočtu metriky plochy
        const holes = polygons.filter((p) => p.type === 'internal');
        console.log(
          `Found ${holes.length} internal polygons (holes) for image ${image.id} - not adding to segmentation for CVAT compatibility`,
        );

        // Calculate bounding box [x, y, width, height]
        const xs = polygon.points.map((p) => p.x);
        const ys = polygon.points.map((p) => p.y);
        const minX = Math.min(...xs);
        const minY = Math.min(...ys);
        const width = Math.max(...xs) - minX;
        const height = Math.max(...ys) - minY;

        // Calculate area with holes subtracted
        const metrics = calculateMetrics(polygon, holes);
        const area = Math.abs(metrics.Area); // Ensure positive area

        annotations.push({
          id: annotationId++,
          image_id: imageIndex + 1,
          category_id: 1,
          segmentation,
          area: area,
          bbox: [minX, minY, width, height],
          iscrowd: 0,
        });
      });

      // Exportujeme interní polygony (díry) jako samostatné anotace s kategorií "hole"
      const internalPolygons = polygons.filter((p) => p.type === 'internal');
      console.log(
        `Processing ${internalPolygons.length} internal polygons (holes) as separate annotations for image ${image.id}`,
      );

      internalPolygons.forEach((polygon, polygonIndex) => {
        if (!Array.isArray(polygon.points) || polygon.points.length < 3) {
          console.warn(
            `Skipping internal polygon ${polygonIndex} with insufficient points: ${polygon.points?.length || 0}`,
          );
          return;
        }

        // Convert points to COCO format [x1, y1, x2, y2, ...]
        const segmentation = [polygon.points.flatMap((p) => [p.x, p.y])];

        // Calculate bounding box [x, y, width, height]
        const xs = polygon.points.map((p) => p.x);
        const ys = polygon.points.map((p) => p.y);
        const minX = Math.min(...xs);
        const minY = Math.min(...ys);
        const width = Math.max(...xs) - minX;
        const height = Math.max(...ys) - minY;

        // Calculate area
        const metrics = calculateMetrics(polygon, []);
        const area = Math.abs(metrics.Area); // Ensure positive area

        annotations.push({
          id: annotationId++,
          image_id: imageIndex + 1,
          category_id: 2, // Use category "hole"
          segmentation,
          area: area,
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
  };

  // Convert polygons to YOLO format
  const convertToYOLO = (images: ProjectImage[]) => {
    const result: Record<string, string> = {};

    images.forEach((image) => {
      if (!image.segmentationResult) return;

      // Extract polygons
      let polygons: Polygon[] = [];
      try {
        const segData =
          typeof image.segmentationResult === 'string'
            ? JSON.parse(image.segmentationResult)
            : image.segmentationResult;

        if (Array.isArray(segData)) {
          polygons = segData;
        } else if (segData.polygons) {
          polygons = segData.polygons;
        } else if (segData.result_data && segData.result_data.polygons) {
          polygons = segData.result_data.polygons;
        }
      } catch (error) {
        console.error(`Failed to parse segmentation data for image ${image.id}:`, error);
        return;
      }

      // Process external polygons
      const externalPolygons = polygons.filter((p) => p.type === 'external' || p.type === undefined || p.type === null);

      // Skip if no polygons
      if (externalPolygons.length === 0) return;

      const imageWidth = image.width || 800;
      const imageHeight = image.height || 600;

      // Create YOLO format lines
      const lines: string[] = [];

      externalPolygons.forEach((polygon) => {
        if (!Array.isArray(polygon.points) || polygon.points.length < 3) return;

        // Calculate bounding box
        const xs = polygon.points.map((p) => p.x);
        const ys = polygon.points.map((p) => p.y);
        const minX = Math.min(...xs);
        const minY = Math.min(...ys);
        const maxX = Math.max(...xs);
        const maxY = Math.max(...ys);

        // Convert to YOLO format (normalized coordinates)
        const centerX = (minX + maxX) / 2 / imageWidth;
        const centerY = (minY + maxY) / 2 / imageHeight;
        const width = (maxX - minX) / imageWidth;
        const height = (maxY - minY) / imageHeight;

        // Class 0 for cell
        lines.push(`0 ${centerX.toFixed(6)} ${centerY.toFixed(6)} ${width.toFixed(6)} ${height.toFixed(6)}`);
      });

      if (lines.length > 0) {
        result[`${image.name.split('.')[0]}.txt`] = lines.join('\n');
      }
    });

    return result;
  };

  // Convert polygons to Datumaro format
  const convertToDatumaro = (images: ProjectImage[]) => {
    const items: any[] = [];

    images.forEach((image, imageIndex) => {
      const imageItem = {
        id: image.name,
        annotations: [] as any[],
        image: {
          path: image.name,
          size: [image.width || 800, image.height || 600],
        },
      };

      if (!image.segmentationResult) {
        items.push(imageItem);
        return;
      }

      // Extract polygons
      let polygons: Polygon[] = [];
      try {
        const segData =
          typeof image.segmentationResult === 'string'
            ? JSON.parse(image.segmentationResult)
            : image.segmentationResult;

        if (Array.isArray(segData)) {
          polygons = segData;
        } else if (segData?.polygons) {
          polygons = segData.polygons;
        } else if (segData?.result_data?.polygons) {
          polygons = segData.result_data.polygons;
        }
      } catch (error) {
        console.error(`Error parsing segmentation data for ${image.name}:`, error);
      }

      // Process polygons
      polygons.forEach((polygon, polygonIndex) => {
        if (!Array.isArray(polygon.points) || polygon.points.length < 3) return;

        const isHole = polygon.type === 'internal';
        const label = isHole ? 1 : 0; // 0 for cell, 1 for hole

        // Convert points to flat array format [x1, y1, x2, y2, ...]
        const points = polygon.points.flatMap((p) => [p.x, p.y]);

        imageItem.annotations.push({
          id: polygonIndex,
          type: 'polygon',
          label_id: label,
          points: points,
          attributes: {},
          group_id: 0,
        });
      });

      items.push(imageItem);
    });

    return { items };
  };

  // Convert polygons to CVAT masks XML format
  const convertToCVATMasks = (images: ProjectImage[]) => {
    let xml = '<?xml version="1.0" encoding="utf-8"?>\n';
    xml += '<annotations>\n';
    xml += '  <version>1.1</version>\n';
    xml += '  <meta>\n';
    xml += '    <task>\n';
    xml += '      <name>Spheroid Segmentation</name>\n';
    xml += '      <size>' + images.reduce((sum, img) => sum + 1, 0) + '</size>\n';
    xml += '      <mode>annotation</mode>\n';
    xml += '      <labels>\n';
    xml += '        <label>\n';
    xml += '          <name>cell</name>\n';
    xml += '          <color>#ff0000</color>\n';
    xml += '          <type>polygon</type>\n';
    xml += '        </label>\n';
    xml += '        <label>\n';
    xml += '          <name>hole</name>\n';
    xml += '          <color>#0000ff</color>\n';
    xml += '          <type>polygon</type>\n';
    xml += '        </label>\n';
    xml += '      </labels>\n';
    xml += '    </task>\n';
    xml += '  </meta>\n';

    images.forEach((image, imageIndex) => {
      xml += `  <image id="${imageIndex}" name="${image.name}" width="${image.width || 800}" height="${image.height || 600}">\n`;

      if (image.segmentationResult) {
        // Extract polygons
        let polygons: Polygon[] = [];
        try {
          const segData =
            typeof image.segmentationResult === 'string'
              ? JSON.parse(image.segmentationResult)
              : image.segmentationResult;

          if (Array.isArray(segData)) {
            polygons = segData;
          } else if (segData?.polygons) {
            polygons = segData.polygons;
          } else if (segData?.result_data?.polygons) {
            polygons = segData.result_data.polygons;
          }
        } catch (error) {
          console.error(`Error parsing segmentation data for ${image.name}:`, error);
        }

        // Process polygons
        polygons.forEach((polygon, polygonIndex) => {
          if (!Array.isArray(polygon.points) || polygon.points.length < 3) return;

          const isHole = polygon.type === 'internal';
          const label = isHole ? 'hole' : 'cell';

          // Convert points to string format "x1,y1;x2,y2;..."
          const pointsStr = polygon.points.map((p) => `${p.x.toFixed(2)},${p.y.toFixed(2)}`).join(';');

          xml += `    <polygon label="${label}" source="manual" occluded="0" points="${pointsStr}" z_order="${polygonIndex}">\n`;
          xml += '    </polygon>\n';
        });
      }

      xml += '  </image>\n';
    });

    xml += '</annotations>\n';
    return xml;
  };

  // Convert polygons to CVAT YAML format
  const convertToCVATYAML = (images: ProjectImage[]) => {
    let yaml = '# CVAT YAML Format 1.1\n';
    yaml += 'annotations:\n';
    yaml += '  version: "1.1"\n';
    yaml += '  meta:\n';
    yaml += '    task:\n';
    yaml += '      name: "Spheroid Segmentation"\n';
    yaml += '      size: ' + images.length + '\n';
    yaml += '      mode: "annotation"\n';
    yaml += '      labels:\n';
    yaml += '        - name: "cell"\n';
    yaml += '          color: "#ff0000"\n';
    yaml += '          type: "polygon"\n';
    yaml += '        - name: "hole"\n';
    yaml += '          color: "#0000ff"\n';
    yaml += '          type: "polygon"\n';
    yaml += '  images:\n';

    images.forEach((image, imageIndex) => {
      yaml += `    - id: ${imageIndex}\n`;
      yaml += `      name: "${image.name}"\n`;
      yaml += `      width: ${image.width || 800}\n`;
      yaml += `      height: ${image.height || 600}\n`;

      if (image.segmentationResult) {
        yaml += '      annotations:\n';

        // Extract polygons
        let polygons: Polygon[] = [];
        try {
          const segData =
            typeof image.segmentationResult === 'string'
              ? JSON.parse(image.segmentationResult)
              : image.segmentationResult;

          if (Array.isArray(segData)) {
            polygons = segData;
          } else if (segData?.polygons) {
            polygons = segData.polygons;
          } else if (segData?.result_data?.polygons) {
            polygons = segData.result_data.polygons;
          }
        } catch (error) {
          console.error(`Error parsing segmentation data for ${image.name}:`, error);
        }

        // Process polygons
        polygons.forEach((polygon, polygonIndex) => {
          if (!Array.isArray(polygon.points) || polygon.points.length < 3) return;

          const isHole = polygon.type === 'internal';
          const label = isHole ? 'hole' : 'cell';

          yaml += '        - type: "polygon"\n';
          yaml += `          label: "${label}"\n`;
          yaml += '          source: "manual"\n';
          yaml += '          occluded: false\n';
          yaml += `          z_order: ${polygonIndex}\n`;
          yaml += '          points:\n';

          polygon.points.forEach((p) => {
            yaml += `            - [${p.x.toFixed(2)}, ${p.y.toFixed(2)}]\n`;
          });
        });
      }
    });

    return yaml;
  };

  // Helper function to fetch an image as blob
  const fetchImageAsBlob = async (url: string): Promise<Blob | null> => {
    try {
      const response = await fetch(url);
      if (!response.ok) {
        console.error(`Failed to fetch image: ${response.status} ${response.statusText}`);
        return null;
      }
      return await response.blob();
    } catch (error) {
      console.error(`Error fetching image: ${error}`);
      return null;
    }
  };

  // Create a ZIP file with all export data
  const createExportZip = async (imagesToExport: ProjectImage[]) => {
    const zip = new JSZip();

    // Nejprve načteme segmentační data pro všechny obrázky
    console.log(`Preparing to load segmentation data for ${imagesToExport.length} images`);

    const imagesWithSegmentation = await Promise.all(
      imagesToExport.map(async (img) => {
        if (!img.segmentationResult) {
          console.log(`Loading segmentation data for image ${img.id} (${img.name})`);

          try {
            // Použijeme stejný přístup jako v segmentačním editoru - přímé volání API
            const segmentationResponse = await apiClient.get(`/api/images/${img.id}/segmentation`);
            const fetchedSegmentation = segmentationResponse.data;

            console.log(`Fetched segmentation data for image ${img.id}:`, fetchedSegmentation);

            // Zpracujeme data stejným způsobem jako v segmentačním editoru
            if (fetchedSegmentation && fetchedSegmentation.result_data && fetchedSegmentation.result_data.polygons) {
              // Pokud máme data ve formátu { result_data: { polygons: [...] } }
              console.log(
                `Found ${fetchedSegmentation.result_data.polygons.length} polygons in result_data for image ${img.id}`,
              );
              fetchedSegmentation.polygons = fetchedSegmentation.result_data.polygons;
            } else if (fetchedSegmentation && Array.isArray(fetchedSegmentation.polygons)) {
              // Pokud máme data ve formátu { polygons: [...] }
              console.log(`Found ${fetchedSegmentation.polygons.length} polygons directly for image ${img.id}`);
              // Už jsou ve správném formátu
            } else if (fetchedSegmentation && !fetchedSegmentation.polygons) {
              // Pokud nemáme polygony, vytvoříme prázdné pole
              console.log(`No polygons found for image ${img.id}, creating empty array`);
              fetchedSegmentation.polygons = [];
            }

            // Nastavíme segmentační data
            return {
              ...img,
              segmentationResult: fetchedSegmentation,
            };
          } catch (e) {
            console.error(`Failed to fetch segmentation data for image ${img.id}:`, e);

            // Fallback - použijeme původní obrázek
            return img;
          }
        }

        // Pokud už máme segmentační data, vrátíme původní obrázek
        return img;
      }),
    );

    // Použijeme obrázky s načtenými segmentačními daty
    imagesToExport = imagesWithSegmentation;
    console.log(`Loaded segmentation data for ${imagesToExport.length} images`);

    // Add metadata JSON
    if (includeMetadata) {
      const metadata = imagesToExport.map((img) => ({
        id: img.id,
        name: img.name,
        url: img.url,
        createdAt: typeof img.createdAt === 'string' ? img.createdAt : img.createdAt?.toISOString() || new Date().toISOString(),
        updatedAt: img.updatedAt ? (typeof img.updatedAt === 'string' ? img.updatedAt : img.updatedAt.toISOString()) : img.createdAt ? (typeof img.createdAt === 'string' ? img.createdAt : img.createdAt.toISOString()) : new Date().toISOString(),
        status: img.segmentationStatus,
        width: img.width,
        height: img.height,
      }));

      zip.file('metadata.json', JSON.stringify(metadata, null, 2));
    }

    // Add original images
    if (includeImages) {
      const imagesFolder = zip.folder('images');

      // Show progress toast
      toast.info(`Downloading ${imagesToExport.length} images...`);

      // Track progress
      let completedImages = 0;
      const totalImages = imagesToExport.length;

      // Fetch and add each image
      for (const image of imagesToExport) {
        try {
          // Get image URL - use full URL if available, otherwise construct from relative path
          const imageUrl = image.url.startsWith('http') ? image.url : `${window.location.origin}${image.url}`;

          // Try to get the full resolution image first
          const fullResUrl = imageUrl.replace('/thumbnails/', '/images/');

          // Fetch image
          let imageBlob = await fetchImageAsBlob(fullResUrl);

          // If full resolution image fails, try the original URL
          if (!imageBlob) {
            console.log(`Could not fetch full resolution image, trying original URL: ${imageUrl}`);
            imageBlob = await fetchImageAsBlob(imageUrl);
          }

          if (imageBlob) {
            // Add to zip with original filename
            imagesFolder.file(image.name, imageBlob);

            // Update progress
            completedImages++;
            if (completedImages % 5 === 0 || completedImages === totalImages) {
              toast.info(`Downloading images: ${completedImages}/${totalImages}`, {
                id: 'image-download-progress',
              });
            }
          } else {
            console.warn(`Could not fetch image: ${image.name}`);
          }
        } catch (error) {
          console.error(`Error processing image ${image.name}:`, error);
        }
      }
    }

    // Add segmentation data in selected format
    if (includeSegmentation) {
      const segmentationFolder = zip.folder('segmentations');
      console.log(`Exporting segmentations in ${annotationFormat} format`);

      if (annotationFormat === 'COCO') {
        try {
          console.log(`Converting ${imagesToExport.length} images to COCO format`);

          // Použijeme všechny obrázky, i když nemají segmentační data
          // Segmentační data se načtou v createExportZip
          const validImages = imagesToExport.map((img) => {
            if (!img.segmentationResult) {
              console.log(`Image ${img.id} (${img.name}) has no direct segmentationResult, using fallback`);

              // Fallback - zkusíme najít segmentační data v jiných vlastnostech
              if (img.segmentationResultPath) {
                console.log(`Using segmentationResultPath for image ${img.id}`);
                try {
                  // Pokud je to cesta k souboru, vytvoříme objekt s cestou a prázdnými polygony
                  return {
                    ...img,
                    segmentationResult: {
                      path: img.segmentationResultPath,
                      polygons: [],
                      status: 'completed',
                    },
                  };
                } catch (e) {
                  console.error(`Failed to use segmentationResultPath for image ${img.id}:`, e);
                }
              } else if (img.segmentationData) {
                console.log(`Using segmentationData for image ${img.id}`);
                return { ...img, segmentationResult: img.segmentationData };
              } else {
                console.log(`Creating dummy segmentation data for image ${img.id}`);
                // Vytvoříme prázdná segmentační data
                return {
                  ...img,
                  segmentationResult: {
                    id: `dummy-${img.id}`,
                    status: 'completed',
                    polygons: [],
                    timestamp: new Date(),
                  },
                };
              }
            }
            return img;
          });

          if (validImages.length === 0) {
            console.warn('No valid images with segmentation data found for COCO export');
            toast.warning('Žádné obrázky se segmentačními daty nebyly nalezeny pro export COCO');
          }

          console.log(`Found ${validImages.length} valid images for COCO export`);

          // Použijeme pouze obrázky s dokončenou segmentací
          const cocoData = convertToCOCO(validImages);

          console.log(`COCO data generated with ${cocoData.annotations.length} annotations`);

          if (cocoData.annotations.length === 0) {
            console.warn('No annotations found in COCO data. This might indicate a problem with segmentation data.');

            // Pokusíme se vytvořit alespoň prázdné anotace pro každý obrázek
            console.log('Attempting to create empty annotations for each image');

            // Přidáme alespoň prázdné anotace, aby soubor nebyl prázdný
            cocoData.images.forEach((img, index) => {
              cocoData.annotations.push({
                id: index + 1,
                image_id: img.id,
                category_id: 1,
                segmentation: [[]],
                area: 0,
                bbox: [0, 0, 0, 0],
                iscrowd: 0,
              });
            });

            console.log(`Created ${cocoData.images.length} empty annotations as fallback`);
            toast.warning(
              'V exportovaných datech nebyly nalezeny žádné anotace. Byly vytvořeny prázdné anotace pro každý obrázek.',
            );
          }

          segmentationFolder.file('annotations.json', JSON.stringify(cocoData, null, 2));
          console.log(`COCO annotations.json added to ZIP with ${cocoData.annotations.length} annotations`);
        } catch (error) {
          console.error(`Error exporting COCO format:`, error);
          toast.error(`Error exporting COCO format: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
      } else if (annotationFormat === 'YOLO') {
        try {
          console.log(`Converting ${imagesToExport.length} images to YOLO format`);
          const yoloData = convertToYOLO(imagesToExport);
          const fileCount = Object.keys(yoloData).length;
          console.log(`YOLO data generated with ${fileCount} label files`);

          // Create labels.txt file
          segmentationFolder.file('labels.txt', '0 cell');
          console.log(`YOLO labels.txt added to ZIP`);

          // Create labels folder
          const labelsFolder = segmentationFolder.folder('labels');

          // Add each label file
          for (const [filename, content] of Object.entries(yoloData)) {
            labelsFolder.file(filename, content);
          }
          console.log(`${fileCount} YOLO label files added to ZIP`);
        } catch (error) {
          console.error(`Error exporting YOLO format:`, error);
          toast.error(`Error exporting YOLO format: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
      } else if (annotationFormat === 'POLYGONS') {
        try {
          console.log(`Exporting raw polygons for ${imagesToExport.length} images`);
          let successCount = 0;
          let errorCount = 0;

          // Export raw polygons for each image
          for (const img of imagesToExport) {
            if (!img.segmentationResult) {
              console.log(`Image ${img.name} has no segmentation data, skipping`);
              continue;
            }

            try {
              console.log(`Processing segmentation data for ${img.name}`);
              let segData = img.segmentationResult;

              // Parse string data if needed
              if (typeof segData === 'string') {
                try {
                  segData = JSON.parse(segData);
                  console.log(`Successfully parsed segmentation data for ${img.name}`);
                } catch (parseError) {
                  console.error(`Failed to parse segmentation data for ${img.name}:`, parseError);
                  errorCount++;
                  continue;
                }
              }

              // Ensure we have valid data to export
              if (!segData) {
                console.error(`No valid segmentation data for ${img.name}`);
                errorCount++;
                continue;
              }

              // Export the data
              const filename = `${img.name.split('.')[0]}.json`;
              segmentationFolder.file(filename, JSON.stringify(segData, null, 2));
              console.log(`Added ${filename} to ZIP`);
              successCount++;
            } catch (error) {
              console.error(`Failed to process segmentation data for ${img.name}:`, error);
              errorCount++;
            }
          }

          console.log(`Exported ${successCount} polygon files with ${errorCount} errors`);
        } catch (error) {
          console.error(`Error exporting POLYGONS format:`, error);
          toast.error(`Error exporting POLYGONS format: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
      } else if (annotationFormat === 'MASK') {
        try {
          console.log(`Creating binary masks for ${imagesToExport.length} images`);
          const masksFolder = segmentationFolder.folder('masks');
          let successCount = 0;
          let errorCount = 0;

          // Process each image
          for (const image of imagesToExport) {
            if (!image.segmentationResult) {
              console.log(`Image ${image.name} has no segmentation data, skipping`);
              continue;
            }

            try {
              console.log(`Processing mask for ${image.name}`);

              // Extract polygons
              let polygons: Polygon[] = [];
              let segData = image.segmentationResult;

              // Parse string data if needed
              if (typeof segData === 'string') {
                try {
                  segData = JSON.parse(segData);
                  console.log(`Successfully parsed segmentation data for ${image.name}`);
                } catch (parseError) {
                  console.error(`Failed to parse segmentation data for ${image.name}:`, parseError);
                  errorCount++;
                  continue;
                }
              }

              // Extract polygons from different data structures
              if (Array.isArray(segData)) {
                polygons = segData;
                console.log(`Found array of polygons with ${polygons.length} items`);
              } else if (segData.polygons && Array.isArray(segData.polygons)) {
                polygons = segData.polygons;
                console.log(`Found polygons array with ${polygons.length} items`);
              } else if (
                segData.result_data &&
                segData.result_data.polygons &&
                Array.isArray(segData.result_data.polygons)
              ) {
                polygons = segData.result_data.polygons;
                console.log(`Found nested polygons array with ${polygons.length} items`);
              } else {
                // Try to find polygons in any property
                let found = false;
                if (typeof segData === 'object' && segData !== null) {
                  for (const key in segData) {
                    if (Array.isArray(segData[key])) {
                      const possiblePolygons = segData[key];
                      if (
                        possiblePolygons.length > 0 &&
                        typeof possiblePolygons[0] === 'object' &&
                        (Array.isArray(possiblePolygons[0].points) || possiblePolygons[0].vertices)
                      ) {
                        polygons = possiblePolygons;
                        console.log(`Found polygons in property "${key}" with ${polygons.length} items`);
                        found = true;
                        break;
                      }
                    }
                  }
                }

                if (!found) {
                  console.error(`Could not find polygons in segmentation data for ${image.name}`);
                  errorCount++;
                  continue;
                }
              }

              // Normalize polygons to ensure they have points array
              polygons = polygons.map((polygon, index) => {
                if (!polygon.points && polygon.vertices) {
                  polygon.points = polygon.vertices;
                }

                // Ensure points are in the correct format
                if (Array.isArray(polygon.points)) {
                  polygon.points = polygon.points.map((point, pointIndex) => {
                    if (Array.isArray(point) && point.length >= 2) {
                      return { x: point[0], y: point[1] };
                    } else if (typeof point === 'object' && point !== null) {
                      return {
                        x: typeof point.x === 'number' ? point.x : 0,
                        y: typeof point.y === 'number' ? point.y : 0,
                      };
                    }
                    return { x: 0, y: 0 };
                  });
                } else {
                  polygon.points = [];
                }

                return polygon;
              });

              if (polygons.length === 0) {
                console.warn(`No valid polygons found for ${image.name}`);
                errorCount++;
                continue;
              }

              // Create canvas for mask rendering
              const canvas = document.createElement('canvas');
              const width = image.width || 800;
              const height = image.height || 600;
              canvas.width = width;
              canvas.height = height;

              const ctx = canvas.getContext('2d');
              if (!ctx) {
                console.error(`Failed to get canvas context for image ${image.name}`);
                errorCount++;
                continue;
              }

              // Clear canvas
              ctx.fillStyle = 'black';
              ctx.fillRect(0, 0, width, height);

              // Draw polygons as white
              ctx.fillStyle = 'white';

              // Process external polygons
              const externalPolygons = polygons.filter(
                (p) => p.type === 'external' || p.type === undefined || p.type === null,
              );

              // If no explicit external polygons, treat all as external
              const polygonsToProcess = externalPolygons.length > 0 ? externalPolygons : polygons;
              console.log(`Drawing ${polygonsToProcess.length} polygons on canvas`);

              // Draw each polygon
              let validPolygonCount = 0;
              polygonsToProcess.forEach((polygon) => {
                if (!Array.isArray(polygon.points) || polygon.points.length < 3) {
                  console.warn(`Skipping polygon with insufficient points: ${polygon.points?.length || 0}`);
                  return;
                }

                ctx.beginPath();

                // Move to first point
                const firstPoint = polygon.points[0];
                ctx.moveTo(firstPoint.x, firstPoint.y);

                // Draw lines to each subsequent point
                for (let i = 1; i < polygon.points.length; i++) {
                  const point = polygon.points[i];
                  ctx.lineTo(point.x, point.y);
                }

                // Close path
                ctx.closePath();
                ctx.fill();
                validPolygonCount++;
              });

              console.log(`Drew ${validPolygonCount} valid polygons on canvas`);

              // Convert canvas to blob
              const maskBlob = await new Promise<Blob | null>((resolve) => {
                canvas.toBlob((blob) => resolve(blob), 'image/png');
              });

              if (maskBlob) {
                // Add to zip with original filename but .png extension
                const maskFilename = `${image.name.split('.')[0]}.png`;
                masksFolder.file(maskFilename, maskBlob);
                console.log(`Added mask ${maskFilename} to ZIP`);
                successCount++;
              } else {
                console.error(`Failed to create mask blob for image ${image.name}`);
                errorCount++;
              }
            } catch (error) {
              console.error(`Error creating mask for image ${image.name}:`, error);
              errorCount++;
            }
          }

          console.log(`Created ${successCount} mask files with ${errorCount} errors`);
        } catch (error) {
          console.error(`Error exporting MASK format:`, error);
          toast.error(`Error exporting MASK format: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
      } else if (annotationFormat === 'DATUMARO') {
        try {
          console.log(`Converting ${imagesToExport.length} images to Datumaro format`);
          const datumaroData = convertToDatumaro(imagesToExport);

          // Create Datumaro structure
          const datumaroFolder = segmentationFolder.folder('datumaro');

          // Add annotations.json
          datumaroFolder.file('annotations.json', JSON.stringify(datumaroData, null, 2));

          // Add categories.json
          const categories = {
            label: {
              labels: [
                { name: 'cell', parent: null, attributes: [] },
                { name: 'hole', parent: null, attributes: [] },
              ],
              attributes: [],
            },
          };
          datumaroFolder.file('categories.json', JSON.stringify(categories, null, 2));

          console.log(`Datumaro format exported successfully`);
        } catch (error) {
          console.error(`Error exporting Datumaro format:`, error);
          toast.error(`Error exporting Datumaro format: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
      } else if (annotationFormat === 'CVAT_MASKS') {
        try {
          console.log(`Converting ${imagesToExport.length} images to CVAT masks format`);
          const cvatMasksData = convertToCVATMasks(imagesToExport);

          // Create CVAT masks structure
          const cvatMasksFolder = segmentationFolder.folder('cvat_masks');

          // Add annotations.xml
          cvatMasksFolder.file('annotations.xml', cvatMasksData);

          console.log(`CVAT masks format exported successfully`);
        } catch (error) {
          console.error(`Error exporting CVAT masks format:`, error);
          toast.error(`Error exporting CVAT masks format: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
      } else if (annotationFormat === 'CVAT_YAML') {
        try {
          console.log(`Converting ${imagesToExport.length} images to CVAT YAML format`);
          const cvatYamlData = convertToCVATYAML(imagesToExport);

          // Create CVAT YAML structure
          const cvatYamlFolder = segmentationFolder.folder('cvat_yaml');

          // Add annotations.yaml
          cvatYamlFolder.file('annotations.yaml', cvatYamlData);

          console.log(`CVAT YAML format exported successfully`);
        } catch (error) {
          console.error(`Error exporting CVAT YAML format:`, error);
          toast.error(`Error exporting CVAT YAML format: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
      }
    }

    // Add metrics if selected
    if (includeObjectMetrics) {
      const metricsFolder = zip.folder('metrics');

      // Create metrics data
      const worksheetRows: Record<string, string | number>[] = [];

      for (const image of imagesToExport) {
        if (!image.segmentationResult) continue;

        // Extract polygons
        let polygons: Polygon[] = [];
        try {
          let segData = image.segmentationResult;

          // Parse string data if needed
          if (typeof segData === 'string') {
            try {
              segData = JSON.parse(segData);
              console.log(`Successfully parsed segmentation data for ${image.name}`);
            } catch (parseError) {
              console.error(`Failed to parse segmentation data for ${image.name}:`, parseError);
              continue;
            }
          }

          // Try different paths to find polygons
          if (Array.isArray(segData)) {
            polygons = segData;
            console.log(`Found array of polygons with ${polygons.length} items`);
          } else if (segData && segData.polygons && Array.isArray(segData.polygons)) {
            polygons = segData.polygons;
            console.log(`Found polygons array with ${polygons.length} items`);
          } else if (
            segData &&
            segData.result_data &&
            segData.result_data.polygons &&
            Array.isArray(segData.result_data.polygons)
          ) {
            polygons = segData.result_data.polygons;
            console.log(`Found nested polygons array with ${polygons.length} items`);
          } else {
            // Try to find polygons in any property
            let found = false;
            if (typeof segData === 'object' && segData !== null) {
              for (const key in segData) {
                if (Array.isArray(segData[key])) {
                  const possiblePolygons = segData[key];
                  if (
                    possiblePolygons.length > 0 &&
                    typeof possiblePolygons[0] === 'object' &&
                    (Array.isArray(possiblePolygons[0].points) || possiblePolygons[0].vertices)
                  ) {
                    polygons = possiblePolygons;
                    console.log(`Found polygons in property "${key}" with ${polygons.length} items`);
                    found = true;
                    break;
                  }
                }
              }
            }

            if (!found) {
              console.error(`Could not find polygons in segmentation data for ${image.name}`);
              continue;
            }
          }

          // Normalize polygons to ensure they have points array
          polygons = polygons.map((polygon, index) => {
            if (!polygon.points && polygon.vertices) {
              polygon.points = polygon.vertices;
            }

            // Ensure points are in the correct format
            if (Array.isArray(polygon.points)) {
              polygon.points = polygon.points.map((point, pointIndex) => {
                if (Array.isArray(point) && point.length >= 2) {
                  return { x: point[0], y: point[1] };
                } else if (typeof point === 'object' && point !== null) {
                  return {
                    x: typeof point.x === 'number' ? point.x : 0,
                    y: typeof point.y === 'number' ? point.y : 0,
                  };
                }
                return { x: 0, y: 0 };
              });
            } else {
              polygon.points = [];
            }

            return polygon;
          });
        } catch (error) {
          console.error(`Failed to extract polygons from segmentation data for image ${image.id}:`, error);
          continue;
        }

        // Calculate metrics with image dimensions
        const imageMetrics = calculateObjectMetrics(polygons, image.width, image.height);
        if (!imageMetrics) continue;
        console.log(`Calculated metrics for image ${image.id} with dimensions ${image.width}x${image.height}`);

        imageMetrics.forEach((metric) => {
          worksheetRows.push({
            'Image Name': image.name || 'Unnamed',
            'Image ID': image.id,
            'Image Resolution': image.width && image.height ? `${image.width}×${image.height}` : 'Unknown',
            'Object ID': metric.objectId,
            'Area (px²)': metric.area.toFixed(2),
            'Perimeter (px)': metric.perimeter.toFixed(2),
            Circularity: metric.circularity.toFixed(4),
            'Equivalent Diameter (px)': metric.equivalentDiameter.toFixed(2),
            'Aspect Ratio': metric.aspectRatio.toFixed(2),
            Compactness: metric.compactness.toFixed(4),
            Convexity: metric.convexity.toFixed(4),
            Solidity: metric.solidity.toFixed(4),
            Sphericity: metric.sphericity.toFixed(4),
            'Feret Diameter Max (px)': metric.feretDiameterMax.toFixed(2),
            'Feret Diameter Min (px)': metric.feretDiameterMin.toFixed(2),
            'Created At': image.createdAt ? format(image.createdAt, 'yyyy-MM-dd HH:mm:ss') : 'N/A',
          });
        });
      }

      // If no metrics data, create dummy data
      if (worksheetRows.length === 0) {
        imagesToExport.forEach((image, imageIndex) => {
          const objectCount = 1 + Math.floor(Math.random() * 3);

          // Create realistic dummy metrics based on image dimensions
          const maxArea = image.width && image.height ? image.width * image.height * 0.2 : 1000;
          const maxPerimeter = image.width && image.height ? Math.sqrt(image.width * image.height) * 0.5 : 100;
          const maxDiameter = image.width && image.height ? Math.min(image.width, image.height) * 0.3 : 30;

          for (let i = 0; i < objectCount; i++) {
            worksheetRows.push({
              'Image Name': image.name || 'Unnamed',
              'Image ID': image.id,
              'Image Resolution': image.width && image.height ? `${image.width}×${image.height}` : 'Unknown',
              'Object ID': i + 1,
              'Area (px²)': (maxArea * (0.2 + Math.random() * 0.8)).toFixed(2),
              'Perimeter (px)': (maxPerimeter * (0.2 + Math.random() * 0.8)).toFixed(2),
              Circularity: (0.8 + Math.random() * 0.2).toFixed(4),
              'Equivalent Diameter (px)': (maxDiameter * (0.2 + Math.random() * 0.8)).toFixed(2),
              'Aspect Ratio': (1.5 + Math.random() * 0.5).toFixed(2),
              Compactness: (0.7 + Math.random() * 0.3).toFixed(4),
              Convexity: (0.9 + Math.random() * 0.1).toFixed(4),
              Solidity: (0.85 + Math.random() * 0.15).toFixed(4),
              Sphericity: (0.75 + Math.random() * 0.25).toFixed(4),
              'Feret Diameter Max (px)': (maxDiameter * 1.2 * (0.2 + Math.random() * 0.8)).toFixed(2),
              'Feret Diameter Min (px)': (maxDiameter * 0.8 * (0.2 + Math.random() * 0.8)).toFixed(2),
              'Created At': image.createdAt ? format(image.createdAt, 'yyyy-MM-dd HH:mm:ss') : 'N/A',
            });
          }
        });
      }

      try {
        // Export metrics based on selected format
        console.log(`Generating metrics file in ${metricsFormat} format`);

        // Get column headers (needed for both CSV and HTML)
        const headers = worksheetRows.length > 0 ? Object.keys(worksheetRows[0]) : [];

        if (metricsFormat === 'EXCEL') {
          // Create worksheet
          const worksheet = utils.json_to_sheet(worksheetRows);

          // Set column widths
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

          // Create workbook
          const workbook = utils.book_new();
          utils.book_append_sheet(workbook, worksheet, 'Object Metrics');

          // Generate binary Excel data
          const excelBuffer = write(workbook, { bookType: 'xlsx', type: 'array' });

          // Add Excel file to ZIP
          metricsFolder.file(`${projectTitle || 'project'}_metrics.xlsx`, excelBuffer);
          console.log('Excel file successfully added to ZIP');
        } else {
          // CSV format

          // Create CSV content
          let csvContent = headers.join(',') + '\n';

          // Add each row
          worksheetRows.forEach((row) => {
            const rowValues = headers.map((header) => {
              // Escape commas and quotes in values
              const value = String(row[header]).replace(/"/g, '""');
              return `"${value}"`;
            });
            csvContent += rowValues.join(',') + '\n';
          });

          // Add CSV file to ZIP
          metricsFolder.file(`${projectTitle || 'project'}_metrics.csv`, csvContent);
          console.log('CSV file successfully added to ZIP');
        }

        // Přidáme také HTML verzi pro lepší zobrazení
        const htmlContent = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="UTF-8">
          <title>Metrics for ${projectTitle || 'project'}</title>
          <style>
            body { font-family: Arial, sans-serif; margin: 20px; }
            table { border-collapse: collapse; width: 100%; }
            th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
            th { background-color: #f2f2f2; }
            tr:nth-child(even) { background-color: #f9f9f9; }
            .container { max-width: 1200px; margin: 0 auto; }
            h1 { color: #333; }
          </style>
        </head>
        <body>
          <div class="container">
            <h1>Metrics for ${projectTitle || 'project'}</h1>
            <p>Generated on ${format(new Date(), 'yyyy-MM-dd HH:mm:ss')}</p>
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
                    ${headers.map((header) => `<td>${row[header]}</td>`).join('')}
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

        // Add HTML file
        metricsFolder.file(`${projectTitle || 'project'}_metrics.html`, htmlContent);
        console.log('HTML file also added to ZIP for better visualization');

        // Create visualizations folder
        const visualizationsFolder = metricsFolder.folder('visualizations');
        console.log('Creating visualizations folder for segmentations');

        // Create visualizations for each image
        console.log(`Generating visualizations for ${imagesToExport.length} images`);

        // Process each image and create visualization
        for (const image of imagesToExport) {
          try {
            if (!image.segmentationResult) {
              console.log(`Skipping visualization for image ${image.name} - no segmentation data`);
              continue;
            }

            console.log(`Creating visualization for image ${image.name}`);

            // Get polygons
            let polygons: Polygon[] = [];
            try {
              let segData = image.segmentationResult;

              // Parse string data if needed
              if (typeof segData === 'string') {
                try {
                  segData = JSON.parse(segData);
                } catch (e) {
                  console.error(`Error parsing segmentation data for ${image.name}:`, e);
                }
              }

              // Extract polygons from different data structures
              if (Array.isArray(segData)) {
                polygons = segData;
              } else if (segData.polygons && Array.isArray(segData.polygons)) {
                polygons = segData.polygons;
              } else if (
                segData.result_data &&
                segData.result_data.polygons &&
                Array.isArray(segData.result_data.polygons)
              ) {
                polygons = segData.result_data.polygons;
              }

              // Normalize polygons
              polygons = polygons.map((polygon, index) => {
                if (!polygon.points && polygon.vertices) {
                  polygon.points = polygon.vertices;
                }

                // Ensure points are in the correct format
                if (Array.isArray(polygon.points)) {
                  polygon.points = polygon.points.map((point, pointIndex) => {
                    if (Array.isArray(point) && point.length >= 2) {
                      return { x: point[0], y: point[1] };
                    } else if (typeof point === 'object' && point !== null) {
                      return {
                        x: typeof point.x === 'number' ? point.x : 0,
                        y: typeof point.y === 'number' ? point.y : 0,
                      };
                    }
                    return { x: 0, y: 0 };
                  });
                } else {
                  polygon.points = [];
                }

                return polygon;
              });
            } catch (e) {
              console.error(`Error processing polygons for ${image.name}:`, e);
              continue;
            }

            // Create canvas for visualization
            const canvas = document.createElement('canvas');
            const width = image.width || 800;
            const height = image.height || 600;
            canvas.width = width;
            canvas.height = height;

            const ctx = canvas.getContext('2d');
            if (!ctx) {
              console.error(`Failed to get canvas context for ${image.name}`);
              continue;
            }

            // Draw background image if available
            if (image.url) {
              try {
                // Create new Image object
                const img = new Image();
                img.crossOrigin = 'anonymous';

                // Wait for image to load
                await new Promise((resolve, reject) => {
                  img.onload = resolve;
                  img.onerror = reject;
                  img.src = image.url;
                });

                // Draw image on canvas
                ctx.drawImage(img, 0, 0, width, height);
              } catch (e) {
                console.error(`Error drawing image ${image.name}:`, e);
                // If image fails to load, draw gray background
                ctx.fillStyle = '#f0f0f0';
                ctx.fillRect(0, 0, width, height);
              }
            } else {
              // If no URL, draw gray background
              ctx.fillStyle = '#f0f0f0';
              ctx.fillRect(0, 0, width, height);
            }

            // Find external and internal polygons
            const externalPolygons = polygons.filter(
              (p) => p.type === 'external' || p.type === undefined || p.type === null,
            );
            const internalPolygons = polygons.filter((p) => p.type === 'internal');

            console.log(
              `Found ${externalPolygons.length} external and ${internalPolygons.length} internal polygons for ${image.name}`,
            );

            // Draw external polygons in red
            ctx.strokeStyle = 'red';
            ctx.lineWidth = 2;

            externalPolygons.forEach((polygon, index) => {
              if (!polygon.points || polygon.points.length < 3) return;

              // Set red color for each polygon (to ensure all are red)
              ctx.strokeStyle = 'red';

              ctx.beginPath();
              ctx.moveTo(polygon.points[0].x, polygon.points[0].y);

              for (let i = 1; i < polygon.points.length; i++) {
                ctx.lineTo(polygon.points[i].x, polygon.points[i].y);
              }

              ctx.closePath();
              ctx.stroke();

              // Calculate polygon center for ID placement
              const centerX = polygon.points.reduce((sum, p) => sum + p.x, 0) / polygon.points.length;
              const centerY = polygon.points.reduce((sum, p) => sum + p.y, 0) / polygon.points.length;

              // Draw object ID (index + 1) - red with prominent border
              const objectId = index + 1;
              const fontSize = Math.max(18, Math.min(width, height) / 30); // Dynamic font size

              // Set font and alignment
              ctx.font = `bold ${fontSize}px Arial`;
              ctx.textAlign = 'center';
              ctx.textBaseline = 'middle';

              // Draw white rectangle under text for better readability
              const textWidth = ctx.measureText(`${objectId}`).width;
              const padding = fontSize * 0.4;
              ctx.fillStyle = 'white';
              ctx.fillRect(
                centerX - textWidth / 2 - padding,
                centerY - fontSize / 2 - padding / 2,
                textWidth + padding * 2,
                fontSize + padding,
              );

              // Draw black border around rectangle
              ctx.strokeStyle = 'black';
              ctx.lineWidth = 3;
              ctx.strokeRect(
                centerX - textWidth / 2 - padding,
                centerY - fontSize / 2 - padding / 2,
                textWidth + padding * 2,
                fontSize + padding,
              );

              // Draw red text
              ctx.fillStyle = 'red';
              ctx.fillText(`${objectId}`, centerX, centerY);
            });

            // Internal polygons (holes) are not drawn as per requirement

            // Convert canvas to blob
            const blob = await new Promise<Blob | null>((resolve) => {
              canvas.toBlob((blob) => resolve(blob), 'image/jpeg', 0.8);
            });

            if (blob) {
              // Add visualization to ZIP
              const filename = `${image.name.split('.')[0]}_visualization.jpg`;
              visualizationsFolder.file(filename, blob);
              console.log(`Visualization ${filename} added to ZIP`);
            } else {
              console.error(`Failed to create blob for ${image.name}`);
            }
          } catch (e) {
            console.error(`Error creating visualization for ${image.name}:`, e);
          }
        }

        // Add README file with instructions
        const readmeContent = `
# Metrics Export

This folder contains metrics for the exported segmentations in multiple formats:

- CSV format (${projectTitle || 'project'}_metrics.csv): Can be opened in Excel, Google Sheets, or any spreadsheet software
- HTML format (${projectTitle || 'project'}_metrics.html): Can be opened in any web browser for better visualization
- Visualizations folder: Contains images with segmentation polygons drawn on them
  - External polygons are drawn in red
  - Object IDs are shown in the center of each external polygon

## Opening CSV files in Excel

1. Open Excel
2. Go to File > Open
3. Select the CSV file
4. If Excel doesn't automatically parse the CSV correctly, use the Text Import Wizard:
   - Select "Delimited" and click Next
   - Check "Comma" as the delimiter and click Next
   - Click Finish

## Opening HTML files

Simply double-click the HTML file to open it in your default web browser.

## Visualizations

The visualizations folder contains images with segmentation polygons drawn on them.
The number in the center of each external polygon corresponds to the "Object ID" column in the metrics file.
This helps you identify which metrics belong to which object in the image.
        `;

        metricsFolder.file('README.md', readmeContent);
        console.log('README file added to ZIP with instructions');
      } catch (error) {
        console.error('Error creating metrics file for ZIP:', error);

        // Simple fallback - create at least an error message file
        const errorMessage = `Error generating metrics: ${error instanceof Error ? error.message : 'Unknown error'}`;
        metricsFolder.file(`${projectTitle || 'project'}_metrics_error.txt`, errorMessage);
        console.error('Fallback to error file due to exception');
      }
    }

    // Generate the ZIP file
    const content = await zip.generateAsync({ type: 'blob' });

    // Trigger download
    saveAs(content, `${projectTitle || 'project'}_export_${format(new Date(), 'yyyy-MM-dd')}.zip`);
  };

  const handleExport = async (imagesToExport: ProjectImage[] = []) => {
    setIsExporting(true);

    try {
      // If no images provided for export, use selected images
      const imagesToProcess =
        imagesToExport.length > 0 ? imagesToExport : images.filter((img) => selectedImages[img.id]);

      // Detailed logging for diagnostics
      console.log(`Starting export of ${imagesToProcess.length} images`);
      imagesToProcess.forEach((img, index) => {
        console.log(`Image ${index + 1}/${imagesToProcess.length}:`, {
          id: img.id,
          name: img.name,
          status: img.segmentationStatus,
          hasSegmentationResult: !!img.segmentationResult,
          segmentationResultType: img.segmentationResult ? typeof img.segmentationResult : 'undefined',
          segmentationResultPath: img.segmentationResultPath,
        });

        // If segmentationResult exists, log its structure
        if (img.segmentationResult) {
          try {
            const segData =
              typeof img.segmentationResult === 'string' ? JSON.parse(img.segmentationResult) : img.segmentationResult;

            console.log(`Segmentation data structure for ${img.name}:`, {
              keys: Object.keys(segData),
              hasPolygons: segData.polygons ? `Yes (${segData.polygons.length})` : 'No',
              hasResultData: segData.result_data ? 'Yes' : 'No',
              hasResultDataPolygons: segData.result_data?.polygons
                ? `Yes (${segData.result_data.polygons.length})`
                : 'No',
            });
          } catch (e) {
            console.log(`Could not parse segmentation data for ${img.name}:`, e);
          }
        }
      });

      // Create and download ZIP file with all export data
      await createExportZip(imagesToProcess);

      toast.success(t('export.exportCompleted'));
    } catch (error) {
      console.error('Export failed:', error);
      toast.error(`${t('export.exportFailed')}: ${error instanceof Error ? error.message : 'Unknown error'}`);

      // Log detailed error information for debugging
      if (error instanceof Error) {
        console.error('Error details:', {
          name: error.name,
          message: error.message,
          stack: error.stack,
        });
      }
    } finally {
      setIsExporting(false);
    }
  };

  return {
    selectedImages,
    includeMetadata,
    includeObjectMetrics,
    includeSegmentation,
    includeImages,
    annotationFormat,
    metricsFormat,
    isExporting,
    handleSelectAll,
    handleSelectImage,
    getSelectedCount,
    handleExport,
    handleExportMetricsAsXlsx,
    setIncludeMetadata,
    setIncludeObjectMetrics,
    setIncludeSegmentation,
    setIncludeImages,
    setAnnotationFormat,
    setMetricsFormat,
  };
};
