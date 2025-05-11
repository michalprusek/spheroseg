import React from 'react';
import { SegmentationResult } from '@/lib/segmentation';
import { useLanguage } from '@/contexts/LanguageContext';

interface StatusBarProps {
  segmentation: SegmentationResult | null;
  editMode?: string;
  autoSaveEnabled?: boolean;
  autoSaveStatus?: 'idle' | 'pending' | 'saving' | 'success' | 'error';
  hasUnsavedChanges?: boolean;
  onToggleAutoSave?: () => void;
}

const StatusBar = ({
  segmentation,
  editMode,
  autoSaveEnabled = false,
  autoSaveStatus = 'idle',
  hasUnsavedChanges = false,
  onToggleAutoSave = () => {},
}: StatusBarProps) => {
  const { t } = useLanguage();

  if (!segmentation || !segmentation.polygons) return null;

  // Get auto-save status text and color
  const getAutoSaveStatusInfo = () => {
    switch (autoSaveStatus) {
      case 'pending':
        return {
          text: t('segmentation.autoSave.pending') || 'Pending...',
          color: 'text-yellow-500',
        };
      case 'saving':
        return {
          text: t('segmentation.autoSave.saving') || 'Saving...',
          color: 'text-blue-500',
        };
      case 'success':
        return {
          text: t('segmentation.autoSave.success') || 'Saved',
          color: 'text-green-500',
        };
      case 'error':
        return {
          text: t('segmentation.autoSave.error') || 'Error',
          color: 'text-red-500',
        };
      default:
        return {
          text: t('segmentation.autoSave.idle') || 'Idle',
          color: 'text-gray-400',
        };
    }
  };

  const autoSaveInfo = getAutoSaveStatusInfo();

  // Vypočítáme celkový počet bodů napříč všemi polygony
  const totalVertices = segmentation.polygons.reduce(
    (sum, polygon) => sum + (polygon.points ? polygon.points.length : 0),
    0,
  );

  return (
    <div className="absolute bottom-0 left-0 right-0 h-8 bg-gray-800/90 dark:bg-black/80 text-white flex items-center justify-between px-4 text-xs">
      <div className="flex items-center space-x-8">
        <div className="flex items-center space-x-1">
          <span className="text-gray-400">{t('segmentation.totalPolygons')}:</span>
          <span>{segmentation.polygons.length}</span>
        </div>

        <div className="flex items-center space-x-1">
          <span className="text-gray-400">{t('segmentation.totalVertices')}:</span>
          <span>{totalVertices}</span>
        </div>

        <div className="flex items-center space-x-1">
          <span className="text-gray-400">{t('segmentation.completedSegmentation')}:</span>
          <span className="text-green-500">{segmentation.id ? t('common.yes') : t('common.no')}</span>
        </div>

        {segmentation.id && (
          <div className="flex items-center space-x-1">
            <span className="text-gray-400">{t('common.segmentation')} ID:</span>
            <span className="text-blue-400">seg-{segmentation.id.substring(0, 4)}</span>
          </div>
        )}

        {editMode && (
          <div className="flex items-center space-x-1">
            <span className="text-gray-400">{t('segmentation.mode')}:</span>
            <span
              className={`${
                editMode === 'edit' ? 'text-purple-500' : editMode === 'slice' ? 'text-red-500' : 'text-green-500'
              }`}
            >
              {editMode === 'edit'
                ? t('segmentation.modes.editMode')
                : editMode === 'slice'
                  ? t('segmentation.modes.slicingMode')
                  : t('segmentation.modes.pointAddingMode')}
            </span>
          </div>
        )}
      </div>

      {/* Auto-save status */}
      <div className="flex items-center space-x-4">
        {/* Unsaved changes indicator */}
        {hasUnsavedChanges && (
          <div className="flex items-center space-x-1">
            <span className="text-yellow-500">{t('segmentation.unsavedChanges') || 'Unsaved changes'}</span>
          </div>
        )}

        {/* Auto-save status */}
        <div className="flex items-center space-x-1">
          <button
            onClick={onToggleAutoSave}
            className={`px-2 py-0.5 rounded text-xs ${autoSaveEnabled ? 'bg-green-900/50 text-green-400' : 'bg-gray-700/50 text-gray-400'}`}
          >
            {autoSaveEnabled
              ? t('segmentation.autoSave.enabled') || 'Auto-save: On'
              : t('segmentation.autoSave.disabled') || 'Auto-save: Off'}
          </button>

          {autoSaveEnabled && <span className={`ml-2 ${autoSaveInfo.color}`}>{autoSaveInfo.text}</span>}
        </div>
      </div>
    </div>
  );
};

export default StatusBar;
