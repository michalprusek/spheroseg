import type { StateCreator } from 'zustand';
import type { StoreState } from '../index';

export interface Segment {
  id: string;
  imageId: string;
  polygon: Array<[number, number]>;
  area: number;
  perimeter: number;
  centroid: [number, number];
  color: string;
  label?: string;
  confidence?: number;
  metadata?: Record<string, any>;
  createdAt: string;
  updatedAt: string;
}

export interface SegmentationImage {
  id: string;
  url: string;
  name: string;
  width: number;
  height: number;
  format: string;
  size: number;
  uploadedAt: string;
  processedAt?: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  error?: string;
}

export interface SegmentationSlice {
  // State
  currentImage: SegmentationImage | null;
  segments: Segment[];
  selectedSegment: string | null;
  isProcessing: boolean;
  processingProgress: number;
  processingStatus: string;
  editMode: 'view' | 'draw' | 'edit' | 'delete';
  drawingPoints: Array<[number, number]>;
  
  // Actions
  setCurrentImage: (image: SegmentationImage | null) => void;
  loadSegments: (imageId: string) => Promise<void>;
  addSegment: (segment: Omit<Segment, 'id' | 'createdAt' | 'updatedAt'>) => void;
  updateSegment: (id: string, updates: Partial<Segment>) => void;
  deleteSegment: (id: string) => void;
  selectSegment: (id: string | null) => void;
  startProcessing: (imageId: string) => Promise<void>;
  updateProcessingProgress: (progress: number, status: string) => void;
  completeProcessing: (segments: Segment[]) => void;
  failProcessing: (error: string) => void;
  setEditMode: (mode: SegmentationSlice['editMode']) => void;
  addDrawingPoint: (point: [number, number]) => void;
  clearDrawingPoints: () => void;
  exportSegments: (format: 'json' | 'csv' | 'coco') => Promise<void>;
}

export const createSegmentationSlice: StateCreator<
  StoreState,
  [
    ['zustand/devtools', never],
    ['zustand/persist', unknown],
    ['zustand/subscribeWithSelector', never],
    ['zustand/immer', never]
  ],
  [],
  SegmentationSlice
> = (set, get) => ({
  // Initial state
  currentImage: null,
  segments: [],
  selectedSegment: null,
  isProcessing: false,
  processingProgress: 0,
  processingStatus: '',
  editMode: 'view',
  drawingPoints: [],
  
  // Actions
  setCurrentImage: (image) => {
    set((state) => {
      state.currentImage = image;
      state.segments = [];
      state.selectedSegment = null;
      state.editMode = 'view';
      state.drawingPoints = [];
    });
    
    // Load segments if image is set
    if (image) {
      get().loadSegments(image.id);
    }
  },
  
  loadSegments: async (imageId) => {
    try {
      const response = await fetch(`/api/segmentation/segments/${imageId}`, {
        headers: {
          'Authorization': `Bearer ${get().tokens?.accessToken}`,
        },
      });
      
      if (!response.ok) throw new Error('Failed to load segments');
      
      const segments = await response.json();
      
      set((state) => {
        state.segments = segments;
      });
    } catch (error) {
      console.error('Failed to load segments:', error);
      get().addNotification({
        type: 'error',
        title: 'Failed to load segments',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  },
  
  addSegment: (segmentData) => {
    const id = `seg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const now = new Date().toISOString();
    
    const segment: Segment = {
      ...segmentData,
      id,
      createdAt: now,
      updatedAt: now,
    };
    
    set((state) => {
      state.segments.push(segment);
    });
    
    // Save to backend
    fetch('/api/segmentation/segments', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${get().tokens?.accessToken}`,
      },
      body: JSON.stringify(segment),
    }).catch(console.error);
  },
  
  updateSegment: (id, updates) => {
    set((state) => {
      const index = state.segments.findIndex((s) => s.id === id);
      if (index !== -1) {
        state.segments[index] = {
          ...state.segments[index],
          ...updates,
          updatedAt: new Date().toISOString(),
        };
      }
    });
    
    // Update on backend
    fetch(`/api/segmentation/segments/${id}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${get().tokens?.accessToken}`,
      },
      body: JSON.stringify(updates),
    }).catch(console.error);
  },
  
  deleteSegment: (id) => {
    set((state) => {
      state.segments = state.segments.filter((s) => s.id !== id);
      if (state.selectedSegment === id) {
        state.selectedSegment = null;
      }
    });
    
    // Delete from backend
    fetch(`/api/segmentation/segments/${id}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${get().tokens?.accessToken}`,
      },
    }).catch(console.error);
  },
  
  selectSegment: (id) => {
    set((state) => {
      state.selectedSegment = id;
    });
  },
  
  startProcessing: async (imageId) => {
    set((state) => {
      state.isProcessing = true;
      state.processingProgress = 0;
      state.processingStatus = 'Initializing...';
    });
    
    try {
      // Listen for progress updates via WebSocket
      const { socket } = get();
      if (socket) {
        socket.on(`processing:${imageId}:progress`, ({ progress, status }) => {
          get().updateProcessingProgress(progress, status);
        });
        
        socket.on(`processing:${imageId}:complete`, ({ segments }) => {
          get().completeProcessing(segments);
        });
        
        socket.on(`processing:${imageId}:error`, ({ error }) => {
          get().failProcessing(error);
        });
      }
      
      // Start processing
      const response = await fetch(`/api/segmentation/process/${imageId}`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${get().tokens?.accessToken}`,
        },
      });
      
      if (!response.ok) {
        throw new Error('Failed to start processing');
      }
    } catch (error) {
      get().failProcessing(error instanceof Error ? error.message : 'Processing failed');
    }
  },
  
  updateProcessingProgress: (progress, status) => {
    set((state) => {
      state.processingProgress = progress;
      state.processingStatus = status;
    });
  },
  
  completeProcessing: (segments) => {
    set((state) => {
      state.segments = segments;
      state.isProcessing = false;
      state.processingProgress = 100;
      state.processingStatus = 'Completed';
    });
    
    get().addNotification({
      type: 'success',
      title: 'Processing Complete',
      message: `Found ${segments.length} segments`,
    });
    
    // Update image status
    if (get().currentImage) {
      set((state) => {
        if (state.currentImage) {
          state.currentImage.status = 'completed';
          state.currentImage.processedAt = new Date().toISOString();
        }
      });
    }
  },
  
  failProcessing: (error) => {
    set((state) => {
      state.isProcessing = false;
      state.processingProgress = 0;
      state.processingStatus = error;
      
      if (state.currentImage) {
        state.currentImage.status = 'failed';
        state.currentImage.error = error;
      }
    });
    
    get().addNotification({
      type: 'error',
      title: 'Processing Failed',
      message: error,
    });
  },
  
  setEditMode: (mode) => {
    set((state) => {
      state.editMode = mode;
      if (mode !== 'draw') {
        state.drawingPoints = [];
      }
    });
  },
  
  addDrawingPoint: (point) => {
    set((state) => {
      state.drawingPoints.push(point);
    });
  },
  
  clearDrawingPoints: () => {
    set((state) => {
      state.drawingPoints = [];
    });
  },
  
  exportSegments: async (format) => {
    const { segments, currentImage } = get();
    if (!segments.length || !currentImage) return;
    
    try {
      const response = await fetch('/api/segmentation/export', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${get().tokens?.accessToken}`,
        },
        body: JSON.stringify({
          imageId: currentImage.id,
          segments,
          format,
        }),
      });
      
      if (!response.ok) throw new Error('Export failed');
      
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `segments-${currentImage.name}-${format}`;
      a.click();
      URL.revokeObjectURL(url);
      
      get().addNotification({
        type: 'success',
        title: 'Export Successful',
        message: `Segments exported as ${format.toUpperCase()}`,
      });
    } catch (error) {
      get().addNotification({
        type: 'error',
        title: 'Export Failed',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  },
});