/**
 * Tests for useSegmentationHistory hook
 *
 * Tests the history management for segmentation data, including:
 * - Version tracking
 * - Undo/redo functionality
 * - Snapshot creation and restoration
 * - Handling dragging operations
 * - State hashing and optimization
 */

import { renderHook } from '@testing-library/react';
import { act } from 'react';
import { useSegmentationHistory } from '../useSegmentationHistory';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { toast } from 'sonner';
import { SegmentationResult } from '@/lib/segmentation';

// Mock dependencies
vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
  },
}));

// Mock the useLanguage hook
vi.mock('@/contexts/LanguageContext', () => ({
  useLanguage: () => ({
    t: (key: string) => {
      const translations: { [key: string]: string } = {
        'segmentation.undoWhileDraggingError': 'Cannot undo while dragging a point',
        'segmentation.undoRestored': 'Undo: Restored to previous state',
      };
      return translations[key] || key;
    },
  }),
}));

describe('useSegmentationHistory', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Use fake timers to control setTimeout
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // Helper function to create sample segmentation data
  const createSampleSegmentation = (id: string = '1'): SegmentationResult => ({
    id,
    image_id: 'img-1',
    status: 'completed',
    polygons: [
      {
        id: `poly-${id}`,
        type: 'external',
        points: [
          { x: 10, y: 10 },
          { x: 20, y: 10 },
          { x: 20, y: 20 },
          { x: 10, y: 20 },
        ],
      },
    ],
    imageWidth: 100,
    imageHeight: 100,
  });

  it('should initialize history with initial segmentation', () => {
    const initialSegmentation = createSampleSegmentation();
    const setSegmentation = vi.fn();

    const { result } = renderHook(() => useSegmentationHistory(initialSegmentation, setSegmentation));

    // History should be initialized with the initial segmentation
    expect(result.current.history.length).toBe(1);
    expect(result.current.historyIndex).toBe(0);
  });

  it('should add new history item when segmentation changes', () => {
    const initialSegmentation = createSampleSegmentation('1');
    const setSegmentation = vi.fn();

    const { result, rerender } = renderHook(
      ({ segmentation }) => useSegmentationHistory(segmentation, setSegmentation),
      { initialProps: { segmentation: initialSegmentation } },
    );

    // Create a modified segmentation with updated polygon points
    const modifiedSegmentation = {
      ...initialSegmentation,
      polygons: [
        {
          ...initialSegmentation.polygons[0],
          points: [
            { x: 10, y: 10 },
            { x: 30, y: 10 }, // Changed from 20 to 30
            { x: 30, y: 20 }, // Changed from 20 to 30
            { x: 10, y: 20 },
          ],
        },
      ],
    };

    // Update the segmentation
    rerender({ segmentation: modifiedSegmentation });

    // Fast-forward past the throttling delay
    act(() => {
      vi.advanceTimersByTime(400); // Throttling is set to 300ms
    });

    // History should now have 2 items
    expect(result.current.history.length).toBe(2);
    expect(result.current.historyIndex).toBe(1);
  });

  it('should not add duplicate history items for identical changes', () => {
    const initialSegmentation = createSampleSegmentation('1');
    const setSegmentation = vi.fn();

    const { result, rerender } = renderHook(
      ({ segmentation }) => useSegmentationHistory(segmentation, setSegmentation),
      { initialProps: { segmentation: initialSegmentation } },
    );

    // Create a clone of the same segmentation (should be viewed as identical)
    const clonedSegmentation = structuredClone(initialSegmentation);

    // Update with the cloned segmentation
    rerender({ segmentation: clonedSegmentation });

    // Fast-forward past throttling
    act(() => {
      vi.advanceTimersByTime(400);
    });

    // History should still only have 1 item
    expect(result.current.history.length).toBe(1);
    expect(result.current.historyIndex).toBe(0);
  });

  it('should handle undo operation correctly', () => {
    const initialSegmentation = createSampleSegmentation('1');
    const setSegmentation = vi.fn();

    const { result, rerender } = renderHook(
      ({ segmentation }) => useSegmentationHistory(segmentation, setSegmentation),
      { initialProps: { segmentation: initialSegmentation } },
    );

    // Add a second state
    const modifiedSegmentation = {
      ...initialSegmentation,
      polygons: [
        {
          ...initialSegmentation.polygons[0],
          points: [
            { x: 10, y: 10 },
            { x: 30, y: 10 },
            { x: 30, y: 30 },
            { x: 10, y: 30 },
          ],
        },
      ],
    };

    rerender({ segmentation: modifiedSegmentation });

    // Fast-forward past throttling
    act(() => {
      vi.advanceTimersByTime(400);
    });

    // Perform undo operation
    act(() => {
      result.current.handleUndo();
    });

    // setSegmentation should be called with the initial state
    expect(setSegmentation).toHaveBeenCalledWith(
      expect.objectContaining({
        id: initialSegmentation.id,
        polygons: expect.arrayContaining([
          expect.objectContaining({
            points: expect.arrayContaining([
              { x: 10, y: 10 },
              { x: 20, y: 10 },
              { x: 20, y: 20 },
              { x: 10, y: 20 },
            ]),
          }),
        ]),
      }),
    );

    // Toast should be shown
    expect(toast.info).toHaveBeenCalledWith('segmentation.undoRestored');
  });

  it('should handle redo operation correctly', () => {
    const initialSegmentation = createSampleSegmentation('1');
    const setSegmentation = vi.fn();

    const { result, rerender } = renderHook(
      ({ segmentation }) => useSegmentationHistory(segmentation, setSegmentation),
      { initialProps: { segmentation: initialSegmentation } },
    );

    // Add a second state
    const modifiedSegmentation = {
      ...initialSegmentation,
      polygons: [
        {
          ...initialSegmentation.polygons[0],
          points: [
            { x: 10, y: 10 },
            { x: 30, y: 10 },
            { x: 30, y: 30 },
            { x: 10, y: 30 },
          ],
        },
      ],
    };

    rerender({ segmentation: modifiedSegmentation });

    // Fast-forward past throttling
    act(() => {
      vi.advanceTimersByTime(400);
    });

    // Perform undo operation
    act(() => {
      result.current.handleUndo();
    });

    // Reset the mock to clearly see the next call
    setSegmentation.mockReset();

    // Perform redo operation
    act(() => {
      result.current.handleRedo();
    });

    // setSegmentation should be called with the modified state
    expect(setSegmentation).toHaveBeenCalledWith(
      expect.objectContaining({
        id: modifiedSegmentation.id,
        polygons: expect.arrayContaining([
          expect.objectContaining({
            points: expect.arrayContaining([
              { x: 10, y: 10 },
              { x: 30, y: 10 },
              { x: 30, y: 30 },
              { x: 10, y: 30 },
            ]),
          }),
        ]),
      }),
    );

    // Toast should be shown
    expect(toast.info).toHaveBeenCalledWith('Redo: Obnoveno do následujícího stavu');
  });

  it('should properly track vertex dragging', () => {
    const initialSegmentation = createSampleSegmentation('1');
    const setSegmentation = vi.fn();

    const { result, rerender } = renderHook(
      ({ segmentation }) => useSegmentationHistory(segmentation, setSegmentation),
      { initialProps: { segmentation: initialSegmentation } },
    );

    // Start dragging a vertex
    act(() => {
      result.current.setDraggingVertex(true);
    });

    // Update segmentation during drag
    const dragUpdatedSegmentation = {
      ...initialSegmentation,
      polygons: [
        {
          ...initialSegmentation.polygons[0],
          points: [
            { x: 10, y: 10 },
            { x: 25, y: 10 }, // Changed from 20 to 25 during drag
            { x: 20, y: 20 },
            { x: 10, y: 20 },
          ],
        },
      ],
    };

    rerender({ segmentation: dragUpdatedSegmentation });

    // Fast-forward past throttling
    act(() => {
      vi.advanceTimersByTime(400);
    });

    // History should not change during drag
    expect(result.current.history.length).toBe(1);
    expect(result.current.historyIndex).toBe(0);

    // End dragging
    act(() => {
      result.current.setDraggingVertex(false);
    });

    // History should now have 2 items (initial + after drag)
    expect(result.current.history.length).toBe(2);
    expect(result.current.historyIndex).toBe(1);
  });

  it('should not allow undo during vertex dragging', () => {
    const initialSegmentation = createSampleSegmentation('1');
    const setSegmentation = vi.fn();

    const { result } = renderHook(() => useSegmentationHistory(initialSegmentation, setSegmentation));

    // Start dragging
    act(() => {
      result.current.setDraggingVertex(true);
    });

    // Try to undo during drag
    act(() => {
      result.current.handleUndo();
    });

    // setSegmentation should not be called
    expect(setSegmentation).not.toHaveBeenCalled();

    // Error toast should be shown
    expect(toast.error).toHaveBeenCalledWith('segmentation.undoWhileDraggingError');
  });

  it('should create and restore snapshots', () => {
    const initialSegmentation = createSampleSegmentation('1');
    const setSegmentation = vi.fn();

    const { result, rerender } = renderHook(
      ({ segmentation }) => useSegmentationHistory(segmentation, setSegmentation),
      { initialProps: { segmentation: initialSegmentation } },
    );

    // Create a snapshot of initial state
    let snapshotIndex: number;
    act(() => {
      snapshotIndex = result.current.createSnapshot('Initial state');
    });

    expect(snapshotIndex).toBe(0);
    expect(toast.success).toHaveBeenCalledWith('Vytvořen snapshot: Initial state');

    // Modify segmentation
    const modifiedSegmentation = {
      ...initialSegmentation,
      polygons: [
        {
          ...initialSegmentation.polygons[0],
          points: [
            { x: 10, y: 10 },
            { x: 40, y: 10 },
            { x: 40, y: 40 },
            { x: 10, y: 40 },
          ],
        },
      ],
    };

    rerender({ segmentation: modifiedSegmentation });

    // Fast-forward past throttling
    act(() => {
      vi.advanceTimersByTime(400);
    });

    // Create another snapshot
    let snapshot2Index: number;
    act(() => {
      snapshot2Index = result.current.createSnapshot('Modified state');
    });

    expect(snapshot2Index).toBe(1);

    // Reset mock to clearly see next call
    setSegmentation.mockReset();

    // Restore first snapshot
    act(() => {
      result.current.restoreSnapshot(snapshotIndex);
    });

    // setSegmentation should be called with the initial state
    expect(setSegmentation).toHaveBeenCalledWith(
      expect.objectContaining({
        id: initialSegmentation.id,
        polygons: expect.arrayContaining([
          expect.objectContaining({
            points: expect.arrayContaining([
              { x: 10, y: 10 },
              { x: 20, y: 10 },
              { x: 20, y: 20 },
              { x: 10, y: 20 },
            ]),
          }),
        ]),
      }),
    );

    // Success toast should be shown
    expect(toast.success).toHaveBeenCalledWith('Snapshot byl obnoven');
  });

  it('should clear history properly', () => {
    const initialSegmentation = createSampleSegmentation('1');
    const setSegmentation = vi.fn();

    const { result, rerender } = renderHook(
      ({ segmentation }) => useSegmentationHistory(segmentation, setSegmentation),
      { initialProps: { segmentation: initialSegmentation } },
    );

    // Add multiple states
    const modifiedSegmentation1 = {
      ...initialSegmentation,
      polygons: [
        {
          ...initialSegmentation.polygons[0],
          points: [
            { x: 10, y: 10 },
            { x: 30, y: 10 },
            { x: 30, y: 30 },
            { x: 10, y: 30 },
          ],
        },
      ],
    };

    rerender({ segmentation: modifiedSegmentation1 });
    act(() => {
      vi.advanceTimersByTime(400);
    });

    const modifiedSegmentation2 = {
      ...modifiedSegmentation1,
      polygons: [
        {
          ...modifiedSegmentation1.polygons[0],
          points: [
            { x: 10, y: 10 },
            { x: 40, y: 10 },
            { x: 40, y: 40 },
            { x: 10, y: 40 },
          ],
        },
      ],
    };

    rerender({ segmentation: modifiedSegmentation2 });
    act(() => {
      vi.advanceTimersByTime(400);
    });

    // History should have 3 items now
    expect(result.current.history.length).toBe(3);
    expect(result.current.historyIndex).toBe(2);

    // Clear history
    act(() => {
      result.current.clearHistory();
    });

    // History should now have only 1 item (current state)
    expect(result.current.history.length).toBe(1);
    expect(result.current.historyIndex).toBe(0);
    expect(toast.info).toHaveBeenCalledWith('Historie byla vymazána');
  });

  it('should truncate future history when adding new states after undo', () => {
    const initialSegmentation = createSampleSegmentation('1');
    const setSegmentation = vi.fn();

    const { result, rerender } = renderHook(
      ({ segmentation }) => useSegmentationHistory(segmentation, setSegmentation),
      { initialProps: { segmentation: initialSegmentation } },
    );

    // Add state 2
    const modifiedSegmentation1 = {
      ...initialSegmentation,
      polygons: [
        {
          ...initialSegmentation.polygons[0],
          points: [
            { x: 10, y: 10 },
            { x: 30, y: 10 },
            { x: 30, y: 30 },
            { x: 10, y: 30 },
          ],
        },
      ],
    };

    rerender({ segmentation: modifiedSegmentation1 });
    act(() => {
      vi.advanceTimersByTime(400);
    });

    // Add state 3
    const modifiedSegmentation2 = {
      ...modifiedSegmentation1,
      polygons: [
        {
          ...modifiedSegmentation1.polygons[0],
          points: [
            { x: 10, y: 10 },
            { x: 40, y: 10 },
            { x: 40, y: 40 },
            { x: 10, y: 40 },
          ],
        },
      ],
    };

    rerender({ segmentation: modifiedSegmentation2 });
    act(() => {
      vi.advanceTimersByTime(400);
    });

    // Undo to state 2
    act(() => {
      result.current.handleUndo();
    });

    // Now add a new state 3'
    const alternateSegmentation = {
      ...modifiedSegmentation1,
      polygons: [
        {
          ...modifiedSegmentation1.polygons[0],
          points: [
            { x: 10, y: 10 },
            { x: 35, y: 15 }, // Different from original state 3
            { x: 35, y: 35 },
            { x: 10, y: 35 },
          ],
        },
      ],
    };

    rerender({ segmentation: alternateSegmentation });
    act(() => {
      vi.advanceTimersByTime(400);
    });

    // History should have 3 items (original + state2 + alternate state3)
    expect(result.current.history.length).toBe(3);
    expect(result.current.historyIndex).toBe(2);

    // The last state should be the alternate one
    const lastState = result.current.history[2];
    expect(lastState.polygons[0].points[1].x).toBe(35); // From alternate state
    expect(lastState.polygons[0].points[1].y).toBe(15); // From alternate state
  });

  it('should handle missing or null segmentation data', () => {
    const setSegmentation = vi.fn();

    // Initialize with null segmentation
    const { result, rerender } = renderHook(
      ({ segmentation }) => useSegmentationHistory(segmentation, setSegmentation),
      { initialProps: { segmentation: null } },
    );

    // History should be empty
    expect(result.current.history.length).toBe(0);
    expect(result.current.historyIndex).toBe(-1);

    // Update with valid segmentation
    const validSegmentation = createSampleSegmentation();
    rerender({ segmentation: validSegmentation });

    // Fast-forward past throttling
    act(() => {
      vi.advanceTimersByTime(400);
    });

    // History should now have 1 item
    expect(result.current.history.length).toBe(1);
    expect(result.current.historyIndex).toBe(0);

    // Update with null again
    rerender({ segmentation: null });

    // History should not change
    expect(result.current.history.length).toBe(1);
    expect(result.current.historyIndex).toBe(0);
  });

  it('should handle large segmentation histories efficiently', () => {
    const initialSegmentation = createSampleSegmentation('1');
    const setSegmentation = vi.fn();

    const { result, rerender } = renderHook(
      ({ segmentation }) => useSegmentationHistory(segmentation, setSegmentation),
      { initialProps: { segmentation: initialSegmentation } },
    );

    // Add 20 states to history
    for (let i = 0; i < 20; i++) {
      const modifiedSegmentation = {
        ...initialSegmentation,
        polygons: [
          {
            ...initialSegmentation.polygons[0],
            points: [
              { x: 10, y: 10 },
              { x: 20 + i, y: 10 }, // Gradually increasing X
              { x: 20 + i, y: 20 + i }, // Gradually increasing X and Y
              { x: 10, y: 20 + i }, // Gradually increasing Y
            ],
          },
        ],
      };

      rerender({ segmentation: modifiedSegmentation });
      act(() => {
        vi.advanceTimersByTime(400);
      });
    }

    // History should have 21 items (initial + 20 states)
    expect(result.current.history.length).toBe(21);
    expect(result.current.historyIndex).toBe(20);

    // Test performance of multiple undo operations
    const startTime = performance.now();

    for (let i = 0; i < 10; i++) {
      act(() => {
        result.current.handleUndo();
      });
    }

    const endTime = performance.now();
    const duration = endTime - startTime;

    // 10 undo operations should be fast (< 50ms)
    expect(duration).toBeLessThan(50);

    // Should now be at state 10
    expect(result.current.historyIndex).toBe(10);
  });
});

describe('useSegmentationHistory integration', () => {
  it('should work correctly with vertex dragging and complex edits', () => {
    const initialSegmentation = {
      id: 'complex-test',
      image_id: 'img-2',
      status: 'completed',
      polygons: [
        {
          id: 'poly-1',
          type: 'external',
          points: [
            { x: 10, y: 10 },
            { x: 100, y: 10 },
            { x: 100, y: 100 },
            { x: 10, y: 100 },
          ],
        },
        {
          id: 'poly-2',
          type: 'external',
          points: [
            { x: 200, y: 200 },
            { x: 300, y: 200 },
            { x: 300, y: 300 },
            { x: 200, y: 300 },
          ],
        },
      ],
      imageWidth: 500,
      imageHeight: 500,
    };

    const setSegmentation = vi.fn();

    const { result, rerender } = renderHook(
      ({ segmentation }) => useSegmentationHistory(segmentation, setSegmentation),
      { initialProps: { segmentation: initialSegmentation } },
    );

    // 1. Start dragging vertices on first polygon
    act(() => {
      result.current.setDraggingVertex(true);
    });

    // 2. Update vertices during drag
    const draggedSegmentation = {
      ...initialSegmentation,
      polygons: [
        {
          ...initialSegmentation.polygons[0],
          points: [
            { x: 10, y: 10 },
            { x: 120, y: 15 }, // Changed
            { x: 100, y: 100 },
            { x: 10, y: 100 },
          ],
        },
        ...initialSegmentation.polygons.slice(1),
      ],
    };

    rerender({ segmentation: draggedSegmentation });
    act(() => {
      vi.advanceTimersByTime(400);
    });

    // 3. End dragging
    act(() => {
      result.current.setDraggingVertex(false);
    });

    // 4. Delete the second polygon
    const deletedPolygonSegmentation = {
      ...draggedSegmentation,
      polygons: [draggedSegmentation.polygons[0]], // Keep only first polygon
    };

    rerender({ segmentation: deletedPolygonSegmentation });
    act(() => {
      vi.advanceTimersByTime(400);
    });

    // 5. Add a new polygon
    const addedPolygonSegmentation = {
      ...deletedPolygonSegmentation,
      polygons: [
        ...deletedPolygonSegmentation.polygons,
        {
          id: 'poly-3',
          type: 'external',
          points: [
            { x: 350, y: 350 },
            { x: 400, y: 350 },
            { x: 400, y: 400 },
            { x: 350, y: 400 },
          ],
        },
      ],
    };

    rerender({ segmentation: addedPolygonSegmentation });
    act(() => {
      vi.advanceTimersByTime(400);
    });

    // History should now have 3 items (initial + after drag + after delete + after add)
    expect(result.current.history.length).toBe(4);
    expect(result.current.historyIndex).toBe(3);

    // 6. Undo twice to get back to after-drag state
    act(() => {
      result.current.handleUndo(); // Undo add polygon
      result.current.handleUndo(); // Undo delete polygon
    });

    // Should have called setSegmentation with the after-drag state
    expect(setSegmentation).toHaveBeenCalledWith(
      expect.objectContaining({
        polygons: expect.arrayContaining([
          expect.objectContaining({ id: 'poly-1' }),
          expect.objectContaining({ id: 'poly-2' }),
        ]),
      }),
    );

    // 7. Create snapshot at this point
    let snapshotIndex: number;
    act(() => {
      snapshotIndex = result.current.createSnapshot('After drag with two polygons');
    });

    // 8. Continue with more edits
    const finalSegmentation = {
      ...draggedSegmentation,
      polygons: [
        {
          ...draggedSegmentation.polygons[0],
          points: [
            { x: 5, y: 5 }, // Changed
            { x: 120, y: 15 },
            { x: 120, y: 120 }, // Changed
            { x: 5, y: 120 }, // Changed
          ],
        },
        {
          ...draggedSegmentation.polygons[1],
          points: [
            { x: 200, y: 200 },
            { x: 320, y: 200 }, // Changed
            { x: 320, y: 320 }, // Changed
            { x: 200, y: 320 }, // Changed
          ],
        },
      ],
    };

    rerender({ segmentation: finalSegmentation });
    act(() => {
      vi.advanceTimersByTime(400);
    });

    // 9. Now restore the snapshot
    setSegmentation.mockReset();
    act(() => {
      result.current.restoreSnapshot(snapshotIndex);
    });

    // Should have called setSegmentation with the snapshot state
    expect(setSegmentation).toHaveBeenCalledWith(
      expect.objectContaining({
        polygons: expect.arrayContaining([
          expect.objectContaining({
            id: 'poly-1',
            points: expect.arrayContaining([
              { x: 10, y: 10 },
              { x: 120, y: 15 }, // From the drag state
              { x: 100, y: 100 },
              { x: 10, y: 100 },
            ]),
          }),
          expect.objectContaining({ id: 'poly-2' }),
        ]),
      }),
    );
  });
});
