import { useState, useCallback } from 'react';

/**
 * A simple hook to manage undo/redo functionality for any state
 */
export function useUndoRedo<T>(initialState: T) {
  const [state, setState] = useState<T>(initialState);
  const [history, setHistory] = useState<T[]>([initialState]);
  const [historyIndex, setHistoryIndex] = useState<number>(0);

  const setStateWithHistory = useCallback(
    (newState: T, skipHistory: boolean = false) => {
      setState(newState);

      if (skipHistory) return;

      // Add new state to history, removing any future states if we're not at the end
      const newHistory = history.slice(0, historyIndex + 1);
      newHistory.push(newState);
      setHistory(newHistory);
      setHistoryIndex(newHistory.length - 1);
    },
    [history, historyIndex],
  );

  const undo = useCallback(() => {
    if (historyIndex > 0) {
      setHistoryIndex(historyIndex - 1);
      setState(history[historyIndex - 1]);
    }
  }, [history, historyIndex]);

  const redo = useCallback(() => {
    if (historyIndex < history.length - 1) {
      setHistoryIndex(historyIndex + 1);
      setState(history[historyIndex + 1]);
    }
  }, [history, historyIndex]);

  const canUndo = historyIndex > 0;
  const canRedo = historyIndex < history.length - 1;

  return {
    state,
    setState: setStateWithHistory,
    undo,
    redo,
    canUndo,
    canRedo,
    history,
    historyIndex,
  };
}
