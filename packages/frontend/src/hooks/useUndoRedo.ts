import { useState, useCallback } from 'react';

export function useUndoRedo<T>(initialState: T) {
  const [history, setHistory] = useState<T[]>([initialState]);
  const [currentIndex, setCurrentIndex] = useState(0);

  const state = history[currentIndex];

  const setState = useCallback((value: T | ((prevState: T) => T), overwrite = false) => {
    const resolvedValue = typeof value === 'function'
      ? (value as (prevState: T) => T)(history[currentIndex])
      : value;

    if (Object.is(history[currentIndex], resolvedValue)) {
      return; // Avoid adding same state to history
    }

    const newIndex = currentIndex + 1;
    const newHistory = overwrite
      ? [resolvedValue]
      : [...history.slice(0, newIndex), resolvedValue];

    setHistory(newHistory);
    setCurrentIndex(overwrite ? 0 : newIndex);
  }, [currentIndex, history]);

  const undo = useCallback(() => {
    if (currentIndex > 0) {
      setCurrentIndex(currentIndex - 1);
    }
  }, [currentIndex]);

  const redo = useCallback(() => {
    if (currentIndex < history.length - 1) {
      setCurrentIndex(currentIndex + 1);
    }
  }, [currentIndex, history.length]);

  const canUndo = currentIndex > 0;
  const canRedo = currentIndex < history.length - 1;

  const clearHistory = useCallback(() => {
      setHistory([initialState]);
      setCurrentIndex(0);
  }, [initialState]);

  // Function to update current state without adding to history (useful for debouncing)
  const setCurrentStateOnly = useCallback((value: T) => {
      const newHistory = [...history];
      newHistory[currentIndex] = value;
      setHistory(newHistory);
  }, [history, currentIndex]);

  // Function to update the current state value directly without adding to history
  // Useful for live updates during continuous actions like dragging
  const setStateWithoutHistory = useCallback((value: T | ((prevState: T) => T)) => {
      const resolvedValue = typeof value === 'function'
          ? (value as (prevState: T) => T)(history[currentIndex])
          : value;
      
      // Avoid modifying history array if the value is identical
      if (Object.is(history[currentIndex], resolvedValue)) {
          return;
      }

      const newHistory = [...history];
      newHistory[currentIndex] = resolvedValue;
      setHistory(newHistory);
  }, [history, currentIndex]);

  return {
    state,
    setState,
    undo,
    redo,
    canUndo,
    canRedo,
    history,
    currentIndex,
    clearHistory,
    setCurrentStateOnly,
    setStateWithoutHistory
  };
}
