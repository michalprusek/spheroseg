import React from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { X } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import { Button } from '@/components/ui/button';

interface KeyboardShortcutsHelpProps {
  onClose?: () => void;
}

const KeyboardShortcutsHelp: React.FC<KeyboardShortcutsHelpProps> = ({ onClose }) => {
  const { t } = useLanguage();

  const shortcuts = [
    { key: 'V', description: t('shortcuts.viewMode') || 'View Mode' },
    {
      key: 'E',
      description: t('shortcuts.editVerticesMode') || 'Edit Vertices Mode',
    },
    {
      key: 'A',
      description: t('shortcuts.addPointsMode') || 'Add Points Mode',
    },
    {
      key: 'C',
      description: t('shortcuts.createPolygonMode') || 'Create Polygon Mode',
    },
    { key: 'S', description: t('shortcuts.sliceMode') || 'Slice Mode' },
    { key: 'Ctrl+Z', description: t('shortcuts.undo') || 'Undo' },
    { key: 'Ctrl+Y', description: t('shortcuts.redo') || 'Redo' },
    {
      key: 'Delete',
      description: t('shortcuts.deletePolygon') || 'Delete Selected Polygon',
    },
    {
      key: 'Esc',
      description: t('shortcuts.cancel') || 'Cancel Current Operation',
    },
    { key: '+', description: t('shortcuts.zoomIn') || 'Zoom In' },
    { key: '-', description: t('shortcuts.zoomOut') || 'Zoom Out' },
    { key: 'R', description: t('shortcuts.resetView') || 'Reset View' },
    { key: 'Ctrl+S', description: t('shortcuts.save') || 'Save Segmentation' },
  ];

  return (
    <motion.div
      className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onClose}
    >
      <motion.div
        className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full p-6"
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.9, opacity: 0 }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
            {t('shortcuts.title') || 'Keyboard Shortcuts'}
          </h3>
          <Button variant="ghost" size="icon" onClick={onClose} className="h-8 w-8">
            <X className="h-4 w-4" />
          </Button>
        </div>

        <div className="grid gap-3">
          {shortcuts.map((shortcut, index) => (
            <motion.div
              key={index}
              className="flex items-center gap-3"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.03 }}
            >
              <div className="bg-gray-100 dark:bg-gray-700 rounded px-2.5 py-1 font-mono text-sm min-w-16 text-center">
                {shortcut.key}
              </div>
              <div className="text-sm text-gray-700 dark:text-gray-300">{shortcut.description}</div>
            </motion.div>
          ))}
        </div>

        <div className="mt-5 text-xs text-gray-500 dark:text-gray-400 border-t border-gray-200 dark:border-gray-700 pt-3">
          {t('shortcuts.description') ||
            'These shortcuts work within the segmentation editor for faster and more comfortable work.'}
        </div>
      </motion.div>
    </motion.div>
  );
};

export default KeyboardShortcutsHelp;
