import React, { useState } from 'react';
import type { SegmentationData, ProjectImage, SegmentationApiResponse, ImageStatus } from '@/types'; // Import necessary types
import { toast } from 'sonner';
import { useLanguage } from '@/contexts/LanguageContext'; // Add useLanguage import
import { Button } from '@/components/ui/button';
import { Loader2, CheckCircle, AlertTriangle, Play } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import apiClient from '@/lib/apiClient'; // Import apiClient
import axios from 'axios'; // Import axios for error checking
import logger from '@/utils/logger';

// Define ImageStatus type (moved to types/index.ts, imported)
// type ImageStatus = 'pending' | 'processing' | 'completed' | 'failed' | 'saving';

interface ProjectImageProcessorProps {
  image: ProjectImage;
  onStatusChange: (imageId: string, status: ImageStatus) => void;
  // Keep onResultChange for potential future use (manual editing)
  onResultChange: (imageId: string, result: SegmentationData, status: ImageStatus) => void;
}

const ProjectImageProcessor: React.FC<ProjectImageProcessorProps> = ({ image, onStatusChange, onResultChange }) => {
  const { t } = useLanguage(); // Use the language hook
  const [loadingStatus, setLoadingStatus] = useState<ImageStatus | null>(null);
  // Remove unused state: const [currentResult, setCurrentResult] = useState<SegmentationResult | null>(null);

  // Function to trigger the segmentation process
  const triggerSegmentation = async () => {
    if (!image.id || !image.url) return;
    setLoadingStatus('processing');
    onStatusChange(image.id, 'processing'); // Optimistic update
    toast.info(t('imageProcessor.segmentationStarted') || 'Segmentation process started...');

    try {
      logger.debug(`Triggering segmentation for image ${image.id}`);
      // Replace simulation with API call to trigger segmentation
      await apiClient.post(`/api/images/${image.id}/segmentation`);

      // The backend will now handle the processing asynchronously.
      // The status will be updated via polling or WebSocket in the parent component (ProjectPage)
      // based on changes to the image data prop.
      // No need to simulate result or call save here.
      setLoadingStatus(null); // Clear internal loading state, rely on prop updates
    } catch (error: unknown) {
      logger.error('Error triggering segmentation:', error);
      let message = t('imageProcessor.segmentationStartError') || 'Failed to start segmentation.';
      if (axios.isAxiosError(error) && error.response) {
        message = error.response.data?.message || message;
      } else if (error instanceof Error) {
        message = error.message;
      }
      toast.error(message);
      onStatusChange(image.id, 'failed'); // Update status to failed on error
      setLoadingStatus(null);
    }
  };

  // Function to save the segmentation result (called after processing or manual edit)
  // Keep this function for potential future use (e.g., saving manually edited polygons)
  const saveSegmentationResult = async (result: SegmentationData) => {
    if (!image.id) return;
    setLoadingStatus('saving');
    try {
      logger.debug(`Saving result for image ${image.id}`);
      // Replace simulation with API call to save result
      const response = await apiClient.put<SegmentationApiResponse>(`/api/images/${image.id}/segmentation`, {
        result_data: result,
        status: 'completed',
        // Optionally add parameters if needed: parameters: result.parameters
      });

      // Pass result and status up
      if (response.data.result_data) {
        onResultChange(image.id, response.data.result_data as SegmentationData, 'completed');
      } else {
        // Handle case where result_data might be unexpectedly null
        onStatusChange(image.id, 'completed'); // Update status anyway
      }

      toast.success(t('imageProcessor.resultSaveSuccess') || 'Result saved successfully.');
      setLoadingStatus(null); // Clear loading state after successful save
    } catch (error: unknown) {
      logger.error('Error saving segmentation result:', error);
      let message = t('imageProcessor.resultSaveError') || 'Failed to save result.';
      if (axios.isAxiosError(error) && error.response) {
        message = error.response.data?.message || message;
      } else if (error instanceof Error) {
        message = error.message;
      }
      toast.error(message);
      setLoadingStatus(null); // Clear loading state on error
    }
  };

  // You might have other functions, e.g., for manual updates or reverting status
  // const updateStatusManually = async (newStatus: ImageStatus) => { ... }

  // Determine button content and action based on current status
  let buttonContent;
  let buttonAction: (() => void) | undefined = undefined;
  let buttonTooltip = '';

  const currentEffectiveStatus = loadingStatus || image.segmentationStatus;

  switch (currentEffectiveStatus) {
    case 'pending':
      buttonContent = <Play className="h-4 w-4" />;
      buttonAction = triggerSegmentation;
      buttonTooltip = t('imageProcessor.startSegmentationTooltip');
      break;
    case 'processing':
      buttonContent = <Loader2 className="h-4 w-4 animate-spin" />;
      buttonAction = undefined; // Disable while processing
      buttonTooltip = t('imageProcessor.processingTooltip');
      break;
    case 'saving':
      buttonContent = <Loader2 className="h-4 w-4 animate-spin" />;
      buttonAction = undefined; // Disable while saving
      buttonTooltip = t('imageProcessor.savingTooltip');
      break;
    case 'completed':
      buttonContent = <CheckCircle className="h-4 w-4 text-green-500" />;
      buttonAction = undefined; // Or maybe allow re-processing?
      buttonTooltip = t('imageProcessor.completedTooltip');
      break;
    case 'failed':
      buttonContent = <AlertTriangle className="h-4 w-4 text-red-500" />;
      buttonAction = triggerSegmentation; // Allow retrying
      buttonTooltip = t('imageProcessor.retryTooltip');
      break;
    default:
      buttonContent = <Play className="h-4 w-4" />;
      buttonAction = triggerSegmentation;
      buttonTooltip = t('imageProcessor.startSegmentationTooltip');
  }

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="outline"
            size="icon"
            onClick={buttonAction}
            disabled={!buttonAction || loadingStatus !== null}
          >
            {buttonContent}
          </Button>
        </TooltipTrigger>
        <TooltipContent>
          <p>{buttonTooltip}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};

export default ProjectImageProcessor;
