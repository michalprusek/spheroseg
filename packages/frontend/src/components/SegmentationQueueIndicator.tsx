import React, { useState, useEffect, useCallback } from 'react';
import { fetchQueueStatus, clearQueueStatusCache } from '@/api/segmentationQueue';
import { useSocket } from '@/hooks/useSocketConnection';
import { formatTime } from '@/utils/dateUtils';
import { X } from 'lucide-react';
import apiClient from '@/lib/apiClient';
import { toast } from '@/hooks/useToast';
import { FixedSizeList as List } from 'react-window';

interface QueueStatusData {
  pendingTasks: string[];
  runningTasks: string[];
  queueLength: number;
  activeTasksCount: number;
  timestamp: string;
}

interface SegmentationQueueIndicatorProps {
  mini?: boolean; // Compact mode for headers
  projectId?: string;
}

const SegmentationQueueIndicator: React.FC<SegmentationQueueIndicatorProps> = ({
  mini = false,
  projectId: propProjectId,
}) => {
  const [queueData, setQueueData] = useState<QueueStatusData | null>(null);
  const [hasActiveJobs, setHasActiveJobs] = useState(false);
  const [_error, _setError] = useState<string | null>(null);
  const [_lastUpdateTime, _setLastUpdateTime] = useState<number>(Date.now());
  const [isCancelling, setIsCancelling] = useState<Record<string, boolean>>({});

  // Function to cancel a segmentation task
  const cancelTask = useCallback(async (imageId: string) => {
    setIsCancelling((prev) => ({ ...prev, [imageId]: true }));

    try {
      // Call backend to cancel the task
      await apiClient.delete(`/api/segmentation/task/${imageId}`);

      // Update local state immediately
      setQueueData((prevData) => {
        if (!prevData) return prevData;

        return {
          ...prevData,
          pendingTasks: prevData.pendingTasks.filter((id) => id !== imageId),
          runningTasks: prevData.runningTasks.filter((id) => id !== imageId),
          queueLength: Math.max(0, prevData.queueLength - 1),
          activeTasksCount: Math.max(0, prevData.activeTasksCount - 1),
        };
      });

      toast.success('Segmentation task cancelled');

      // Refresh queue data
      // Will be refreshed by the interval
    } catch (error) {
      console.error('Error cancelling task:', error);
      toast.error('Failed to cancel segmentation task');
    } finally {
      setIsCancelling((prev) => {
        const newState = { ...prev };
        delete newState[imageId];
        return newState;
      });
    }
  }, []);

  // Render task list with virtual scrolling for performance
  const renderTaskList = () => {
    if (!queueData) return null;

    // Combine running and pending tasks with their type
    const allTasks = [
      ...queueData.runningTasks.map((id) => ({ id, type: 'running' as const })),
      ...queueData.pendingTasks.map((id) => ({ id, type: 'pending' as const })),
    ];

    if (allTasks.length === 0) return null;

    // For small lists (< 10 items), render normally
    if (allTasks.length < 10) {
      return (
        <div className="space-y-2 max-h-40 overflow-y-auto">
          {allTasks.map(({ id, type }) => (
            <div
              key={id}
              className={`flex items-center justify-between text-sm px-2 py-1 rounded ${
                type === 'running' ? 'bg-blue-100 dark:bg-blue-800/30' : 'bg-gray-100 dark:bg-gray-800/30'
              }`}
            >
              <span className="truncate flex-1">
                {type === 'running' ? 'Processing' : 'Queued'}: {id.substring(0, 8)}...
              </span>
              <button
                onClick={() => cancelTask(id)}
                disabled={isCancelling[id]}
                className={`ml-2 p-1 rounded transition-colors disabled:opacity-50 ${
                  type === 'running'
                    ? 'hover:bg-blue-200 dark:hover:bg-blue-700'
                    : 'hover:bg-gray-200 dark:hover:bg-gray-700'
                }`}
                title="Cancel segmentation"
              >
                {isCancelling[id] ? (
                  <div
                    className={`w-4 h-4 border-2 border-t-transparent rounded-full animate-spin ${
                      type === 'running' ? 'border-blue-500' : 'border-gray-500'
                    }`}
                  />
                ) : (
                  <X className="w-4 h-4" />
                )}
              </button>
            </div>
          ))}
        </div>
      );
    }

    // For larger lists, use virtual scrolling
    const Row = ({ index, style }: { index: number; style: React.CSSProperties }) => {
      const { id, type } = allTasks[index];
      return (
        <div style={style}>
          <div
            className={`flex items-center justify-between text-sm px-2 py-1 rounded mx-1 ${
              type === 'running' ? 'bg-blue-100 dark:bg-blue-800/30' : 'bg-gray-100 dark:bg-gray-800/30'
            }`}
          >
            <span className="truncate flex-1">
              {type === 'running' ? 'Processing' : 'Queued'}: {id.substring(0, 8)}...
            </span>
            <button
              onClick={() => cancelTask(id)}
              disabled={isCancelling[id]}
              className={`ml-2 p-1 rounded transition-colors disabled:opacity-50 ${
                type === 'running'
                  ? 'hover:bg-blue-200 dark:hover:bg-blue-700'
                  : 'hover:bg-gray-200 dark:hover:bg-gray-700'
              }`}
              title="Cancel segmentation"
            >
              {isCancelling[id] ? (
                <div
                  className={`w-4 h-4 border-2 border-t-transparent rounded-full animate-spin ${
                    type === 'running' ? 'border-blue-500' : 'border-gray-500'
                  }`}
                />
              ) : (
                <X className="w-4 h-4" />
              )}
            </button>
          </div>
        </div>
      );
    };

    return (
      <List
        height={160} // Max height of 40 * 4 (tailwind max-h-40)
        itemCount={allTasks.length}
        itemSize={36} // Height of each item including padding
        width="100%"
        className="scrollbar-thin scrollbar-thumb-gray-300 dark:scrollbar-thumb-gray-600"
      >
        {Row}
      </List>
    );
  };

  // Funkce pro aktualizaci dat fronty
  const fetchData = useCallback(async () => {
    try {
      // Try to get the project ID from props or fallback to 'default'
      const projectId = propProjectId || 'default';

      // Skip fetching for the 'default' project to prevent unnecessary API calls
      if (projectId === 'default') {
        setQueueData(null);
        setHasActiveJobs(false);
        return;
      }

      // Fetch queue data directly from the API
      const data = await fetchQueueStatus(projectId);
      console.log('Fetched queue status data:', data);
      setQueueData(data);

      // Check if there are any active jobs
      const activeJobCount = (data.pendingTasks?.length || 0) + (data.runningTasks?.length || 0);
      setHasActiveJobs(activeJobCount > 0);
      setError(null);
      setLastUpdateTime(Date.now());
    } catch (error) {
      console.error('Error fetching queue data:', error);
      setError(error instanceof Error ? error.message : 'Unknown error');
      // Don't clear existing data on error to prevent flashing
    }
  }, [propProjectId]);

  // Poslouchej události pro manuální aktualizaci fronty
  useEffect(() => {
    const handleQueueUpdate = (event: Event) => {
      const customEvent = event as CustomEvent<{
        refresh: boolean;
        projectId?: string;
        forceRefresh?: boolean;
        immediate?: boolean;
      }>;
      const { refresh, projectId, forceRefresh, immediate } = customEvent.detail;

      console.log('Manual queue update requested', {
        refresh,
        projectId,
        forceRefresh,
        immediate,
      });

      // Pokud je specifikováno projectId, zkontrolujeme, zda odpovídá našemu propProjectId
      if (projectId && propProjectId && projectId !== propProjectId) {
        console.log(`Ignoring queue update for project ${projectId}, we're showing ${propProjectId}`);
        return;
      }

      // Pokud je immediate true, okamžitě nastavíme hasActiveJobs na true
      if (immediate) {
        console.log('Setting hasActiveJobs to true immediately');
        setHasActiveJobs(true);

        // Také nastavíme queueData, aby se zobrazil indikátor fronty
        if (!queueData) {
          setQueueData({
            pendingTasks: [{ imageId: 'temp-id' }],
            runningTasks: [],
            queueLength: 1,
            activeTasksCount: 1,
            timestamp: new Date().toISOString(),
            processingImages: [],
          });
        }
      }

      // Pokud je forceRefresh true nebo refresh true, aktualizujeme data fronty
      if (forceRefresh || refresh) {
        console.log('Fetching queue data due to manual update request (force refresh)');

        // Vynulujeme cache, aby se data načetla znovu
        if (forceRefresh) {
          // Vynulujeme cache v segmentationQueue.ts
          try {
            import('@/api/segmentationQueue').then(({ clearQueueStatusCache }) => {
              if (typeof clearQueueStatusCache === 'function') {
                clearQueueStatusCache(propProjectId || 'default');
              }
            });
          } catch (error) {
            console.error('Error clearing queue status cache:', error);
          }
        }

        // Aktualizujeme data fronty
        fetchData();
      }
    };

    window.addEventListener('queue-status-update', handleQueueUpdate);

    return () => {
      window.removeEventListener('queue-status-update', handleQueueUpdate);
    };
  }, [fetchData, propProjectId, queueData]);

  // Get socket connection using the hook
  const { socket, isConnected } = useSocket();

  // Handle segmentation queue updates
  const handleQueueUpdate = useCallback(
    (data: QueueStatusData) => {
      console.log('Received queue status update from WebSocket:', data);

      // Normalize the data to ensure it has all required fields
      const normalizedData: QueueStatusData = {
        pendingTasks: data.pendingTasks || data.queuedTasks || [],
        runningTasks: data.runningTasks || [],
        queueLength: data.queueLength || data.pendingTasks?.length || 0,
        activeTasksCount: data.activeTasksCount || data.runningTasks?.length || 0,
        timestamp: data.timestamp || new Date().toISOString(),
        processingImages: data.processingImages || [],
      };

      // Update the queue data state
      setQueueData(normalizedData);

      // Check if there are any active jobs
      const activeJobCount = (normalizedData.pendingTasks?.length || 0) + (normalizedData.runningTasks?.length || 0);
      setHasActiveJobs(activeJobCount > 0);

      // Update last update time
      setLastUpdateTime(Date.now());

      // Clear cache for next fetch
      try {
        clearQueueStatusCache(propProjectId || 'default');

        // Broadcast an event to notify other components about the queue update
        const queueUpdateEvent = new CustomEvent('queue-status-update', {
          detail: {
            refresh: false, // Don't trigger another fetch since we just got fresh data
            projectId: propProjectId,
            data: normalizedData,
            source: 'websocket',
          },
        });
        window.dispatchEvent(queueUpdateEvent);
      } catch (error) {
        console.error('Error handling queue status update:', error);
      }
    },
    [propProjectId],
  );

  // Handle segmentation updates (individual image updates)
  const handleSegmentationUpdate = useCallback(
    (data: unknown) => {
      console.log('Received segmentation update from WebSocket, refreshing queue status', data);

      // Clear cache for next fetch
      try {
        clearQueueStatusCache(propProjectId || 'default');
      } catch (error) {
        console.error('Error clearing queue status cache:', error);
      }

      // If status is 'processing', set hasActiveJobs to true immediately
      if (data && data.status === 'processing') {
        setHasActiveJobs(true);

        // Update the queue data to reflect the processing image
        setQueueData((prevData) => {
          if (!prevData) {
            // Create new queue data if none exists
            return {
              pendingTasks: [],
              runningTasks: [data.imageId],
              queueLength: 1,
              activeTasksCount: 1,
              timestamp: new Date().toISOString(),
              processingImages: [{ id: data.imageId, name: 'Processing image' }],
            };
          }

          // Update existing queue data
          const runningTasks = [...(prevData.runningTasks || [])];
          if (!runningTasks.includes(data.imageId)) {
            runningTasks.push(data.imageId);
          }

          return {
            ...prevData,
            runningTasks,
            activeTasksCount: runningTasks.length,
            timestamp: new Date().toISOString(),
          };
        });
      } else if (data && (data.status === 'completed' || data.status === 'failed')) {
        // Update queue data to remove the completed/failed image
        setQueueData((prevData) => {
          if (!prevData) return prevData;

          // Remove from running tasks
          const runningTasks = (prevData.runningTasks || []).filter((id) => id !== data.imageId);
          // Remove from pending tasks
          const pendingTasks = (prevData.pendingTasks || []).filter((id) => id !== data.imageId);

          const newData = {
            ...prevData,
            runningTasks,
            pendingTasks,
            queueLength: pendingTasks.length,
            activeTasksCount: runningTasks.length,
            timestamp: new Date().toISOString(),
          };

          // Update hasActiveJobs based on new data
          const activeJobCount = runningTasks.length + pendingTasks.length;
          setHasActiveJobs(activeJobCount > 0);

          return newData;
        });

        // Also refresh queue data from server to ensure consistency
        setTimeout(() => fetchData(), 1000);
      }

      setLastUpdateTime(Date.now());

      // Broadcast the segmentation update to other components
      try {
        const imageUpdateEvent = new CustomEvent('image-status-update', {
          detail: {
            imageId: data.imageId,
            status: data.status,
            forceQueueUpdate: true,
            error: data.error,
            resultPath: data.resultPath,
          },
        });
        window.dispatchEvent(imageUpdateEvent);
      } catch (error) {
        console.error('Error broadcasting image status update:', error);
      }
    },
    [fetchData, propProjectId],
  );

  // Setup socket connection for real-time updates
  useEffect(() => {
    if (socket && isConnected) {
      console.log('Setting up WebSocket listeners for queue updates');

      // Register socket event handlers
      socket.on('segmentation_queue_update', handleQueueUpdate);
      socket.on('segmentation_update', handleSegmentationUpdate);

      // Join project room if needed
      if (propProjectId && propProjectId !== 'default') {
        socket.emit('join_project', { projectId: propProjectId });
        socket.emit('join-project', propProjectId);
        socket.emit('join', `project-${propProjectId}`);
      }

      return () => {
        // Remove socket event handlers
        socket.off('segmentation_queue_update', handleQueueUpdate);
        socket.off('segmentation_update', handleSegmentationUpdate);
      };
    }
  }, [socket, isConnected, handleQueueUpdate, handleSegmentationUpdate, propProjectId]);

  // Fetch data on mount and periodically
  useEffect(() => {
    // Fetch data immediately on mount
    fetchData();

    // Then fetch every 2 seconds (more frequent polling for better responsiveness)
    const intervalId = setInterval(fetchData, 2000);

    // Also fetch when the component becomes visible
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        console.log('Document became visible, refreshing queue status immediately');
        fetchData();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    // Cleanup function
    return () => {
      clearInterval(intervalId);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [fetchData, propProjectId]);

  // Listen for cache cleared events
  useEffect(() => {
    const handleCacheCleared = (event: Event) => {
      const customEvent = event as CustomEvent<{
        projectId: string;
        clearAll: boolean;
        timestamp: number;
      }>;

      const { projectId, clearAll } = customEvent.detail;

      // Refresh data if the cleared cache is for our project or if all caches were cleared
      if (clearAll || projectId === propProjectId || projectId === 'default') {
        console.log(`Queue cache cleared for ${projectId}, refreshing queue status`);
        fetchData();
      }
    };

    // Listen for the cache-cleared event
    window.addEventListener('queue-cache-cleared', handleCacheCleared);

    return () => {
      window.removeEventListener('queue-cache-cleared', handleCacheCleared);
    };
  }, [fetchData, propProjectId]);

  // Vždy zobrazíme indikátor, i když nejsou aktivní úlohy
  // Tím zajistíme, že uživatel vidí stav "Ready" když nejsou žádné úlohy

  // Mini version for compact display in headers
  if (mini) {
    if (hasActiveJobs) {
      const processing = queueData?.runningTasks?.length || 0;
      const queued = queueData?.pendingTasks?.length || 0;
      return (
        <div className="inline-flex items-center gap-2 px-2 py-1 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 rounded-full text-xs font-medium">
          <div className="h-2 w-2 rounded-full bg-blue-500 animate-pulse"></div>
          <span>
            {processing} / {queued}
          </span>
        </div>
      );
    } else {
      return (
        <div className="inline-flex items-center gap-2 px-2 py-1 bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300 rounded-full text-xs font-medium">
          <div className="h-2 w-2 rounded-full bg-green-500"></div>
          <span>Ready</span>
        </div>
      );
    }
  }

  // Regular version with more details
  if (hasActiveJobs) {
    return (
      <div className="p-3 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 rounded-lg border border-blue-200 dark:border-blue-800">
        <div className="flex items-center gap-3 mb-3">
          <div className="h-3 w-3 rounded-full bg-blue-500 animate-pulse"></div>
          <div className="flex-1">
            <div className="font-medium">Image Segmentation Status</div>
            <div className="text-sm flex items-center gap-4">
              <span className="flex items-center gap-1">
                <span className="font-semibold">{queueData?.runningTasks?.length || 0}</span>
                <span>processing</span>
              </span>
              <span className="text-gray-400">•</span>
              <span className="flex items-center gap-1">
                <span className="font-semibold">{queueData?.pendingTasks?.length || 0}</span>
                <span>queued</span>
              </span>
            </div>
          </div>
        </div>

        {/* Show list of tasks with cancel buttons - using virtual scrolling for performance */}
        {renderTaskList()}

        {queueData?.timestamp && (
          <div className="text-xs text-blue-400 mt-2">Last updated: {formatTime(queueData.timestamp)}</div>
        )}
      </div>
    );
  } else {
    return (
      <div className="flex items-center gap-3 p-3 bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300 rounded-lg border border-green-200 dark:border-green-800">
        <div className="h-3 w-3 rounded-full bg-green-500"></div>
        <div className="flex-1">
          <div className="font-medium">Image Segmentation Status</div>
          <div className="text-sm">
            <span>No images in queue</span>
          </div>
          {queueData?.timestamp && (
            <div className="text-xs text-green-500 mt-1">Last updated: {formatTime(queueData.timestamp)}</div>
          )}
        </div>
      </div>
    );
  }
};

export default SegmentationQueueIndicator;
