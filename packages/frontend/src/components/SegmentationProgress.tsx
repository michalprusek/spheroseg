/**
 * SegmentationProgress Component
 * 
 * Displays real-time progress of image segmentation tasks
 * using WebSocket connections for updates.
 */
import React, { useEffect, useState } from 'react';
import { CircularProgress, Box, Typography, Alert, Chip, Stack } from '@mui/material';
import useSegmentationUpdates, { SegmentationUpdate, QueueStatusUpdate } from '../hooks/useSegmentationUpdates';

interface SegmentationProgressProps {
  imageId?: string;
  onCompleted?: (resultPath: string) => void;
  onFailed?: (error: string) => void;
}

const SegmentationProgress: React.FC<SegmentationProgressProps> = ({
  imageId,
  onCompleted,
  onFailed
}) => {
  const [showProgress, setShowProgress] = useState(true);
  const [elapsedTime, setElapsedTime] = useState(0);
  const [startTime] = useState(Date.now());
  
  // Use our custom hook to get real-time updates
  const { lastUpdate, queueStatus, isConnected, isListening } = useSegmentationUpdates({
    imageId,
    onUpdate: (update) => {
      if (update.status === 'completed' && onCompleted && update.resultPath) {
        onCompleted(update.resultPath);
        setShowProgress(false);
      } else if (update.status === 'failed' && onFailed && update.error) {
        onFailed(update.error);
        setShowProgress(false);
      }
    }
  });

  // Update elapsed time
  useEffect(() => {
    if (!showProgress) return;
    
    const interval = setInterval(() => {
      setElapsedTime(Math.floor((Date.now() - startTime) / 1000));
    }, 1000);
    
    return () => clearInterval(interval);
  }, [startTime, showProgress]);

  // Calculate position in queue
  const getQueuePosition = (): number | null => {
    if (!imageId || !queueStatus?.pendingTasks) return null;
    
    const position = queueStatus.pendingTasks.indexOf(imageId);
    return position >= 0 ? position + 1 : null;
  };

  // Check if image is currently processing
  const isCurrentlyProcessing = (): boolean => {
    if (!imageId || !queueStatus?.runningTasks) return false;
    return queueStatus.runningTasks.includes(imageId);
  };

  // Format elapsed time
  const formatElapsedTime = (seconds: number): string => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  if (!showProgress) return null;

  return (
    <Box sx={{ 
      p: 3, 
      borderRadius: 2,
      bgcolor: 'background.paper',
      boxShadow: 1,
      textAlign: 'center',
      maxWidth: 500,
      mx: 'auto',
      my: 2
    }}>
      <Typography variant="h6" gutterBottom>
        Segmentation Progress
      </Typography>
      
      {!isConnected && (
        <Alert severity="warning" sx={{ mb: 2 }}>
          Connecting to server for real-time updates...
        </Alert>
      )}
      
      {isConnected && !isListening && (
        <Alert severity="info" sx={{ mb: 2 }}>
          Waiting for segmentation updates...
        </Alert>
      )}
      
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', mb: 2 }}>
        <CircularProgress 
          size={60} 
          thickness={4} 
          color={isCurrentlyProcessing() ? "primary" : "secondary"} 
        />
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
        <Chip 
          label={`Queue: ${queueStatus?.queueLength || 0}`} 
          color="info" 
          size="small" 
          variant="outlined" 
        />
        <Chip 
          label={`Active: ${queueStatus?.activeTasksCount || 0}`} 
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