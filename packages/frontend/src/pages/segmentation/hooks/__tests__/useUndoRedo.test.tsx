import { renderHook, act } from '@testing-library/react';
import { useUndoRedo } from '@/hooks/useUndoRedo';
import { describe, it, expect } from 'vitest';

describe('useUndoRedo hook', () => {
  it('should initialize with initial state', () => {
    const initialState = { value: 1 };
    const { result } = renderHook(() => useUndoRedo(initialState));

    expect(result.current.state).toEqual(initialState);
    expect(result.current.historyIndex).toBe(0);
    expect(result.current.history).toEqual([initialState]);
    expect(result.current.canUndo).toBe(false);
    expect(result.current.canRedo).toBe(false);
  });

  it('should update state and history when setState is called', () => {
    const initialState = { value: 1 };
    const { result } = renderHook(() => useUndoRedo(initialState));

    act(() => {
      result.current.setState({ value: 2 });
    });

    expect(result.current.state).toEqual({ value: 2 });
    expect(result.current.historyIndex).toBe(1);
    expect(result.current.history).toEqual([{ value: 1 }, { value: 2 }]);
    expect(result.current.canUndo).toBe(true);
    expect(result.current.canRedo).toBe(false);
  });

  it('should not update history when skipHistory is true', () => {
    const initialState = { value: 1 };
    const { result } = renderHook(() => useUndoRedo(initialState));

    act(() => {
      result.current.setState({ value: 2 }, true);
    });

    expect(result.current.state).toEqual({ value: 2 });
    expect(result.current.historyIndex).toBe(0); // Remains at 0
    expect(result.current.history).toEqual([{ value: 1 }]); // History unchanged
    expect(result.current.canUndo).toBe(false);
    expect(result.current.canRedo).toBe(false);
  });

  it('should undo to previous state', () => {
    const initialState = { value: 1 };
    const { result } = renderHook(() => useUndoRedo(initialState));

    // Add a new state
    act(() => {
      result.current.setState({ value: 2 });
    });

    // Undo to initial state
    act(() => {
      result.current.undo();
    });

    expect(result.current.state).toEqual({ value: 1 });
    expect(result.current.historyIndex).toBe(0);
    expect(result.current.canUndo).toBe(false);
    expect(result.current.canRedo).toBe(true);
  });

  it('should redo to next state after undo', () => {
    const initialState = { value: 1 };
    const { result } = renderHook(() => useUndoRedo(initialState));

    // Add two new states
    act(() => {
      result.current.setState({ value: 2 });
      result.current.setState({ value: 3 });
    });

    // Undo twice
    act(() => {
      result.current.undo();
      result.current.undo();
    });

    // Redo once
    act(() => {
      result.current.redo();
    });

    expect(result.current.state).toEqual({ value: 2 });
    expect(result.current.historyIndex).toBe(1);
    expect(result.current.canUndo).toBe(true);
    expect(result.current.canRedo).toBe(true);
  });

  it('should truncate future history when setting state after undo', () => {
    const initialState = { value: 1 };
    const { result } = renderHook(() => useUndoRedo(initialState));

    // Add two new states
    act(() => {
      result.current.setState({ value: 2 });
      result.current.setState({ value: 3 });
    });

    // Undo to middle state
    act(() => {
      result.current.undo();
    });

    // Add a new state, which should truncate the future history
    act(() => {
      result.current.setState({ value: 4 });
    });

    expect(result.current.state).toEqual({ value: 4 });
    expect(result.current.historyIndex).toBe(2);
    expect(result.current.history).toEqual([{ value: 1 }, { value: 2 }, { value: 4 }]);
    expect(result.current.canUndo).toBe(true);
    expect(result.current.canRedo).toBe(false);
  });

  it('should not undo beyond the start of history', () => {
    const initialState = { value: 1 };
    const { result } = renderHook(() => useUndoRedo(initialState));

    // Try to undo when already at the beginning
    act(() => {
      result.current.undo();
    });

    expect(result.current.state).toEqual({ value: 1 });
    expect(result.current.historyIndex).toBe(0);
    expect(result.current.canUndo).toBe(false);
  });

  it('should not redo beyond the end of history', () => {
    const initialState = { value: 1 };
    const { result } = renderHook(() => useUndoRedo(initialState));

    // Add a new state
    act(() => {
      result.current.setState({ value: 2 });
    });

    // Try to redo when already at the end
    act(() => {
      result.current.redo();
    });

    expect(result.current.state).toEqual({ value: 2 });
    expect(result.current.historyIndex).toBe(1);
    expect(result.current.canRedo).toBe(false);
  });
});
