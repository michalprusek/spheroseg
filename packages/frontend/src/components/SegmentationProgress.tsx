/**
 * SegmentationProgress Component
 *
 * Displays real-time progress of image segmentation tasks
 * using WebSocket connections for updates.
 */
import React, { useEffect, useState, useCallback } from 'react';
import { CircularProgress, Box, Typography, Alert, Chip, Stack } from '@mui/material';
import useSegmentationUpdates, { SegmentationUpdate, QueueStatusUpdate } from '../hooks/useSegmentationUpdates';
import { fetchQueueStatus } from '@/api/segmentationQueue';

interface SegmentationProgressProps {
  projectId: string;
  imageId?: string;
  onCompleted?: (resultPath: string) => void;
  onFailed?: (error: string) => void;
}

const SegmentationProgress: React.FC<SegmentationProgressProps> = ({ projectId, imageId, onCompleted, onFailed }) => {
  const [showProgress, setShowProgress] = useState(true);
  const [elapsedTime, setElapsedTime] = useState(0);
  const [startTime] = useState(Date.now());
  const [localQueueStatus, setLocalQueueStatus] = useState<QueueStatusUpdate | null>(null);

  // Use our custom hook to get real-time updates
  const {
    lastUpdate,
    queueStatus: wsQueueStatus,
    isConnected,
    isListening,
  } = useSegmentationUpdates({
    imageId,
    onUpdate: (update) => {
      if (update.status === 'completed' && onCompleted && update.resultPath) {
        onCompleted(update.resultPath);
        setShowProgress(false);
      } else if (update.status === 'failed' && onFailed && update.error) {
        onFailed(update.error);
        setShowProgress(false);
      }
    },
  });

  // Track if we've already tried to fetch queue status
  const [hasFetchedOnce, setHasFetchedOnce] = useState(false);
  const [fetchError, setFetchError] = useState(false);

  // Fetch queue status periodically
  const fetchQueueStatusData = useCallback(async () => {
    // Skip if we've already had an error
    if (fetchError) return;

    try {
      // Logging removed to avoid console spam

      // Add reasonable timeout to the fetch call
      const result = await Promise.race([
        fetchQueueStatus(projectId).then((status) => ({ status })),
        new Promise<null>((resolve) =>
          setTimeout(() => {
            // Silent timeout with no console logging
            resolve(null);
          }, 8000),
        ), // Further increased timeout to 8 seconds for better chance of success
      ]);

      if (result) {
        setLocalQueueStatus(result.status);
      } else {
        // Handle timeout without using mock data
        setFetchError(true);
        console.error('Fetch queue status timeout');
      }

      setHasFetchedOnce(true);
    } catch (error) {
      // Only log error once
      if (!fetchError) {
        console.error('Error fetching queue status:', error);
        setFetchError(true);
      }
    }
  }, [projectId, hasFetchedOnce, fetchError]);

  // When we have no data, show information about the current image being processed
  const getDefaultQueueStatus = useCallback(() => {
    return {
      pendingTasks: imageId ? [imageId] : [],
      runningTasks: [],
      queueLength: imageId ? 1 : 0,
      activeTasksCount: 0,
      timestamp: new Date().toISOString(),
    };
  }, [imageId]);

  // Use WebSocket queue status if available, otherwise use local queue status
  // Only use default status when we have an imageId and need to show something
  const effectiveQueueStatus = wsQueueStatus || localQueueStatus || (imageId ? getDefaultQueueStatus() : null);

  // Update elapsed time
  useEffect(() => {
    if (!showProgress) return;

    const interval = setInterval(() => {
      setElapsedTime(Math.floor((Date.now() - startTime) / 1000));
    }, 1000);

    return () => clearInterval(interval);
  }, [startTime, showProgress]);

  // Fetch queue status periodically
  useEffect(() => {
    if (!showProgress) return;

    // If we're in an error state, still try to fetch but less frequently
    const fetchInterval = fetchError ? 30000 : 15000; // 30 seconds if error, 15 seconds normally

    // Fetch queue status immediately
    fetchQueueStatusData();

    // Then fetch periodically
    const interval = setInterval(() => {
      fetchQueueStatusData();
    }, fetchInterval);

    // Set error state if we don't have any data after 15 seconds
    const noDataTimeout = setTimeout(() => {
      if (!localQueueStatus && !wsQueueStatus) {
        console.error('No queue data available after timeout');
        setFetchError(true);
      }
    }, 15000);

    return () => {
      clearInterval(interval);
      clearTimeout(noDataTimeout);
    };
  }, [fetchQueueStatusData, showProgress, fetchError]);

  // Calculate position in queue
  const getQueuePosition = (): number | null => {
    if (!imageId || !effectiveQueueStatus?.pendingTasks) return null;

    const position = effectiveQueueStatus.pendingTasks.indexOf(imageId);
    return position >= 0 ? position + 1 : null;
  };

  // Check if image is currently processing
  const isCurrentlyProcessing = (): boolean => {
    if (!imageId || !effectiveQueueStatus?.runningTasks) return false;
    return effectiveQueueStatus.runningTasks.includes(imageId);
  };

  // Format elapsed time
  const formatElapsedTime = (seconds: number): string => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  // Don't show anything if we don't have progress to show
  if (!showProgress) return null;

  // If we have no image ID and no data, don't show anything
  if (!imageId && !effectiveQueueStatus) return null;

  return (
    <Box
      sx={{
        p: 3,
        borderRadius: 2,
        bgcolor: 'background.paper',
        boxShadow: 1,
        textAlign: 'center',
        maxWidth: 500,
        mx: 'auto',
        my: 2,
      }}
    >
      <Typography variant="h6" gutterBottom>
        Segmentation Progress
      </Typography>

      {!isConnected && (
        <Alert severity="warning" sx={{ mb: 2 }}>
          Offline mode: Limited real-time updates available
        </Alert>
      )}

      {isConnected && !isListening && (
        <Alert severity="info" sx={{ mb: 2 }}>
          Waiting for segmentation updates...
        </Alert>
      )}

      {fetchError && (
        <Alert severity="warning" sx={{ mb: 2 }}>
          Unable to connect to segmentation service. Status may be outdated.
        </Alert>
      )}

      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          mb: 2,
        }}
      >
        <CircularProgress size={60} thickness={4} color={isCurrentlyProcessing() ? 'primary' : 'secondary'} />
        <Box sx={{ ml: 3, textAlign: 'left' }}>
          <Typography variant="body1" fontWeight="medium">
            {isCurrentlyProcessing()
              ? 'Processing your image...'
              : getQueuePosition()
                ? `Waiting in queue (position ${getQueuePosition()})`
                : 'In queue, position unknown'}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Elapsed time: {formatElapsedTime(elapsedTime)}
          </Typography>
        </Box>
      </Box>

      <Stack direction="row" spacing={1} justifyContent="center" mb={2}>
        <Chip label={`Queue: ${effectiveQueueStatus?.queueLength || 0}`} color="info" size="small" variant="outlined" />
        <Chip
          label={`Active: ${effectiveQueueStatus?.activeTasksCount || 0}`}
          color="success"
          size="small"
          variant="outlined"
        />
        {lastUpdate && (
          <Chip
            label={`Status: ${lastUpdate.status}`}
            color={lastUpdate.status === 'completed' ? 'success' : lastUpdate.status === 'failed' ? 'error' : 'warning'}
            size="small"
          />
        )}
      </Stack>

      <Typography variant="body2" color="text.secondary">
        This process can take several minutes depending on image complexity.
      </Typography>
    </Box>
  );
};

export default SegmentationProgress;
