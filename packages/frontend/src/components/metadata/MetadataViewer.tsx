import React, { useState, useMemo } from 'react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  Info,
  Edit,
  Download,
  Upload,
  Star,
  StarOff,
  Camera,
  FileText,
  FolderOpen,
  Microscope,
  Tag,
  Calendar,
  User,
  Globe,
  Cpu,
  AlertCircle,
} from 'lucide-react';
import { format } from 'date-fns';
import { useTranslation } from 'react-i18next';
import {
  BaseMetadata,
  ImageMetadata,
  DocumentMetadata,
  ProjectMetadata,
  SegmentationMetadata,
} from '@/services/metadataService';
import { useMetadataQuality } from '@/hooks/useMetadata';
import { cn } from '@/lib/utils';

/**
 * Metadata Viewer Component
 * Displays metadata in a structured, user-friendly format
 */

interface MetadataViewerProps {
  metadata: BaseMetadata;
  onEdit?: () => void;
  onExport?: () => void;
  onImport?: () => void;
  showActions?: boolean;
  showQualityScore?: boolean;
  className?: string;
}

export function MetadataViewer({
  metadata,
  onEdit,
  onExport,
  onImport,
  showActions = true,
  showQualityScore = true,
  className,
}: MetadataViewerProps) {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState('overview');
  const { score, qualityLevel, suggestions } = useMetadataQuality(metadata);

  // Type-specific icons
  const typeIcon = useMemo(() => {
    switch (metadata.type) {
      case 'image':
        return <Camera className="h-4 w-4" />;
      case 'document':
        return <FileText className="h-4 w-4" />;
      case 'project':
        return <FolderOpen className="h-4 w-4" />;
      case 'segmentation':
        return <Microscope className="h-4 w-4" />;
      default:
        return <Info className="h-4 w-4" />;
    }
  }, [metadata.type]);

  // Quality score color
  const qualityColor = useMemo(() => {
    switch (qualityLevel) {
      case 'excellent':
        return 'text-green-600';
      case 'good':
        return 'text-blue-600';
      case 'fair':
        return 'text-yellow-600';
      case 'poor':
        return 'text-red-600';
      default:
        return 'text-gray-600';
    }
  }, [qualityLevel]);

  return (
    <Card className={cn('w-full', className)}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {typeIcon}
            <CardTitle className="text-xl">
              {t(`metadata.type.${metadata.type}`)}
            </CardTitle>
          </div>
          {showActions && (
            <div className="flex items-center gap-2">
              {onImport && (
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="outline"
                        size="icon"
                        onClick={onImport}
                      >
                        <Upload className="h-4 w-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>{t('metadata.actions.import')}</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              )}
              {onExport && (
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="outline"
                        size="icon"
                        onClick={onExport}
                      >
                        <Download className="h-4 w-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>{t('metadata.actions.export')}</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              )}
              {onEdit && (
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="outline"
                        size="icon"
                        onClick={onEdit}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>{t('metadata.actions.edit')}</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              )}
            </div>
          )}
        </div>
        {metadata.description && (
          <CardDescription className="mt-2">
            {metadata.description}
          </CardDescription>
        )}
      </CardHeader>

      <CardContent>
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="overview">{t('metadata.tabs.overview')}</TabsTrigger>
            <TabsTrigger value="details">{t('metadata.tabs.details')}</TabsTrigger>
            <TabsTrigger value="technical">{t('metadata.tabs.technical')}</TabsTrigger>
            {showQualityScore && (
              <TabsTrigger value="quality">{t('metadata.tabs.quality')}</TabsTrigger>
            )}
          </TabsList>

          <TabsContent value="overview" className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <MetadataField
                icon={<Calendar className="h-4 w-4" />}
                label={t('metadata.fields.created')}
                value={format(new Date(metadata.created), 'PPP')}
              />
              <MetadataField
                icon={<Calendar className="h-4 w-4" />}
                label={t('metadata.fields.modified')}
                value={format(new Date(metadata.modified), 'PPP')}
              />
              {metadata.createdBy && (
                <MetadataField
                  icon={<User className="h-4 w-4" />}
                  label={t('metadata.fields.createdBy')}
                  value={metadata.createdBy}
                />
              )}
              {metadata.modifiedBy && (
                <MetadataField
                  icon={<User className="h-4 w-4" />}
                  label={t('metadata.fields.modifiedBy')}
                  value={metadata.modifiedBy}
                />
              )}
            </div>

            {metadata.tags && metadata.tags.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm font-medium">
                  <Tag className="h-4 w-4" />
                  {t('metadata.fields.tags')}
                </div>
                <div className="flex flex-wrap gap-2">
                  {metadata.tags.map((tag, index) => (
                    <Badge key={index} variant="secondary">
                      {tag}
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            {metadata.keywords && metadata.keywords.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm font-medium">
                  <Tag className="h-4 w-4" />
                  {t('metadata.fields.keywords')}
                </div>
                <div className="flex flex-wrap gap-2">
                  {metadata.keywords.map((keyword, index) => (
                    <Badge key={index} variant="outline">
                      {keyword}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
          </TabsContent>

          <TabsContent value="details" className="space-y-4">
            {renderTypeSpecificDetails(metadata, t)}
          </TabsContent>

          <TabsContent value="technical" className="space-y-4">
            <div className="space-y-2">
              <MetadataField
                icon={<Info className="h-4 w-4" />}
                label={t('metadata.fields.id')}
                value={metadata.id || 'N/A'}
                mono
              />
              <MetadataField
                icon={<Cpu className="h-4 w-4" />}
                label={t('metadata.fields.version')}
                value={metadata.version}
                mono
              />
            </div>

            {metadata.custom && Object.keys(metadata.custom).length > 0 && (
              <>
                <Separator />
                <div className="space-y-2">
                  <h4 className="text-sm font-medium">
                    {t('metadata.fields.customData')}
                  </h4>
                  <pre className="rounded-md bg-muted p-4 text-xs overflow-auto">
                    {JSON.stringify(metadata.custom, null, 2)}
                  </pre>
                </div>
              </>
            )}
          </TabsContent>

          {showQualityScore && (
            <TabsContent value="quality" className="space-y-4">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-medium">
                    {t('metadata.quality.score')}
                  </h4>
                  <span className={cn('text-2xl font-bold', qualityColor)}>
                    {score}%
                  </span>
                </div>
                <Progress value={score} className="h-2" />
                <div className="flex items-center gap-2">
                  <Badge
                    variant={qualityLevel === 'excellent' ? 'default' : 'secondary'}
                    className={cn(
                      qualityLevel === 'excellent' && 'bg-green-600',
                      qualityLevel === 'good' && 'bg-blue-600',
                      qualityLevel === 'fair' && 'bg-yellow-600',
                      qualityLevel === 'poor' && 'bg-red-600'
                    )}
                  >
                    {t(`metadata.quality.level.${qualityLevel}`)}
                  </Badge>
                </div>

                {suggestions.length > 0 && (
                  <>
                    <Separator />
                    <div className="space-y-2">
                      <h4 className="text-sm font-medium flex items-center gap-2">
                        <AlertCircle className="h-4 w-4" />
                        {t('metadata.quality.suggestions')}
                      </h4>
                      <ul className="space-y-1 text-sm text-muted-foreground">
                        {suggestions.map((suggestion, index) => (
                          <li key={index} className="flex items-start gap-2">
                            <span className="text-muted-foreground">•</span>
                            <span>{suggestion}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </>
                )}
              </div>
            </TabsContent>
          )}
        </Tabs>
      </CardContent>
    </Card>
  );
}

// Helper component for metadata fields
interface MetadataFieldProps {
  icon?: React.ReactNode;
  label: string;
  value: string | number;
  mono?: boolean;
}

function MetadataField({ icon, label, value, mono }: MetadataFieldProps) {
  return (
    <div className="space-y-1">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        {icon}
        {label}
      </div>
      <p className={cn('text-sm', mono && 'font-mono')}>{value}</p>
    </div>
  );
}

// Type-specific detail rendering
function renderTypeSpecificDetails(metadata: BaseMetadata, t: any) {
  switch (metadata.type) {
    case 'image':
      return <ImageMetadataDetails metadata={metadata as ImageMetadata} t={t} />;
    case 'document':
      return <DocumentMetadataDetails metadata={metadata as DocumentMetadata} t={t} />;
    case 'project':
      return <ProjectMetadataDetails metadata={metadata as ProjectMetadata} t={t} />;
    case 'segmentation':
      return <SegmentationMetadataDetails metadata={metadata as SegmentationMetadata} t={t} />;
    default:
      return <p className="text-sm text-muted-foreground">{t('metadata.noDetails')}</p>;
  }
}

// Image metadata details
function ImageMetadataDetails({ metadata, t }: { metadata: ImageMetadata; t: any }) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <MetadataField
          label={t('metadata.image.dimensions')}
          value={`${metadata.width} × ${metadata.height}`}
        />
        <MetadataField
          label={t('metadata.image.format')}
          value={metadata.format.toUpperCase()}
        />
        <MetadataField
          label={t('metadata.image.fileSize')}
          value={formatFileSize(metadata.fileSize)}
        />
        {metadata.colorSpace && (
          <MetadataField
            label={t('metadata.image.colorSpace')}
            value={metadata.colorSpace}
          />
        )}
      </div>

      {metadata.exif && (
        <>
          <Separator />
          <div className="space-y-2">
            <h4 className="text-sm font-medium">{t('metadata.image.exif')}</h4>
            <div className="grid grid-cols-2 gap-4">
              {metadata.exif.make && (
                <MetadataField
                  label={t('metadata.image.exif.make')}
                  value={metadata.exif.make}
                />
              )}
              {metadata.exif.model && (
                <MetadataField
                  label={t('metadata.image.exif.model')}
                  value={metadata.exif.model}
                />
              )}
              {metadata.exif.fNumber && (
                <MetadataField
                  label={t('metadata.image.exif.aperture')}
                  value={`f/${metadata.exif.fNumber}`}
                />
              )}
              {metadata.exif.exposureTime && (
                <MetadataField
                  label={t('metadata.image.exif.exposure')}
                  value={`1/${Math.round(1 / metadata.exif.exposureTime)}s`}
                />
              )}
              {metadata.exif.iso && (
                <MetadataField
                  label={t('metadata.image.exif.iso')}
                  value={`ISO ${metadata.exif.iso}`}
                />
              )}
              {metadata.exif.focalLength && (
                <MetadataField
                  label={t('metadata.image.exif.focalLength')}
                  value={`${metadata.exif.focalLength}mm`}
                />
              )}
            </div>
          </div>
        </>
      )}

      {metadata.scientific && (
        <>
          <Separator />
          <div className="space-y-2">
            <h4 className="text-sm font-medium">{t('metadata.image.scientific')}</h4>
            <div className="grid grid-cols-2 gap-4">
              {metadata.scientific.magnification && (
                <MetadataField
                  label={t('metadata.image.scientific.magnification')}
                  value={`${metadata.scientific.magnification}×`}
                />
              )}
              {metadata.scientific.pixelSize && (
                <MetadataField
                  label={t('metadata.image.scientific.pixelSize')}
                  value={`${metadata.scientific.pixelSize} ${metadata.scientific.pixelUnit || 'μm'}`}
                />
              )}
              {metadata.scientific.modality && (
                <MetadataField
                  label={t('metadata.image.scientific.modality')}
                  value={metadata.scientific.modality}
                />
              )}
              {metadata.scientific.staining && (
                <MetadataField
                  label={t('metadata.image.scientific.staining')}
                  value={metadata.scientific.staining}
                />
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// Document metadata details
function DocumentMetadataDetails({ metadata, t }: { metadata: DocumentMetadata; t: any }) {
  return (
    <div className="grid grid-cols-2 gap-4">
      <MetadataField
        label={t('metadata.document.title')}
        value={metadata.title}
      />
      {metadata.author && (
        <MetadataField
          label={t('metadata.document.author')}
          value={metadata.author}
        />
      )}
      {metadata.pageCount && (
        <MetadataField
          label={t('metadata.document.pageCount')}
          value={metadata.pageCount}
        />
      )}
      {metadata.wordCount && (
        <MetadataField
          label={t('metadata.document.wordCount')}
          value={metadata.wordCount.toLocaleString()}
        />
      )}
      {metadata.readingTime && (
        <MetadataField
          label={t('metadata.document.readingTime')}
          value={`${metadata.readingTime} ${t('metadata.document.minutes')}`}
        />
      )}
      <MetadataField
        label={t('metadata.document.fileSize')}
        value={formatFileSize(metadata.fileSize)}
      />
    </div>
  );
}

// Project metadata details
function ProjectMetadataDetails({ metadata, t }: { metadata: ProjectMetadata; t: any }) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <MetadataField
          label={t('metadata.project.title')}
          value={metadata.title}
        />
        <MetadataField
          label={t('metadata.project.status')}
          value={t(`metadata.project.status.${metadata.status}`)}
        />
        <MetadataField
          label={t('metadata.project.visibility')}
          value={t(`metadata.project.visibility.${metadata.visibility}`)}
        />
        {metadata.completionPercentage !== undefined && (
          <MetadataField
            label={t('metadata.project.completion')}
            value={`${metadata.completionPercentage}%`}
          />
        )}
      </div>

      {metadata.collaborators && metadata.collaborators.length > 0 && (
        <>
          <Separator />
          <div className="space-y-2">
            <h4 className="text-sm font-medium">
              {t('metadata.project.collaborators')}
            </h4>
            <div className="flex flex-wrap gap-2">
              {metadata.collaborators.map((collaborator, index) => (
                <Badge key={index} variant="outline">
                  <User className="mr-1 h-3 w-3" />
                  {collaborator}
                </Badge>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// Segmentation metadata details
function SegmentationMetadataDetails({ metadata, t }: { metadata: SegmentationMetadata; t: any }) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <MetadataField
          label={t('metadata.segmentation.algorithm')}
          value={metadata.algorithm}
        />
        <MetadataField
          label={t('metadata.segmentation.imageId')}
          value={metadata.imageId}
          mono
        />
      </div>

      <Separator />

      <div className="space-y-2">
        <h4 className="text-sm font-medium">{t('metadata.segmentation.metrics')}</h4>
        <div className="grid grid-cols-2 gap-4">
          <MetadataField
            label={t('metadata.segmentation.metrics.area')}
            value={metadata.metrics.area.toFixed(2)}
          />
          <MetadataField
            label={t('metadata.segmentation.metrics.perimeter')}
            value={metadata.metrics.perimeter.toFixed(2)}
          />
          <MetadataField
            label={t('metadata.segmentation.metrics.circularity')}
            value={metadata.metrics.circularity.toFixed(3)}
          />
          <MetadataField
            label={t('metadata.segmentation.metrics.sphericity')}
            value={metadata.metrics.sphericity.toFixed(3)}
          />
          <MetadataField
            label={t('metadata.segmentation.metrics.solidity')}
            value={metadata.metrics.solidity.toFixed(3)}
          />
          <MetadataField
            label={t('metadata.segmentation.metrics.compactness')}
            value={metadata.metrics.compactness.toFixed(3)}
          />
        </div>
      </div>

      {metadata.classification && (
        <>
          <Separator />
          <div className="space-y-2">
            <h4 className="text-sm font-medium">
              {t('metadata.segmentation.classification')}
            </h4>
            <div className="grid grid-cols-2 gap-4">
              {metadata.classification.type && (
                <MetadataField
                  label={t('metadata.segmentation.classification.type')}
                  value={metadata.classification.type}
                />
              )}
              {metadata.classification.confidence && (
                <MetadataField
                  label={t('metadata.segmentation.classification.confidence')}
                  value={`${(metadata.classification.confidence * 100).toFixed(1)}%`}
                />
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// Helper function to format file sizes
function formatFileSize(bytes: number): string {
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let size = bytes;
  let unitIndex = 0;

  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex++;
  }

  return `${size.toFixed(1)} ${units[unitIndex]}`;
}