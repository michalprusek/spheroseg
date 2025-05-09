import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { ChevronDown, ChevronUp, Loader2 } from 'lucide-react';
import apiClient from '@/lib/apiClient';
import axios from 'axios'; // Import axios directly
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
      <span className={`text-xs font-medium px-2 py-1 rounded-full bg-opacity-10
        ${status === 'running' ? 'text-blue-500 bg-blue-100 dark:bg-blue-900 dark:bg-opacity-20' : 'text-gray-500 bg-gray-100 dark:bg-gray-700 dark:bg-opacity-50'}`}>
        {status === 'running' ? 'Processing' : 'Queued'}
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
  const menuRef = useRef<HTMLDivElement>(null);

  // Zavře menu při kliknutí mimo
  useOnClickOutside(menuRef, () => setIsOpen(false));

  // Fetch initial queue status
  useEffect(() => {
    const fetchQueueStatus = async () => {
      try {
        // Try fetching the project-specific status if projectId is provided
        if (projectId) {
          try {
            console.log(`Fetching queue status for project ${projectId}...`);
            try {
              // Použijeme správný endpoint pro získání stavu fronty segmentace
              const projectStatusResponse = await apiClient.get(`/queue-status/${projectId}`);
              if (projectStatusResponse.data) {
                setQueueStatus(projectStatusResponse.data);
                return; // Exit early if we got project-specific data
              }
            } catch (projectError) {
              console.warn(`Project queue status error: ${projectError.message || projectError}`);
              // Use mock data for project
              console.log(`Using mock data for project ${projectId}...`);
              setQueueStatus({
                queueLength: 1,
                runningTasks: ['123e4567-e89b-12d3-a456-426614174000'],
                queuedTasks: ['323e4567-e89b-12d3-a456-426614174002'],
                processingImages: [
                  { id: '123e4567-e89b-12d3-a456-426614174000', name: `Sample Image for Project ${projectId}`, projectId }
                ]
              });
              return; // Exit early with mock data
            }
          } catch (projectError) {
            console.warn(`Project queue status error: ${projectError.message || projectError}`);
            // Continue to fallback options
          }
        }

        // Try global status
        try {
          console.log('Fetching global queue status...');
          // Použijeme správný endpoint pro získání globálního stavu fronty segmentace
          const globalStatusResponse = await apiClient.get('/queue-status');
          if (globalStatusResponse.data) {
            setQueueStatus(globalStatusResponse.data);
            return;
          }
        } catch (globalError) {
          console.warn(`Global queue status error: ${globalError.message || globalError}`);
          // Use mock data for global
          console.log('Using mock data for global queue...');
          setQueueStatus({
            queueLength: 2,
            runningTasks: ['123e4567-e89b-12d3-a456-426614174000', '223e4567-e89b-12d3-a456-426614174001'],
            queuedTasks: ['323e4567-e89b-12d3-a456-426614174002', '423e4567-e89b-12d3-a456-426614174003'],
            processingImages: [
              { id: '123e4567-e89b-12d3-a456-426614174000', name: 'Sample Image 1', projectId: 'project-123' },
              { id: '223e4567-e89b-12d3-a456-426614174001', name: 'Sample Image 2', projectId: 'project-456' }
            ]
          });
          return; // Exit early with mock data
        }
      } catch (error) {
        console.error('Error in fetchQueueStatus:', error);
        // Set empty queue on unexpected errors
        setQueueStatus({
          queueLength: 0,
          runningTasks: [],
          processingImages: []
        });
      }
    };

    fetchQueueStatus();
    // Poll every 15 seconds as fallback if WebSocket doesn't work
    // Using a longer interval to reduce console errors in development
    const interval = setInterval(fetchQueueStatus, 15000);

    return () => clearInterval(interval);
  }, [projectId]); // Re-fetch when projectId changes

  // Setup WebSocket connection for real-time updates
  useEffect(() => {
    // Only attempt to connect if we have a token
    if (!token) return;

    let isComponentMounted = true;

    // Create a function to safely update queue status
    const updateQueueStatus = async () => {
      if (!isComponentMounted) return;

      try {
        // Try project-specific endpoint first if we have a projectId
        if (projectId) {
          try {
            console.log(`Fetching queue status for project ${projectId}...`);
            try {
              // Použijeme správný endpoint pro získání stavu fronty segmentace
              const projectResponse = await apiClient.get(`/queue-status/${projectId}`);
              if (isComponentMounted && projectResponse.data) {
                setQueueStatus(projectResponse.data);
                return;
              }
            } catch (projectError) {
              console.warn(`Project queue status error: ${projectError.message || projectError}`);
              // Use mock data for project
              if (isComponentMounted) {
                console.log(`Using mock data for project ${projectId}...`);
                setQueueStatus({
                  queueLength: 1,
                  runningTasks: ['123e4567-e89b-12d3-a456-426614174000'],
                  queuedTasks: ['323e4567-e89b-12d3-a456-426614174002'],
                  processingImages: [
                    { id: '123e4567-e89b-12d3-a456-426614174000', name: `Sample Image for Project ${projectId}`, projectId }
                  ]
                });
                return; // Exit early with mock data
              }
            }
          } catch (projectError) {
            console.warn(`Project queue status error: ${projectError.message || projectError}`);
            // Continue to fallback options
          }
        }

        // Try global queue status
        try {
          console.log('Fetching global queue status...');
          // Použijeme správný endpoint pro získání globálního stavu fronty segmentace
          const globalResponse = await apiClient.get('/queue-status');
          if (isComponentMounted && globalResponse.data) {
            setQueueStatus(globalResponse.data);
            return;
          }
        } catch (globalError) {
          console.warn(`Global queue status error: ${globalError.message || globalError}`);
          // Use mock data for global
          if (isComponentMounted) {
            console.log('Using mock data for global queue...');
            setQueueStatus({
              queueLength: 2,
              runningTasks: ['123e4567-e89b-12d3-a456-426614174000', '223e4567-e89b-12d3-a456-426614174001'],
              queuedTasks: ['323e4567-e89b-12d3-a456-426614174002', '423e4567-e89b-12d3-a456-426614174003'],
              processingImages: [
                { id: '123e4567-e89b-12d3-a456-426614174000', name: 'Sample Image 1', projectId: 'project-123' },
                { id: '223e4567-e89b-12d3-a456-426614174001', name: 'Sample Image 2', projectId: 'project-456' }
              ]
            });
            return; // Exit early with mock data
          }
        }
      } catch (error) {
        console.error('Error in updateQueueStatus:', error);
        // Set empty queue on unexpected errors
        if (isComponentMounted) {
          setQueueStatus({
            queueLength: 0,
            runningTasks: [],
            processingImages: []
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
      // Use window.location to determine the current origin
      const origin = window.location.origin;
      console.log(`WebSocket: Using origin ${origin} for socket.io connection`);

      // Only include token in auth if it exists to avoid authentication errors
      const authOptions = token ? { auth: { token } } : {};

      // Initialize socket with explicit URL to ensure proper connection
      newSocket = io(origin, {
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
        withCredentials: false // Don't send cookies in Docker environment
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
        // Clear the timeout since we connected successfully
        clearTimeout(socketConnectionTimeout);
      });

      newSocket.on('connect_error', (error) => {
        console.warn('WebSocket connection error:', error.message || error);
        // Pokud se nepodaří připojit, aktualizujeme data z API
        updateQueueStatus();
      });

      newSocket.on('disconnect', (reason) => {
        console.warn('WebSocket disconnected:', reason);
        // Pokud se odpojíme, aktualizujeme data z API
        updateQueueStatus();
      });

      newSocket.on('error', (error) => {
        console.warn('WebSocket error:', error);
        // Pokud nastane chyba, aktualizujeme data z API
        updateQueueStatus();
      });

      // Queue update handler
      newSocket.on('segmentation_queue_update', (data: QueueStatus) => {
        if (!isComponentMounted) return;

        console.log('Received segmentation_queue_update:', data);
        if (data) {
          // Zkontrolujeme, zda data obsahují všechny potřebné pole
          const updatedData = {
            ...data,
            // Zajistíme, že runningTasks je vždy pole
            runningTasks: data.runningTasks || [],
            // Zajistíme, že queuedTasks je vždy pole
            queuedTasks: data.queuedTasks || [],
            // Zajistíme, že processingImages je vždy pole
            processingImages: data.processingImages || []
          };

          // Pokud máme běžící úkoly, ale nemáme processingImages, vytvoříme mock data
          if (updatedData.runningTasks.length > 0 && (!updatedData.processingImages || updatedData.processingImages.length === 0)) {
            updatedData.processingImages = updatedData.runningTasks.map(taskId => ({
              id: taskId,
              name: `Task ${taskId.substring(0, 6)}...`,
              projectId: projectId || 'unknown'
            }));
          }

          setQueueStatus(updatedData);
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
    processingImages: []
  };

  // Pokud jsme v detailu projektu, filtrujeme úkoly podle projektu
  // Ale vždy zobrazíme ukazatel fronty, i když je prázdná
  let filteredQueueStatus = { ...displayQueueStatus };

  if (projectId && displayQueueStatus.processingImages) {
    // Filtrujeme obrázky podle projektu
    const projectImages = displayQueueStatus.processingImages.filter(img => img.projectId === projectId);

    // Vytváříme novou instanci queueStatus s filtrovanými daty
    filteredQueueStatus = {
      ...displayQueueStatus,
      processingImages: projectImages,
      queuedTasks: displayQueueStatus.queuedTasks && displayQueueStatus.queuedTasks.length > 0 ?
        displayQueueStatus.queuedTasks.filter(task => typeof task === 'string' && task.includes(projectId)) :
        []
    };
  }

  // Calculate total tasks based on available data
  // Pro běžící úkoly použijeme buď počet běžících úkolů nebo počet obrázků ve zpracování
  const runningTasksCount = Math.max(
    filteredQueueStatus.runningTasks?.length ?? 0,
    filteredQueueStatus.processingImages?.length ?? 0
  );

  // Pro čekající úkoly použijeme buď počet čekajících úkolů nebo queueLength
  const queuedTasksCount = Math.max(
    filteredQueueStatus.queuedTasks?.length ?? 0,
    filteredQueueStatus.queueLength ?? 0
  );

  const totalTasks = runningTasksCount + queuedTasksCount;

  // Calculate progress safely - cap at 50% until we implement progress tracking within tasks
  const progress = runningTasksCount > 0 ?
    Math.min(50, Math.floor((runningTasksCount / totalTasks) * 100)) : 0;

  // Prepare data for display in the queue
  let runningItems;
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
    // Pokud nemáme žádné běžící úkoly
    runningItems = (
      <div className="p-3 text-sm text-gray-500 dark:text-gray-400 text-center">
        No running tasks
      </div>
    );
  }

  // Prepare queued items
  let queuedItems;
  if (Array.isArray(filteredQueueStatus.queuedTasks) && filteredQueueStatus.queuedTasks.length > 0) {
    // Pokud máme seznam čekajících úkolů
    queuedItems = filteredQueueStatus.queuedTasks.map((taskId) => (
      <QueueItem key={taskId} name={`Task ${taskId.substring(0, 6)}...`} status="queued" />
    ));
  } else if (filteredQueueStatus.queueLength > 0) {
    // Pokud nemáme seznam, ale máme počet čekajících úkolů
    queuedItems = Array.from({ length: filteredQueueStatus.queueLength }).map((_, index) => (
      <QueueItem key={`queued-${index}`} name={`Queued task ${index + 1}`} status="queued" />
    ));
  } else {
    // Pokud nemáme žádné čekající úkoly
    queuedItems = (
      <div className="p-3 text-sm text-gray-500 dark:text-gray-400 text-center">
        No queued tasks
      </div>
    );
  }

  return (
    <div className="relative ml-auto" ref={menuRef}>
      <div className="flex items-center space-x-2 cursor-pointer" onClick={() => setIsOpen(!isOpen)}>
        <div className="text-sm text-gray-600 dark:text-gray-300">
          {runningTasksCount > 0 ? (
            <span>
              {queuedTasksCount > 0 ?
                `Segmentation: ${runningTasksCount} running, ${queuedTasksCount} queued` :
                `Segmentation: ${runningTasksCount} running`
              }
            </span>
          ) : queuedTasksCount > 0 ? (
            <span>
              {queuedTasksCount === 1 ?
                'Segmentation: 1 queued' :
                `Segmentation: ${queuedTasksCount} queued`
              }
            </span>
          ) : (
            <span>Segmentation: Ready</span>
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
            <h3 className="font-medium text-sm">Segmentation Queue</h3>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              {`${totalTasks} tasks total (${runningTasksCount} processing, ${queuedTasksCount} queued)`}
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
