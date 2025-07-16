/**
 * Hook pro optimalizovanou práci se segmentacemi
 *
 * Tento hook poskytuje optimalizované funkce pro práci se segmentacemi:
 * - Efektivní vykreslování velkého počtu polygonů
 * - Optimalizované operace s polygony
 * - Automatické ukládání změn
 * - Undo/Redo funkcionalita
 * - Detekce kolizí polygonů
 * - Optimalizované výpočty metrik
 */

import { useState, useEffect, useRef } from 'react';
import { toast } from 'sonner';
import { createLogger } from '@/lib/logger';
import apiClient from '@/lib/apiClient';
import { useLocalStorage } from '@/hooks/useLocalStorage';
import { useDebounce } from '@/hooks/useDebounce';
import { simplifyPolygon } from '../utils/polygonSimplification';
import { fetchImageData, fetchSegmentationData, saveSegmentationData } from './segmentation/api';

// Typy
import type {
  ImageData,
  SegmentationData,
  Point,
  TransformState,
  InteractionState,
} from './segmentation/types';

export enum EditMode {
  VIEW = 'view',
  SELECT = 'select',
  DRAW = 'draw',
  EDIT = 'edit',
  DELETE = 'delete',
  SLICE = 'slice',
  ADD_POINTS = 'add_points',
}

// Vytvoření loggeru
const logger = createLogger('segmentation:useOptimizedSegmentation');

// Konfigurace
const AUTO_SAVE_INTERVAL = 30000; // 30 sekund
const MAX_HISTORY_SIZE = 50;
const SIMPLIFICATION_TOLERANCE = 0.5;

/**
 * Hook pro optimalizovanou práci se segmentacemi
 */
export function useOptimizedSegmentation(
  projectId: string | undefined,
  imageId: string | undefined,
  canvasRef: React.RefObject<HTMLDivElement>,
  t: (key: string) => string,
) {
  // Stav
  const [imageData, setImageData] = useState<ImageData | null>(null);
  const [segmentationData, setSegmentationData] = useState<SegmentationData | null>(null);
  const [transform, setTransform] = useState<TransformState>({
    zoom: 1,
    translateX: 0,
    translateY: 0,
  });
  const [editMode, setEditMode] = useState<EditMode>(EditMode.VIEW);
  const [selectedPolygonId, setSelectedPolygonId] = useState<string | null>(null);
  const [hoveredVertex, setHoveredVertex] = useState<{
    polygonId: string;
    vertexIndex: number;
  } | null>(null);
  const [tempPoints, setTempPoints] = useState<Point[]>([]);
  const [interactionState, setInteractionState] = useState<InteractionState>({
    isDragging: false,
    isDraggingVertex: false,
    isDrawing: false,
    isSlicing: false,
    isAddingPoints: false,
    startPoint: null,
    lastPoint: null,
  });
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [isResegmenting, setIsResegmenting] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Historie pro Undo/Redo
  const [history, setHistory] = useState<SegmentationData[]>([]);
  const [historyIndex, setHistoryIndex] = useState<number>(-1);

  // Auto-save
  const [autoSaveEnabled, setAutoSaveEnabled] = useLocalStorage('autoSaveEnabled', true);
  const [lastSaveTime, setLastSaveTime] = useState<number>(Date.now());
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState<boolean>(false);

  // Reference pro sledování změn
  const imageIdRef = useRef<string | undefined>(imageId);
  const projectIdRef = useRef<string | undefined>(projectId);
  const segmentationDataRef = useRef<SegmentationData | null>(null);
  const isShiftPressed = useRef<boolean>(false);
  const lastAutoAddedPoint = useRef<Point | null>(null);

  // Odvozené hodnoty
  const canUndo = historyIndex > 0;
  const canRedo = historyIndex < history.length - 1;

  // Debounced auto-save
  const debouncedSave = useDebounce(() => {
    if (autoSaveEnabled && hasUnsavedChanges && segmentationData) {
      saveNow();
    }
  }, AUTO_SAVE_INTERVAL);

  // Efekt pro načtení dat při změně imageId nebo projectId
  useEffect(() => {
    if (imageId !== imageIdRef.current || projectId !== projectIdRef.current) {
      imageIdRef.current = imageId;
      projectIdRef.current = projectId;

      if (imageId && projectId) {
        loadData();
      }
    }
  }, [imageId, projectId]);

  // Efekt pro auto-save
  useEffect(() => {
    if (autoSaveEnabled && hasUnsavedChanges) {
      debouncedSave();
    }
  }, [segmentationData, hasUnsavedChanges, autoSaveEnabled]);

  // Efekt pro sledování klávesových zkratek
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Shift') {
        isShiftPressed.current = true;
      }

      // Klávesové zkratky
      if (e.ctrlKey || e.metaKey) {
        if (e.key === 'z') {
          if (e.shiftKey) {
            // Ctrl+Shift+Z = Redo
            redo();
          } else {
            // Ctrl+Z = Undo
            undo();
          }
          e.preventDefault();
        } else if (e.key === 'y') {
          // Ctrl+Y = Redo
          redo();
          e.preventDefault();
        } else if (e.key === 's') {
          // Ctrl+S = Save
          saveNow();
          e.preventDefault();
        }
      } else {
        // Další klávesové zkratky
        if (e.key === 'Escape') {
          // Escape = Zrušení aktuální operace
          cancelCurrentOperation();
        } else if (e.key === 'Delete' || e.key === 'Backspace') {
          // Delete/Backspace = Smazání vybraného polygonu
          if (selectedPolygonId && editMode === EditMode.SELECT) {
            handleDeletePolygon(selectedPolygonId);
          }
        }
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.key === 'Shift') {
        isShiftPressed.current = false;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [selectedPolygonId, editMode]);

  // Aktualizace reference na segmentationData
  useEffect(() => {
    segmentationDataRef.current = segmentationData;
  }, [segmentationData]);

  /**
   * Načte data obrázku a segmentace
   */
  const loadData = async () => {
    if (!imageId || !projectId) {
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      logger.info(`Načítání dat pro obrázek ${imageId} v projektu ${projectId}`);

      // Načtení dat obrázku
      const fetchedImageData = await fetchImageData(projectId, imageId);

      // Nastavení dat obrázku
      setImageData(fetchedImageData);
      logger.info(`Načtena data obrázku:`, fetchedImageData);

      // Načtení dat segmentace
      const segmentationId = fetchedImageData.actualId || imageId;
      const segmentationData = await fetchSegmentationData(segmentationId, undefined, projectId);

      // Nastavení dat segmentace
      setSegmentationDataWithHistory(segmentationData, true);
      logger.info(`Načtena data segmentace:`, segmentationData);

      // Reset stavu
      setSelectedPolygonId(null);
      setHoveredVertex(null);
      setTempPoints([]);
      setEditMode(EditMode.VIEW);
      setInteractionState({
        isDragging: false,
        isDraggingVertex: false,
        isDrawing: false,
        isSlicing: false,
        isAddingPoints: false,
        startPoint: null,
        lastPoint: null,
      });

      // Reset transformace
      resetView();
    } catch (error) {
      logger.error(`Chyba při načítání dat:`, error);
      setError(error instanceof Error ? error.message : 'Neznámá chyba');
      toast.error(t('editor.loadError'));
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Nastaví data segmentace a aktualizuje historii
   */
  const setSegmentationDataWithHistory = (data: SegmentationData | null, resetHistory: boolean = false) => {
    if (!data) {
      setSegmentationData(null);
      return;
    }

    // Vytvoření kopie dat
    const newData: SegmentationData = {
      ...data,
      polygons: data.polygons ? [...data.polygons] : [],
    };

    // Nastavení dat
    setSegmentationData(newData);

    // Aktualizace historie
    if (resetHistory) {
      setHistory([newData]);
      setHistoryIndex(0);
    } else {
      // Oříznutí historie, pokud jsme uprostřed
      const newHistory = history.slice(0, historyIndex + 1);

      // Přidání nového stavu do historie
      newHistory.push(newData);

      // Omezení velikosti historie
      if (newHistory.length > MAX_HISTORY_SIZE) {
        newHistory.shift();
      }

      setHistory(newHistory);
      setHistoryIndex(newHistory.length - 1);
    }

    // Označení, že máme neuložené změny
    setHasUnsavedChanges(true);
  };

  /**
   * Aktualizuje data segmentace bez přidání do historie
   */
  const updateSegmentationWithoutHistory = (data: SegmentationData) => {
    // Vytvoření kopie dat
    const newData: SegmentationData = {
      ...data,
      polygons: data.polygons ? [...data.polygons] : [],
    };

    // Nastavení dat
    setSegmentationData(newData);

    // Označení, že máme neuložené změny
    setHasUnsavedChanges(true);
  };

  /**
   * Vrátí změny o krok zpět
   */
  const undo = () => {
    if (!canUndo) return;

    const newIndex = historyIndex - 1;
    setHistoryIndex(newIndex);
    setSegmentationData(history[newIndex]);
    setHasUnsavedChanges(true);
  };

  /**
   * Vrátí změny o krok vpřed
   */
  const redo = () => {
    if (!canRedo) return;

    const newIndex = historyIndex + 1;
    setHistoryIndex(newIndex);
    setSegmentationData(history[newIndex]);
    setHasUnsavedChanges(true);
  };

  /**
   * Uloží aktuální stav segmentace
   */
  const handleSave = async () => {
    if (isSaving || !segmentationData) return;

    setIsSaving(true);

    try {
      await saveNow();
      toast.success(t('editor.saveSuccess'));
    } catch (error) {
      logger.error(`Chyba při ukládání:`, error);
      toast.error(t('editor.saveError'));
    } finally {
      setIsSaving(false);
    }
  };

  /**
   * Uloží aktuální stav segmentace bez kontroly
   */
  const saveNow = async () => {
    if (!segmentationData || !imageId || !projectId) {
      return;
    }

    try {
      logger.info(`Ukládání segmentace pro obrázek ${imageId}`);

      // Optimalizace polygonů před uložením
      const optimizedPolygons = segmentationData.polygons.map((polygon) =>
        simplifyPolygon(polygon, SIMPLIFICATION_TOLERANCE),
      );

      const dataToSave: SegmentationData = {
        ...segmentationData,
        polygons: optimizedPolygons,
      };

      // Uložení dat
      await saveSegmentationData(projectId, imageId, imageData?.actualId, dataToSave);

      // Aktualizace času posledního uložení
      setLastSaveTime(Date.now());
      setHasUnsavedChanges(false);

      logger.info(`Segmentace úspěšně uložena`);
    } catch (error) {
      logger.error(`Chyba při ukládání segmentace:`, error);
      throw error;
    }
  };

  /**
   * Spustí opětovnou segmentaci obrázku
   */
  const handleResegment = async () => {
    if (isResegmenting || !imageId) return;

    try {
      setIsResegmenting(true);
      logger.info(`Spouštění opětovné segmentace pro obrázek ${imageId}`);

      toast.info(t('editor.resegmentStarted'));

      // Spuštění segmentace
      await apiClient.post(`/api/images/segmentation/trigger-batch`, {
        imageIds: [imageId],
        priority: 5,
        model_type: 'resunet',
      });

      toast.success(t('editor.resegmentSuccess'));
    } catch (error) {
      logger.error(`Chyba při spouštění opětovné segmentace:`, error);
      toast.error(t('editor.resegmentError'));
    } finally {
      setIsResegmenting(false);
    }
  };

  /**
   * Zruší aktuální operaci
   */
  const cancelCurrentOperation = () => {
    // Zrušení kreslení
    if (interactionState.isDrawing) {
      setTempPoints([]);
      setInteractionState((prev) => ({ ...prev, isDrawing: false }));
    }

    // Zrušení řezání
    if (interactionState.isSlicing) {
      setTempPoints([]);
      setInteractionState((prev) => ({ ...prev, isSlicing: false }));
    }

    // Zrušení přidávání bodů
    if (interactionState.isAddingPoints) {
      setTempPoints([]);
      setInteractionState((prev) => ({ ...prev, isAddingPoints: false }));
    }

    // Zrušení tažení
    if (interactionState.isDragging || interactionState.isDraggingVertex) {
      setInteractionState((prev) => ({
        ...prev,
        isDragging: false,
        isDraggingVertex: false,
      }));
    }

    // Přepnutí do režimu zobrazení
    setEditMode(EditMode.VIEW);
  };

  /**
   * Smaže polygon
   */
  const handleDeletePolygon = (polygonId: string) => {
    if (!segmentationData) return;

    // Vytvoření kopie dat
    const newData: SegmentationData = {
      ...segmentationData,
      polygons: segmentationData.polygons.filter((p) => p.id !== polygonId),
    };

    // Aktualizace dat
    setSegmentationDataWithHistory(newData);

    // Zrušení výběru
    if (selectedPolygonId === polygonId) {
      setSelectedPolygonId(null);
    }

    // Zrušení hoveru
    if (hoveredVertex?.polygonId === polygonId) {
      setHoveredVertex(null);
    }
  };

  /**
   * Resetuje pohled
   */
  const resetView = () => {
    if (!imageData || !canvasRef.current) return;

    const canvas = canvasRef.current;
    const { width, height } = imageData;

    // Výpočet optimálního zoomu
    const canvasWidth = canvas.clientWidth;
    const canvasHeight = canvas.clientHeight;

    const scaleX = canvasWidth / width;
    const scaleY = canvasHeight / height;
    const scale = Math.min(scaleX, scaleY) * 0.9;

    // Výpočet centrování
    const translateX = (canvasWidth - width * scale) / 2;
    const translateY = (canvasHeight - height * scale) / 2;

    // Nastavení transformace
    setTransform({
      zoom: scale,
      translateX,
      translateY,
    });
  };

  /**
   * Převede souřadnice myši na souřadnice plátna
   */
  const getCanvasCoordinates = (e: React.MouseEvent<HTMLDivElement>): Point => {
    if (!canvasRef.current) {
      return { x: 0, y: 0 };
    }

    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();

    // Výpočet souřadnic
    const x = (e.clientX - rect.left - transform.translateX) / transform.zoom;
    const y = (e.clientY - rect.top - transform.translateY) / transform.zoom;

    return { x, y };
  };

  /**
   * Zpracuje událost mouseDown
   */
  const onMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    // Implementace bude přidána později
  };

  /**
   * Zpracuje událost mouseMove
   */
  const onMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    // Implementace bude přidána později
  };

  /**
   * Zpracuje událost mouseUp
   */
  const onMouseUp = (e: React.MouseEvent<HTMLDivElement>) => {
    // Implementace bude přidána později
  };

  /**
   * Zpracuje událost wheel
   */
  const handleWheel = (e: React.WheelEvent<HTMLDivElement>) => {
    // Implementace bude přidána později
  };

  // Vrácení hodnot a funkcí
  return {
    // Stav
    imageData,
    segmentationData,
    transform,
    editMode,
    selectedPolygonId,
    hoveredVertex,
    tempPoints,
    interactionState,
    isLoading,
    isSaving,
    isResegmenting,
    error,
    canUndo,
    canRedo,
    autoSaveEnabled,
    hasUnsavedChanges,
    lastSaveTime,

    // Settery
    setImageData,
    setSegmentationData,
    setTransform,
    setEditMode,
    setSelectedPolygonId,
    setHoveredVertex,
    setTempPoints,
    setInteractionState,
    setAutoSaveEnabled,

    // Funkce
    loadData,
    setSegmentationDataWithHistory,
    updateSegmentationWithoutHistory,
    handleSave,
    saveNow,
    handleResegment,
    undo,
    redo,
    cancelCurrentOperation,
    handleDeletePolygon,
    resetView,
    getCanvasCoordinates,

    // Handlery událostí
    onMouseDown,
    onMouseMove,
    onMouseUp,
    handleWheel,
  };
}
