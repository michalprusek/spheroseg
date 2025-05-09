import { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { useLanguage } from '@/contexts/LanguageContext';
import { CanvasSegmentationData } from '@/types';

/**
 * Hook for auto-saving segmentation data
 * 
 * @param segmentation The current segmentation data
 * @param historyIndex The current history index
 * @param historyLength The total length of the history
 * @param saving Whether a save operation is currently in progress
 * @param handleSave The function to call to save the segmentation
 * @param autoSaveDelay The delay in milliseconds before auto-saving (default: 30000 = 30 seconds)
 * @param enabled Whether auto-save is enabled (default: true)
 */
export const useAutoSave = (
  segmentation: CanvasSegmentationData | null,
  historyIndex: number,
  historyLength: number,
  saving: boolean,
  handleSave: () => Promise<void>,
  autoSaveDelay: number = 30000,
  enabled: boolean = true
) => {
  const { t } = useLanguage();
  const [lastSavedIndex, setLastSavedIndex] = useState<number>(historyIndex);
  const [autoSaveEnabled, setAutoSaveEnabled] = useState<boolean>(enabled);
  const autoSaveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const [autoSaveStatus, setAutoSaveStatus] = useState<'idle' | 'pending' | 'saving' | 'success' | 'error'>('idle');

  // Clear the auto-save timeout when the component unmounts
  useEffect(() => {
    return () => {
      if (autoSaveTimeoutRef.current) {
        clearTimeout(autoSaveTimeoutRef.current);
      }
    };
  }, []);

  // Set up auto-save when history changes
  useEffect(() => {
    // Skip if auto-save is disabled or if we're already saving
    if (!autoSaveEnabled || saving || !segmentation) {
      return;
    }

    // Skip if there are no unsaved changes
    if (historyIndex === lastSavedIndex) {
      return;
    }

    // Clear any existing timeout
    if (autoSaveTimeoutRef.current) {
      clearTimeout(autoSaveTimeoutRef.current);
    }

    // Set auto-save status to pending
    setAutoSaveStatus('pending');

    // Set a new timeout for auto-save
    autoSaveTimeoutRef.current = setTimeout(async () => {
      try {
        setAutoSaveStatus('saving');
        await handleSave();
        setLastSavedIndex(historyIndex);
        setAutoSaveStatus('success');
        toast.success(t('editor.autoSaveSuccess') || 'Changes auto-saved successfully');
      } catch (error) {
        console.error('Auto-save failed:', error);
        setAutoSaveStatus('error');
        toast.error(t('editor.autoSaveError') || 'Auto-save failed. Your changes are not saved.');
      }
    }, autoSaveDelay);

  }, [autoSaveEnabled, historyIndex, lastSavedIndex, saving, segmentation, handleSave, autoSaveDelay, t]);

  // Update lastSavedIndex when a manual save is successful
  useEffect(() => {
    if (!saving && autoSaveStatus !== 'saving') {
      setLastSavedIndex(historyIndex);
    }
  }, [saving, historyIndex, autoSaveStatus]);

  // Toggle auto-save
  const toggleAutoSave = () => {
    setAutoSaveEnabled(prev => !prev);
    toast.info(
      !autoSaveEnabled
        ? t('editor.autoSaveEnabled') || 'Auto-save enabled'
        : t('editor.autoSaveDisabled') || 'Auto-save disabled'
    );
  };

  // Force an immediate save
  const saveNow = async () => {
    if (saving || !segmentation) {
      return;
    }

    try {
      setAutoSaveStatus('saving');
      await handleSave();
      setLastSavedIndex(historyIndex);
      setAutoSaveStatus('success');
    } catch (error) {
      console.error('Manual save failed:', error);
      setAutoSaveStatus('error');
    }
  };

  // Calculate if there are unsaved changes
  const hasUnsavedChanges = historyIndex !== lastSavedIndex;

  return {
    autoSaveEnabled,
    toggleAutoSave,
    saveNow,
    autoSaveStatus,
    hasUnsavedChanges,
    lastSavedIndex
  };
};
