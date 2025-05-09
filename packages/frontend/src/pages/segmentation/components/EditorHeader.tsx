import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from "framer-motion";
import { Loader2, ChevronLeft, Save, Download, RefreshCcw, Image as ImageIcon, ChevronRight } from 'lucide-react';
import { Button } from "@/components/ui/button";
import ProjectImageExport from './project/ProjectImageExport';
import { useSegmentationContext } from '../contexts/SegmentationContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

interface EditorHeaderProps {
  projectId: string;
  projectTitle: string;
  imageName: string;
  imageId: string | undefined;
  saving: boolean;
  loading: boolean;
  currentImageIndex: number;
  totalImages: number;
  onNavigate: (direction: 'prev' | 'next') => void;
  onSave: () => Promise<void>;
  onResegmentCurrentImage: () => void;
  onExportMask: () => void;
}

const EditorHeader = ({
  projectId,
  projectTitle,
  imageName,
  imageId,
  saving,
  loading,
  currentImageIndex,
  totalImages,
  onNavigate,
  onSave,
  onResegmentCurrentImage,
  onExportMask
}: EditorHeaderProps) => {
  const navigate = useNavigate();
  const { t } = useLanguage();
  const { segmentation, loading: segmentationLoading } = useSegmentationContext();
  const [showExport, setShowExport] = useState(false);

  const handleBackClick = () => {
    navigate(`/project/${projectId}`);
  };

  // Akce lze provádět, pokud není načítání a existuje ID obrázku
  const canPerformActions = !loading && imageId;

  // Segmentace probíhá, pokud je segmentationLoading true
  const isSegmenting = segmentationLoading;

  return (
    <TooltipProvider delayDuration={100}>
      <motion.header
        className="w-full h-16 px-4 bg-background border-b flex items-center justify-between z-10"
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
      >
        <div className="flex items-center space-x-2 overflow-hidden mr-2">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="text-foreground/70 flex items-center hover:text-foreground hover:bg-muted flex-shrink-0"
                onClick={handleBackClick}
                aria-label={t('editor.backButton')}
              >
                <ChevronLeft className="h-5 w-5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>{t('editor.backButtonTooltip') || 'Back to Project'}</p>
            </TooltipContent>
          </Tooltip>

          <div className="hidden md:block text-sm text-muted-foreground flex-shrink-0">|</div>

          <div className="flex flex-col md:flex-row md:items-center md:gap-2 overflow-hidden">
            <Tooltip>
              <TooltipTrigger asChild>
                <h1 className="text-base font-medium truncate max-w-[140px] sm:max-w-[200px] md:max-w-xs text-foreground cursor-default">
                  {loading ? t('editor.loadingProject') : projectTitle}
                </h1>
              </TooltipTrigger>
              <TooltipContent>
                <p>{loading ? t('editor.loadingProject') : projectTitle}</p>
              </TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <span className="text-muted-foreground text-xs md:text-sm truncate max-w-[140px] sm:max-w-[200px] md:max-w-xs cursor-default">
                  {loading ? t('editor.loadingImage') : imageName} ({currentImageIndex + 1} / {totalImages})
                </span>
              </TooltipTrigger>
              <TooltipContent>
                <p>{loading ? t('editor.loadingImage') : imageName}</p>
                <p>{t('editor.image')} {currentImageIndex + 1} / {totalImages}</p>
              </TooltipContent>
            </Tooltip>
          </div>
        </div>

        <div className="flex-shrink-0 mx-4">
          <Button
            variant="outline"
            size="icon"
            onClick={() => onNavigate('prev')}
            disabled={loading || totalImages <= 1 || currentImageIndex === 0}
            aria-label={t('editor.previousImage')}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="icon"
            onClick={() => onNavigate('next')}
            disabled={loading || totalImages <= 1 || currentImageIndex === totalImages - 1}
            className="ml-1"
            aria-label={t('editor.nextImage')}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>

        <div className="flex items-center space-x-2 ml-auto">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="outline"
                size="icon"
                onClick={onResegmentCurrentImage}
                disabled={!canPerformActions || saving}
                aria-label={t('editor.resegmentButton')}
              >
                <RefreshCcw className={`h-4 w-4 ${isSegmenting ? 'animate-spin' : ''}`} />
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>
                {isSegmenting
                  ? (t('editor.resegmentingButtonTooltip') || 'Segmentation in progress...')
                  : (t('editor.resegmentButtonTooltip') || 'Resegment Current Image')}
              </p>
            </TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="outline"
                size="icon"
                onClick={onExportMask}
                disabled={!canPerformActions || saving}
                aria-label={t('editor.exportMaskButton')}
              >
                <ImageIcon className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>{t('editor.exportMaskButtonTooltip') || 'Export Segmentation Mask (PNG)'}</p>
            </TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="outline"
                size="icon"
                disabled={!canPerformActions || saving}
                aria-label={t('editor.exportButton')}
              >
                <Download className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>{t('editor.exportButtonTooltip') || 'Export Project Data'}</p>
            </TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                onClick={onSave}
                disabled={!canPerformActions || saving}
                aria-label={t('editor.saveButton')}
                className="bg-primary text-primary-foreground hover:bg-primary/90"
              >
                {saving ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Save className="mr-2 h-4 w-4" />
                )}
                {t('editor.saveButton')}
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>{saving ? t('editor.savingTooltip') : t('editor.saveTooltip') || 'Save Changes'}</p>
            </TooltipContent>
          </Tooltip>
        </div>
      </motion.header>

      {showExport && (
        <ProjectImageExport
          segmentation={segmentation}
          onClose={() => setShowExport(false)}
        />
      )}
    </TooltipProvider>
  );
};

export default EditorHeader;
