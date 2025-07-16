import React, { useState, useEffect, useRef } from 'react';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { ChevronDown, ChevronUp, Loader2 } from 'lucide-react';
import apiClient from '@/lib/apiClient';
// Import axios directly
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { io, Socket } from 'socket.io-client';
import { useOnClickOutside } from '@/hooks/useOnClickOutside';

interface SegmentationProgressProps {
  projectId: string;
}

interface QueueStatus {
  queueLength: number;
  runningTasks: string[];
  queuedTasks?: string[];
  processingImages: { id: string; name: string; projectId?: string }[];
  queuedImages?: { id: string; name: string; projectId?: string }[];
}

interface QueueItemProps {
  name: string;
  status: 'running' | 'queued';
}

// Komponenta pro zobrazení jedné položky ve frontě
const QueueItem: React.FC<QueueItemProps> = ({ name, status }) => {
  const { t } = useLanguage();

  return (
    <div className="flex items-center justify-between py-2 px-3 border-b border-gray-100 dark:border-gray-700 last:border-0">
      <div className="flex items-center">
        <div className="mr-2">
          {status === 'running' ? (
            <Loader2 className="h-4 w-4 text-blue-500 animate-spin" />
          ) : (
            <div className="h-2 w-2 rounded-full bg-gray-300 dark:bg-gray-600" />
          )}
        </div>
        <span className="text-sm truncate max-w-[180px]" title={name}>
          {name}
        </span>
      </div>
      <span
        className={`text-xs font-medium px-2 py-1 rounded-full bg-opacity-10
        ${status === 'running' ? 'text-blue-500 bg-blue-100 dark:bg-blue-900 dark:bg-opacity-20' : 'text-gray-500 bg-gray-100 dark:bg-gray-700 dark:bg-opacity-50'}`}
      >
        {status === 'running' ? t('segmentation.queue.processing') : t('segmentation.queue.queued')}
      </span>
    </div>
  );
};

const SegmentationProgress: React.FC<SegmentationProgressProps> = ({ projectId }) => {
  const [queueStatus, setQueueStatus] = useState<QueueStatus | null>(null);
  const { token } = useAuth();
  const { t } = useLanguage();
  const [socket, setSocket] = useState<Socket | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [isWebSocketConnected, setIsWebSocketConnected] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Zavře menu při kliknutí mimo
  useOnClickOutside(menuRef, () => setIsOpen(false));

  // Fetch initial queue status
  useEffect(() => {
    const fetchQueueStatus = async () => {
      try {
        // Zkusíme získat status specifický pro projekt, pokud máme projectId
        if (projectId) {
          try {
            // Try correct project-specific endpoint: /api/segmentation/queue-status/:projectId
            const projectStatusResponse = await apiClient.get(`/api/segmentation/queue-status/${projectId}`);
            if (projectStatusResponse.data) {
              const normalizedData = normalizeQueueStatusData(projectStatusResponse.data);
              setQueueStatus(normalizedData);
              return; // Končíme, pokud jsme získali data specifická pro projekt
            }
          } catch (projectEndpointError) {
            // Check if this is a 404 error for non-existent project
            if (projectEndpointError.response?.status === 404) {
              console.debug(`Project ${projectId} not found, skipping project-specific queue status`);
              // Don't show error for non-existent projects, just continue to global status
              return;
            } else {
              console.debug(`Project-specific queue status endpoint failed: ${projectEndpointError.message}`);
            }
            // Continue to global endpoints
          }
        }

        // Try global status endpoints
        try {
          // Primary endpoint: /api/segmentation/queue
          const globalStatusResponse = await apiClient.get('/api/segmentation/queue');
          if (globalStatusResponse.data) {
            const normalizedData = normalizeQueueStatusData(globalStatusResponse.data);
            setQueueStatus(normalizedData);
            return;
          }
        } catch (globalEndpointError) {
          console.debug(`Primary global endpoint failed: ${globalEndpointError.message}`);

          // Alternative endpoint: /api/queue-status
          try {
            const altGlobalResponse = await apiClient.get('/api/queue-status');
            if (altGlobalResponse.data) {
              const normalizedData = normalizeQueueStatusData(altGlobalResponse.data);
              setQueueStatus(normalizedData);
              return;
            }
          } catch (altGlobalError) {
            console.warn(`All queue status endpoints failed.`);
            // Použijeme prázdný status fronty místo mockovaných dat
            setQueueStatus({
              queueLength: 0,
              runningTasks: [],
              queuedTasks: [],
              pendingTasks: [],
              processingImages: [],
            });
          }
        }
      } catch (error) {
        console.error('Unexpected error in fetchQueueStatus:', error);
        // Při neočekávaných chybách nastavíme prázdnou frontu
        setQueueStatus({
          queueLength: 0,
          runningTasks: [],
          queuedTasks: [],
          processingImages: [],
        });
      }
    };

    // Pomocná funkce pro normalizaci dat fronty
    const normalizeQueueStatusData = (data: any) => {
      // Získáme vlastní data z odpovědi (může být v data.data nebo přímo v data)
      const responseData = data.data || data;

      // Extrahujeme images data - pro počty z databáze
      const imagesData = responseData.images || {};

      return {
        ...responseData,
        // Zajistíme, že runningTasks je vždy pole
        runningTasks: responseData.runningTasks || [],
        // Zajistíme, že queuedTasks je vždy pole (kontrolujeme queuedTasks i pendingTasks)
        queuedTasks: responseData.queuedTasks || responseData.pendingTasks || [],
        // Zajistíme, že processingImages je vždy pole
        processingImages: responseData.processingImages || [],
        // Zajistíme, že queuedImages je vždy pole
        queuedImages: responseData.queuedImages || [],
        // Zajistíme, že máme queueLength
        queueLength:
          responseData.queueLength || responseData.pendingTasks?.length || responseData.queuedTasks?.length || 0,
        // Zachováme images data pro počty z databáze
        images: imagesData,
      };
    };

    fetchQueueStatus();
    
    // Intelligent polling with exponential backoff
    let pollInterval = 10000; // Start with 10 seconds
    let consecutiveEmptyResponses = 0;
    let maxInterval = 60000; // Max 60 seconds
    
    const intelligentPoll = async () => {
      // Skip polling if WebSocket is connected and working
      if (isWebSocketConnected) {
        console.log('WebSocket connected, skipping polling');
        return;
      }
      
      try {
        await fetchQueueStatus();
        
        // If queue is empty, increase polling interval
        if (queueStatus && queueStatus.queueLength === 0 && queueStatus.runningTasks.length === 0) {
          consecutiveEmptyResponses++;
          if (consecutiveEmptyResponses > 3) {
            pollInterval = Math.min(pollInterval * 1.5, maxInterval);
          }
        } else {
          // Reset to normal interval if there's activity
          consecutiveEmptyResponses = 0;
          pollInterval = 10000;
        }
      } catch (error) {
        // Increase interval on errors to reduce API spam
        pollInterval = Math.min(pollInterval * 2, maxInterval);
        console.warn('Queue status polling failed, increasing interval:', pollInterval);
      }
    };
    
    // Only poll as fallback if WebSocket is not connected
    const setupPolling = () => {
      return setInterval(intelligentPoll, pollInterval);
    };
    
    let interval = setupPolling();
    
    // Update interval when pollInterval changes or WebSocket status changes
    const intervalUpdater = setInterval(() => {
      clearInterval(interval);
      interval = setupPolling();
    }, 30000); // Check for interval updates every 30 seconds

    return () => {
      clearInterval(interval);
      clearInterval(intervalUpdater);
    };
  }, [projectId, isWebSocketConnected]); // Re-fetch when projectId changes or WebSocket status changes

  // Setup WebSocket connection for real-time updates
  useEffect(() => {
    // Only attempt to connect if we have a token
    if (!token) return;

    let isComponentMounted = true;

    // Vytvoření funkce pro bezpečnou aktualizaci stavu fronty při selhání WebSocketu
    const updateQueueStatus = async () => {
      if (!isComponentMounted) return;

      try {
        // Pomocná funkce pro normalizaci dat
        const normalizeQueueStatusData = (rawData: any) => {
          // Získáme vlastní data z odpovědi (může být v data.data nebo přímo v data)
          const responseData = rawData.data || rawData;

          // Kontrola zda obsahuje runningTasks nebo aktivní úlohy
          const running = responseData.runningTasks || responseData.activeTasks || [];

          // Kontrola zda obsahuje queuedTasks, pendingTasks, nebo queuedImages
          const queued = responseData.queuedTasks || responseData.pendingTasks || [];

          // Spojíme všechny processingImages z různých zdrojů
          const processingImages = responseData.processingImages || [];

          // Pokud máme běžící úlohy, ale nemáme žádné processingImages, vytvoříme zástupné položky
          const enhancedProcessingImages =
            running.length > 0 && processingImages.length === 0
              ? running.map((taskId: string) => ({
                  id: taskId,
                  name: `Processing ${taskId.substring(0, 8)}...`,
                  projectId: responseData.projectId || projectId || 'unknown',
                }))
              : processingImages;

          // Extrahujeme images data - pro počty z databáze
          const imagesData = responseData.images || {};

          return {
            ...responseData,
            runningTasks: running,
            queuedTasks: queued,
            processingImages: enhancedProcessingImages,
            queueLength: responseData.queueLength || queued.length || 0,
            activeTasksCount: responseData.activeTasksCount || running.length || 0,
            timestamp: responseData.timestamp || new Date().toISOString(),
            // Zachováme images data pro počty z databáze
            images: imagesData,
          };
        };

        // Zkusíme získat status specifický pro projekt, pokud máme projectId
        if (projectId) {
          // Pole endpointů k vyzkoušení
          const endpoints = [
            `/api/segmentation/queue-status/${projectId}`,
            `/api/segmentation/queue-status/${projectId}`,
            `/api/segmentation/queue-status/${projectId}`,
          ];

          let success = false;

          // Vyzkoušíme všechny endpointy
          for (const endpoint of endpoints) {
            try {
              console.log(`Fetching queue status from ${endpoint}...`);
              const response = await apiClient.get(endpoint);

              if (isComponentMounted && response.data) {
                const normalizedData = normalizeQueueStatusData(response.data);
                setQueueStatus(normalizedData);
                success = true;
                break; // Úspěch, ukončíme cyklus
              }
            } catch (error) {
              console.debug(`Failed to fetch queue status from ${endpoint}: ${error}`);
              // Pokračujeme k dalšímu endpointu
            }
          }

          // Pokud se nám nepodařilo získat data z žádného endpointu, zkusíme globální endpointy
          if (!success) {
            console.log(`Failed to fetch project-specific queue status, trying global endpoints...`);
          } else {
            return; // Podařilo se nám získat projektová data, končíme
          }
        }

        // Zkusíme globální endpointy
        // Pole globálních endpointů k vyzkoušení
        const globalEndpoints = [
          '/api/segmentation/queue-status',
          '/api/segmentation/queue',
          '/api/segmentation/queue-status',
        ];

        let globalSuccess = false;

        // Vyzkoušíme všechny globální endpointy
        for (const endpoint of globalEndpoints) {
          try {
            console.log(`Fetching global queue status from ${endpoint}...`);
            const response = await apiClient.get(endpoint);

            if (isComponentMounted && response.data) {
              const normalizedData = normalizeQueueStatusData(response.data);

              // Pokud jsme v projektovém pohledu, filtrujeme globální data
              if (projectId) {
                // Filtrování podle projectId
                const filteredImages = normalizedData.processingImages.filter(
                  (img: any) => img.projectId === projectId || img.project_id === projectId,
                );

                const filteredRunning = filteredImages.map((img: any) => img.id);

                // Odhadujeme queueLength pro projekt
                const newQueueLength =
                  normalizedData.queueLength > 0 ? Math.max(1, Math.floor(normalizedData.queueLength / 3)) : 0;

                setQueueStatus({
                  ...normalizedData,
                  processingImages: filteredImages,
                  runningTasks: filteredRunning,
                  queueLength: newQueueLength,
                });
              } else {
                // Pro globální pohled použijeme všechna data
                setQueueStatus(normalizedData);
              }

              globalSuccess = true;
              break; // Úspěch, ukončíme cyklus
            }
          } catch (error) {
            console.debug(`Failed to fetch global queue status from ${endpoint}: ${error}`);
            // Pokračujeme k dalšímu endpointu
          }
        }

        // Pokud se nám nepodařilo získat žádná data, nastavíme prázdnou frontu
        if (!globalSuccess && isComponentMounted) {
          console.log('Failed to fetch any queue status data, setting empty queue');
          setQueueStatus({
            queueLength: 0,
            runningTasks: [],
            queuedTasks: [],
            pendingTasks: [],
            processingImages: [],
            timestamp: new Date().toISOString(),
          });
        }
      } catch (error) {
        console.error('Unexpected error in updateQueueStatus:', error);
        // Při neočekávaných chybách nastavíme prázdnou frontu
        if (isComponentMounted) {
          setQueueStatus({
            queueLength: 0,
            runningTasks: [],
            queuedTasks: [],
            pendingTasks: [],
            processingImages: [],
            timestamp: new Date().toISOString(),
          });
        }
      }
    };

    // Setup socket with error handling
    let socketConnectionTimeout: NodeJS.Timeout;
    let newSocket: Socket | null = null;

    // Set a timeout to use mock data if WebSocket connection fails
    socketConnectionTimeout = setTimeout(() => {
      if (isComponentMounted) {
        console.log('WebSocket connection timed out, using mock data');
        // Use mock data for offline mode
        updateQueueStatus();
      }
    }, 5000); // 5 second timeout

    try {
      // Use relative path for Socket.IO to work with any domain
      // This will connect to the same origin as the page
      console.log(`WebSocket: Using relative path for socket.io connection`);

      // Only include token in auth if it exists to avoid authentication errors
      const authOptions = token ? { auth: { token } } : {};

      // Initialize socket with relative path
      newSocket = io('', {
        ...authOptions,
        reconnectionAttempts: 1, // Only try once to prevent excessive reconnection attempts
        reconnectionDelay: 1000,
        timeout: 3000, // Very short timeout for faster failure detection
        transports: ['polling', 'websocket'], // Try polling first, then websocket
        path: '/socket.io', // Socket.io path that will be proxied
        autoConnect: true,
        forceNew: true, // Create a new connection to avoid sharing issues
        reconnection: true,
        reconnectionDelayMax: 2000, // Reduced max delay
        randomizationFactor: 0.1, // Minimal randomization factor
        withCredentials: false, // Don't send cookies in Docker environment
      });

      // Listen for global socket offline event
      const handleSocketOffline = (event: CustomEvent) => {
        console.log('Received socket:offline event, using fallback data', event.detail);
        updateQueueStatus();
      };

      window.addEventListener('socket:offline', handleSocketOffline as EventListener);

      // Connection events
      newSocket.on('connect', () => {
        console.log('WebSocket connected for segmentation progress');
        setIsWebSocketConnected(true);
        // Clear the timeout since we connected successfully
        clearTimeout(socketConnectionTimeout);
      });

      newSocket.on('connect_error', (error) => {
        console.warn('WebSocket connection error:', error.message || error);
        setIsWebSocketConnected(false);
        // Pokud se nepodaří připojit, aktualizujeme data z API
        updateQueueStatus();
      });

      newSocket.on('disconnect', (reason) => {
        // Only log disconnect if it's not a normal client disconnect
        if (reason !== 'io client disconnect' && reason !== 'io server disconnect') {
          console.warn('WebSocket disconnected:', reason);
        }
        setIsWebSocketConnected(false);
        // Pokud se odpojíme, aktualizujeme data z API
        updateQueueStatus();
      });

      newSocket.on('error', (error) => {
        console.warn('WebSocket error:', error);
        setIsWebSocketConnected(false);
        // Pokud nastane chyba, aktualizujeme data z API
        updateQueueStatus();
      });

      // Queue update handler - upraveno pro podporu různých formátů ze socketu
      newSocket.on('segmentation_queue_update', (data: any) => {
        if (!isComponentMounted) return;

        console.log('Received segmentation_queue_update:', data);
        if (data) {
          // Pomocná funkce pro normalizaci dat z WebSocketu
          const normalizeQueueStatusData = (rawData: any) => {
            // Získáme vlastní data z odpovědi (může být v data.data nebo přímo v data)
            const responseData = rawData.data || rawData;

            // Kontrola zda obsahuje runningTasks nebo aktivní úlohy
            const running = responseData.runningTasks || responseData.activeTasks || [];

            // Kontrola zda obsahuje queuedTasks, pendingTasks, nebo queuedImages
            const queued = responseData.queuedTasks || responseData.pendingTasks || [];

            // Zachováme originální pendingTasks, pokud existují
            const pendingTasks = responseData.pendingTasks || [];

            // Spojíme všechny processingImages z různých zdrojů
            const processingImages = responseData.processingImages || [];

            // Získáme queuedImages, pokud existují
            const queuedImages = responseData.queuedImages || [];

            // Pokud máme běžící úlohy, ale nemáme žádné processingImages, vytvoříme zástupné položky
            const enhancedProcessingImages =
              running.length > 0 && processingImages.length === 0
                ? running.map((taskId: string) => ({
                    id: taskId,
                    name: `Processing ${taskId.substring(0, 8)}...`,
                    projectId: responseData.projectId || projectId || 'unknown',
                  }))
                : processingImages;

            // Pokud máme čekající úlohy, ale nemáme žádné queuedImages, vytvoříme zástupné položky
            const enhancedQueuedImages =
              queued.length > 0 && queuedImages.length === 0
                ? queued.map((taskId: string) => ({
                    id: taskId,
                    name: `Queued ${taskId.substring(0, 8)}...`,
                    projectId: responseData.projectId || projectId || 'unknown',
                  }))
                : queuedImages;

            // Extrahujeme images data - pro počty z databáze
            const imagesData = responseData.images || {};

            return {
              ...responseData,
              runningTasks: running,
              queuedTasks: queued,
              pendingTasks: pendingTasks, // Přidáme pendingTasks
              processingImages: enhancedProcessingImages,
              queuedImages: enhancedQueuedImages,
              queueLength: responseData.queueLength || queued.length || 0,
              activeTasksCount: responseData.activeTasksCount || running.length || 0,
              timestamp: responseData.timestamp || new Date().toISOString(),
              // Zachováme images data pro počty z databáze
              images: imagesData,
            };
          };

          // Normalizujeme data
          const updatedData = normalizeQueueStatusData(data);

          // Pokud jsme v projektovém pohledu, filtrujeme data, aby zobrazovala pouze úlohy pro tento projekt
          if (projectId) {
            // IMPORTANT: WebSocket sends global queue data without project info
            // We cannot reliably filter it, so we should fetch project-specific data from the API
            console.log('WebSocket data received for project view, fetching project-specific data from API');

            // Trigger API call to get accurate project-specific queue status
            updateQueueStatus();

            // For now, return without updating the state to avoid showing incorrect global data
            return;
          } else {
            // Pro globální pohled použijeme všechna data
            setQueueStatus(updatedData);
          }
        }
      });

      // Segmentation update handler
      newSocket.on('segmentation_update', (data) => {
        if (!isComponentMounted) return;

        console.log('Received segmentation_update:', data);
        updateQueueStatus();
      });

      // Store socket in state
      if (isComponentMounted) {
        setSocket(newSocket);
      }

      // Cleanup function
      return () => {
        isComponentMounted = false;
        setIsWebSocketConnected(false);
        clearTimeout(socketConnectionTimeout);

        // Remove event listener
        window.removeEventListener('socket:offline', handleSocketOffline as EventListener);

        if (newSocket) {
          try {
            newSocket.disconnect();
          } catch (error) {
            // Ignore WebSocket disconnection errors
          }
        }
      };
    } catch (socketError) {
      console.error('Error setting up WebSocket:', socketError);
      // Clear the timeout and use mock data immediately
      clearTimeout(socketConnectionTimeout);
      updateQueueStatus();

      return () => {
        isComponentMounted = false;
        clearTimeout(socketConnectionTimeout);
      };
    }
  }, [token, projectId]); // Include projectId in dependencies

  // Vždy zobrazíme ukazatel fronty, i když je prázdná
  // Tím zajistíme, že uživatel vidí, že fronta existuje, i když je prázdná
  const displayQueueStatus = queueStatus || {
    queueLength: 0,
    runningTasks: [],
    queuedTasks: [],
    pendingTasks: [],
    processingImages: [],
    queuedImages: [],
  };

  // Pokud jsme v detailu projektu, filtrujeme úkoly podle projektu
  // Ale vždy zobrazíme ukazatel fronty, i když je prázdná
  let filteredQueueStatus = { ...displayQueueStatus };

  if (projectId && displayQueueStatus) {
    // Only log if there are actually some tasks to avoid spam
    const totalTasks =
      (displayQueueStatus.processingImages?.length || 0) +
      (displayQueueStatus.queuedImages?.length || 0) +
      (displayQueueStatus.queuedTasks?.length || 0) +
      (displayQueueStatus.pendingTasks?.length || 0) +
      (displayQueueStatus.runningTasks?.length || 0);

    if (totalTasks > 0) {
      console.log('Filtering queue status for project:', projectId);
      console.log('Original queue status:', {
        processingImagesCount: displayQueueStatus.processingImages?.length || 0,
        queuedImagesCount: displayQueueStatus.queuedImages?.length || 0,
        queuedTasksCount: displayQueueStatus.queuedTasks?.length || 0,
        pendingTasksCount: displayQueueStatus.pendingTasks?.length || 0,
        runningTasksCount: displayQueueStatus.runningTasks?.length || 0,
      });
    }

    // Filtrujeme obrázky podle projektu
    const projectImages =
      displayQueueStatus.processingImages && displayQueueStatus.processingImages.length > 0
        ? displayQueueStatus.processingImages.filter((img) => img.projectId === projectId)
        : [];

    // Filtrujeme čekající obrázky podle projektu
    const queuedProjectImages =
      displayQueueStatus.queuedImages && displayQueueStatus.queuedImages.length > 0
        ? displayQueueStatus.queuedImages.filter((img) => img.projectId === projectId)
        : [];

    // Vytváříme novou instanci queueStatus s filtrovanými daty
    filteredQueueStatus = {
      ...displayQueueStatus,
      processingImages: projectImages,
      queuedImages: queuedProjectImages,
      queuedTasks:
        displayQueueStatus.queuedTasks && displayQueueStatus.queuedTasks.length > 0
          ? displayQueueStatus.queuedTasks.filter((task) => typeof task === 'string' && task.includes(projectId))
          : [],
      pendingTasks:
        displayQueueStatus.pendingTasks && displayQueueStatus.pendingTasks.length > 0
          ? displayQueueStatus.pendingTasks.filter((task) => typeof task === 'string' && task.includes(projectId))
          : [],
    };

    // Only log filtered results if there were originally some tasks
    if (totalTasks > 0) {
      console.log('Filtered queue status:', {
        processingImagesCount: filteredQueueStatus.processingImages?.length || 0,
        queuedImagesCount: filteredQueueStatus.queuedImages?.length || 0,
        queuedTasksCount: filteredQueueStatus.queuedTasks?.length || 0,
        pendingTasksCount: filteredQueueStatus.pendingTasks?.length || 0,
        runningTasksCount: filteredQueueStatus.runningTasks?.length || 0,
      });
    }
  }

  // Získáme skutečné počty z backendové databáze pro images
  // Processing count from backend "images" data, pokud existuje
  const processingImagesCount = filteredQueueStatus.images?.processing_count
    ? parseInt(filteredQueueStatus.images.processing_count, 10) || 0
    : 0;

  // Pending count from backend "images" data, pokud existuje
  const pendingImagesCount = filteredQueueStatus.images?.pending_count
    ? parseInt(filteredQueueStatus.images.pending_count, 10) || 0
    : 0;

  // Queued count from filteredQueueStatus.queuedImages
  const queuedImagesCount = filteredQueueStatus.queuedImages?.length || 0;

  // Calculate task counts based on available data, but don't exaggerate unknown values

  // For running tasks, prefer the most specific count
  let runningTasksCount = 0;
  if (filteredQueueStatus.processingImages?.length > 0) {
    // If we have processing images info, this is the most accurate
    runningTasksCount = filteredQueueStatus.processingImages.length;
  } else if (processingImagesCount > 0) {
    // If we have processing count from backend, use it
    runningTasksCount = processingImagesCount;
  } else if (filteredQueueStatus.runningTasks?.length > 0) {
    // Last option: running tasks IDs
    runningTasksCount = filteredQueueStatus.runningTasks.length;
  }

  // For queued tasks, prefer the most specific count
  let queuedTasksCount = 0;
  if (filteredQueueStatus.queuedImages?.length > 0) {
    // If we have queued images info, this is the most accurate
    queuedTasksCount = filteredQueueStatus.queuedImages.length;
  } else if (pendingImagesCount > 0) {
    // If we have pending count from backend, use it
    queuedTasksCount = pendingImagesCount;
  } else if (filteredQueueStatus.pendingTasks?.length > 0) {
    // If we have pending tasks list, use it
    queuedTasksCount = filteredQueueStatus.pendingTasks.length;
  } else if (filteredQueueStatus.queuedTasks?.length > 0) {
    // If we have queued tasks list, use it
    queuedTasksCount = filteredQueueStatus.queuedTasks.length;
  } else if (filteredQueueStatus.queueLength > 0) {
    // Last option: queue length
    queuedTasksCount = filteredQueueStatus.queueLength;
  }

  // Only log task counts if there are actually some tasks
  const totalCalculatedTasks = runningTasksCount + queuedTasksCount;
  if (totalCalculatedTasks > 0) {
    console.log('Calculated task counts:', {
      runningTasksCount,
      queuedTasksCount,
      queuedTasksLength: filteredQueueStatus.queuedTasks?.length ?? 0,
      pendingTasksLength: filteredQueueStatus.pendingTasks?.length ?? 0,
      queueLength: filteredQueueStatus.queueLength ?? 0,
      pendingImagesCount,
      queuedImagesCount,
    });
  }

  const totalTasks = runningTasksCount + queuedTasksCount;

  // Calculate progress safely - cap at 50% until we implement progress tracking within tasks
  const progress = runningTasksCount > 0 ? Math.min(50, Math.floor((runningTasksCount / totalTasks) * 100)) : 0;

  // Prepare data for display in the queue
  let runningItems;
  // Only show "running" items if count is actually > 0
  if (runningTasksCount > 0) {
    if (Array.isArray(filteredQueueStatus.processingImages) && filteredQueueStatus.processingImages.length > 0) {
      // Pokud máme detailní informace o běžících úkolech, použijeme je
      runningItems = filteredQueueStatus.processingImages.map((item) => (
        <QueueItem key={item.id || item.name} name={item.name} status="running" />
      ));
    } else if (Array.isArray(filteredQueueStatus.runningTasks) && filteredQueueStatus.runningTasks.length > 0) {
      // Pokud nemáme detailní informace, ale máme ID úkolů, vytvoříme zástupné položky
      runningItems = filteredQueueStatus.runningTasks.map((taskId) => (
        <QueueItem key={taskId} name={`Task ${taskId.substring(0, 6)}...`} status="running" />
      ));
    } else {
      // Create placeholder running items based on count
      runningItems = Array.from({ length: runningTasksCount }).map((_, index) => (
        <QueueItem key={`running-${index}`} name={`Running task ${index + 1}`} status="running" />
      ));
    }
  } else {
    // Pokud nemáme žádné běžící úkoly
    runningItems = (
      <div className="p-3 text-sm text-gray-500 dark:text-gray-400 text-center">
        {t('segmentation.queue.noRunningTasks')}
      </div>
    );
  }

  // Prepare queued items
  let queuedItems;
  if (Array.isArray(filteredQueueStatus.queuedImages) && filteredQueueStatus.queuedImages.length > 0) {
    // First priority: if we have detailed queued images info, show them
    queuedItems = filteredQueueStatus.queuedImages.map((item) => (
      <QueueItem key={item.id || item.name} name={item.name} status="queued" />
    ));
  } else if (Array.isArray(filteredQueueStatus.pendingTasks) && filteredQueueStatus.pendingTasks.length > 0) {
    // Second priority: if we have pending tasks IDs
    queuedItems = filteredQueueStatus.pendingTasks.map((taskId) => (
      <QueueItem key={taskId} name={`Task ${taskId.substring(0, 6)}...`} status="queued" />
    ));
  } else if (Array.isArray(filteredQueueStatus.queuedTasks) && filteredQueueStatus.queuedTasks.length > 0) {
    // Third priority: alternative name for pending tasks
    queuedItems = filteredQueueStatus.queuedTasks.map((taskId) => (
      <QueueItem key={taskId} name={`Task ${taskId.substring(0, 6)}...`} status="queued" />
    ));
  } else if (queuedTasksCount > 0) {
    // Fourth priority: if we have a count but no details, create placeholder items
    queuedItems = Array.from({ length: Math.min(queuedTasksCount, 5) }).map((_, index) => (
      <QueueItem key={`queued-${index}`} name={`Queued task ${index + 1}`} status="queued" />
    ));
  } else {
    // No queued tasks
    queuedItems = (
      <div className="p-3 text-sm text-gray-500 dark:text-gray-400 text-center">
        {t('segmentation.queue.noQueuedTasks')}
      </div>
    );
  }

  return (
    <div className="relative ml-auto" ref={menuRef}>
      <div className="flex items-center space-x-2 cursor-pointer" onClick={() => setIsOpen(!isOpen)}>
        <div className="text-sm text-gray-600 dark:text-gray-300">
          {runningTasksCount > 0 ? (
            <span>
              {queuedTasksCount > 0
                ? t('segmentation.queue.statusRunning', { count: runningTasksCount, queued: queuedTasksCount })
                : t('segmentation.queue.statusProcessing', { count: runningTasksCount })}
            </span>
          ) : queuedTasksCount > 0 ? (
            <span>
              {queuedTasksCount === 1
                ? t('segmentation.queue.statusOnlyQueued_one')
                : t('segmentation.queue.statusOnlyQueued', { count: queuedTasksCount })}
            </span>
          ) : (
            <span>{t('segmentation.queue.statusReady')}</span>
          )}
        </div>
        <div className="w-32">
          <Progress value={progress} className="h-2" />
        </div>
        <Button variant="ghost" size="icon" className="h-6 w-6 p-0">
          {isOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </Button>
      </div>

      {/* Rozbalovací menu s detaily fronty */}
      {isOpen && (
        <div className="absolute right-0 top-full mt-2 w-80 bg-white dark:bg-gray-800 rounded-md shadow-lg z-50 overflow-hidden">
          <div className="p-3 border-b border-gray-100 dark:border-gray-700">
            <h3 className="font-medium text-sm">{t('segmentation.queue.title')}</h3>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              {t('segmentation.queue.tasksTotal', {
                total: totalTasks,
                running: runningTasksCount,
                queued: queuedTasksCount,
              })}
            </p>
          </div>

          <div className="max-h-60 overflow-y-auto">
            {runningItems}
            {queuedItems}
          </div>
        </div>
      )}
    </div>
  );
};

export default SegmentationProgress;
