import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { toastService } from '@/services/toastService';

/**
 * Component that keeps toast service translations in sync with i18n
 */
export const ToastTranslationInitializer: React.FC = () => {
  const { t, i18n } = useTranslation();

  useEffect(() => {
    // Update toast translations whenever language changes
    const updateTranslations = () => {
      toastService.setTranslations({
        confirm: t('common.confirm'),
        cancel: t('common.cancel'),
        copiedToClipboard: t('common.copiedToClipboard'),
        failedToCopy: t('common.failedToCopy'),
        networkError: t('errors.networkError'),
        retry: t('common.retry'),
        validationErrors: t('errors.validationErrors'),
      });
    };

    updateTranslations();

    // Listen for language changes
    i18n.on('languageChanged', updateTranslations);

    return () => {
      i18n.off('languageChanged', updateTranslations);
    };
  }, [t, i18n]);

  return null;
};