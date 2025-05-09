import React from 'react';
import { FileSpreadsheet, Image, FileText } from 'lucide-react';
import { Card, CardHeader, CardContent, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { useLanguage } from '@/contexts/LanguageContext';

export type AnnotationFormat = 'COCO' | 'YOLO' | 'MASK' | 'POLYGONS';
export type MetricsFormat = 'CSV' | 'EXCEL';

interface ExportOptionsCardProps {
  includeMetadata: boolean;
  setIncludeMetadata: (value: boolean) => void;
  includeSegmentation: boolean;
  setIncludeSegmentation: (value: boolean) => void;
  includeObjectMetrics: boolean;
  setIncludeObjectMetrics: (value: boolean) => void;
  includeImages: boolean;
  setIncludeImages: (value: boolean) => void;
  annotationFormat: AnnotationFormat;
  setAnnotationFormat: (value: AnnotationFormat) => void;
  metricsFormat: MetricsFormat;
  setMetricsFormat: (value: MetricsFormat) => void;
  handleExportMetricsAsXlsx: () => void;
  getSelectedCount: () => number;
  isExporting: boolean;
}

const ExportOptionsCard: React.FC<ExportOptionsCardProps> = ({
  includeMetadata,
  setIncludeMetadata,
  includeSegmentation,
  setIncludeSegmentation,
  includeObjectMetrics,
  setIncludeObjectMetrics,
  includeImages,
  setIncludeImages,
  annotationFormat,
  setAnnotationFormat,
  metricsFormat,
  setMetricsFormat,
  handleExportMetricsAsXlsx,
  getSelectedCount,
  isExporting
}) => {
  const { t } = useLanguage();
  
  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('export.title')}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div className="flex items-center space-x-2">
            <Checkbox
              id="include-metadata"
              checked={includeMetadata}
              onCheckedChange={() => setIncludeMetadata(!includeMetadata)}
            />
            <Label htmlFor="include-metadata">{t('export.options.includeMetadata')}</Label>
          </div>
          <div className="flex items-center space-x-2">
            <Checkbox
              id="include-segmentation"
              checked={includeSegmentation}
              onCheckedChange={() => setIncludeSegmentation(!includeSegmentation)}
            />
            <Label htmlFor="include-segmentation">{t('export.options.includeSegmentation')}</Label>
          </div>

          {includeSegmentation && (
            <div className="ml-6 mt-2">
              <Label htmlFor="annotation-format" className="text-sm mb-1 block">
                {t('export.options.selectExportFormat')}:
              </Label>
              <Select
                value={annotationFormat}
                onValueChange={(value) => setAnnotationFormat(value as AnnotationFormat)}
              >
                <SelectTrigger id="annotation-format" className="w-full">
                  <SelectValue placeholder={t('export.options.selectExportFormat')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="COCO">{t('export.formats.COCO')}</SelectItem>
                  <SelectItem value="YOLO">{t('export.formats.YOLO')}</SelectItem>
                  <SelectItem value="MASK">{t('export.formats.MASK')}</SelectItem>
                  <SelectItem value="POLYGONS">{t('export.formats.POLYGONS')}</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-gray-500 mt-1">
                {annotationFormat === 'COCO' && t('export.formatDescriptions.COCO')}
                {annotationFormat === 'YOLO' && t('export.formatDescriptions.YOLO')}
                {annotationFormat === 'MASK' && t('export.formatDescriptions.MASK')}
                {annotationFormat === 'POLYGONS' && t('export.formatDescriptions.POLYGONS')}
              </p>
            </div>
          )}
          <div className="flex items-center space-x-2">
            <Checkbox
              id="include-object-metrics"
              checked={includeObjectMetrics}
              onCheckedChange={() => setIncludeObjectMetrics(!includeObjectMetrics)}
            />
            <Label htmlFor="include-object-metrics">{t('export.options.includeObjectMetrics')}</Label>
          </div>

          {includeObjectMetrics && (
            <div className="ml-6 mt-2">
              <Label htmlFor="metrics-format" className="text-sm mb-1 block">
                {t('export.options.selectMetricsFormat')}:
              </Label>
              <Select
                value={metricsFormat}
                onValueChange={(value) => setMetricsFormat(value as MetricsFormat)}
              >
                <SelectTrigger id="metrics-format" className="w-full">
                  <SelectValue placeholder={t('export.options.selectMetricsFormat')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="EXCEL">
                    <div className="flex items-center">
                      <FileSpreadsheet className="mr-2 h-4 w-4" />
                      <span>{t('export.metricsFormats.EXCEL')}</span>
                    </div>
                  </SelectItem>
                  <SelectItem value="CSV">
                    <div className="flex items-center">
                      <FileText className="mr-2 h-4 w-4" />
                      <span>{t('export.metricsFormats.CSV')}</span>
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-gray-500 mt-1">
                {metricsFormat === 'EXCEL' && t('export.options.metricsFormatDescription.EXCEL')}
                {metricsFormat === 'CSV' && t('export.options.metricsFormatDescription.CSV')}
              </p>
            </div>
          )}

          <div className="flex items-center space-x-2 mt-2">
            <Checkbox
              id="include-images"
              checked={includeImages}
              onCheckedChange={() => setIncludeImages(!includeImages)}
            />
            <Label htmlFor="include-images" className="flex items-center">
              <span>{t('export.options.includeImages')}</span>
              <Image className="ml-1 h-4 w-4" />
            </Label>
          </div>

          {includeObjectMetrics && (
            <div className="mt-4 space-y-4">
              <Button
                variant="outline"
                size="sm"
                className="flex items-center w-full"
                onClick={handleExportMetricsAsXlsx}
                disabled={getSelectedCount() === 0 || isExporting}
              >
                <FileSpreadsheet className="mr-2 h-4 w-4" />
                {t('export.options.exportMetricsOnly')}
              </Button>
              {getSelectedCount() === 0 && (
                <p className="text-xs text-amber-500">{t('export.selectImagesForExport')}</p>
              )}
              <p className="text-xs text-gray-500">
                {t('export.metricsRequireSegmentation')}
              </p>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

export default ExportOptionsCard;