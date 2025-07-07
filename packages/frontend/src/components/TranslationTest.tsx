import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Box, Paper, Typography, Button, Stack, Alert, CircularProgress } from '@mui/material';
import { localizationService } from '@/services/localizationService';

export const TranslationTest: React.FC = () => {
  const { t, i18n, ready } = useTranslation(['common', 'errors']);
  const [status, setStatus] = useState<'loading' | 'loaded' | 'error'>('loading');
  const [debugInfo, setDebugInfo] = useState<any>({});
  const [missingKeys, setMissingKeys] = useState<string[]>([]);

  useEffect(() => {
    // Check i18n status
    const checkI18nStatus = async () => {
      try {
        // Get debug information
        const info = {
          ready: ready,
          language: i18n.language,
          languages: i18n.languages,
          hasLoadedNamespaces: i18n.hasLoadedNamespaces,
          loadedNamespaces: Object.keys(i18n.store.data[i18n.language] || {}),
          resources: i18n.store.data,
          options: {
            fallbackLng: i18n.options.fallbackLng,
            defaultNS: i18n.options.defaultNS,
            ns: i18n.options.ns,
            backend: i18n.options.backend
          }
        };

        setDebugInfo(info);

        // Check for missing translations
        const missing = localizationService.getMissingTranslations();
        setMissingKeys(missing);

        // Test if translations are working
        const testKey = 'test.message';
        const translationExists = i18n.exists(testKey);
        
        if (translationExists) {
          setStatus('loaded');
        } else {
          setStatus('error');
          console.error('Translation key not found:', testKey);
        }

        // Log to console for debugging
        console.log('i18n Debug Info:', info);
        console.log('Translation Test Result:', {
          key: testKey,
          exists: translationExists,
          value: t(testKey)
        });

      } catch (error) {
        setStatus('error');
        console.error('Error checking i18n status:', error);
      }
    };

    checkI18nStatus();
  }, [ready, i18n, t]);

  const handleLanguageChange = async (lang: string) => {
    try {
      await localizationService.setLanguage(lang as any);
      // Force component re-render
      window.location.reload();
    } catch (error) {
      console.error('Error changing language:', error);
    }
  };

  const handleLoadTranslations = async () => {
    try {
      await localizationService.loadTranslations('common');
      await localizationService.loadTranslations('errors');
      setStatus('loaded');
    } catch (error) {
      console.error('Error loading translations:', error);
      setStatus('error');
    }
  };

  return (
    <Box sx={{ p: 3 }}>
      <Paper sx={{ p: 3 }}>
        <Typography variant="h4" gutterBottom>
          i18next Translation Test
        </Typography>

        <Stack spacing={3}>
          {/* Status Alert */}
          <Alert severity={status === 'loaded' ? 'success' : status === 'error' ? 'error' : 'info'}>
            {status === 'loading' && (
              <>
                <CircularProgress size={16} sx={{ mr: 1 }} />
                Loading translations...
              </>
            )}
            {status === 'loaded' && 'Translations loaded successfully!'}
            {status === 'error' && 'Error loading translations. Check console for details.'}
          </Alert>

          {/* Translation Tests */}
          <Box>
            <Typography variant="h6" gutterBottom>Translation Tests:</Typography>
            <Stack spacing={1}>
              <Typography>
                <strong>Direct t() call:</strong> {t('test.message', { defaultValue: 'Translation not loaded' })}
              </Typography>
              <Typography>
                <strong>With interpolation:</strong> {t('test.status', { status: status })}
              </Typography>
              <Typography>
                <strong>Current language:</strong> {t('test.language', { language: i18n.language })}
              </Typography>
              <Typography>
                <strong>Error namespace:</strong> {t('errors:notFound', { defaultValue: 'Error namespace not loaded' })}
              </Typography>
            </Stack>
          </Box>

          {/* Language Switcher */}
          <Box>
            <Typography variant="h6" gutterBottom>Language Switcher:</Typography>
            <Stack direction="row" spacing={1}>
              <Button variant="outlined" onClick={() => handleLanguageChange('en')}>
                English
              </Button>
              <Button variant="outlined" onClick={() => handleLanguageChange('cs')}>
                Czech
              </Button>
              <Button variant="outlined" onClick={() => handleLanguageChange('de')}>
                German
              </Button>
            </Stack>
          </Box>

          {/* Manual Load Button */}
          <Box>
            <Button variant="contained" onClick={handleLoadTranslations}>
              Manually Load Translations
            </Button>
          </Box>

          {/* Debug Information */}
          <Box>
            <Typography variant="h6" gutterBottom>Debug Information:</Typography>
            <Paper variant="outlined" sx={{ p: 2, backgroundColor: 'grey.100' }}>
              <pre style={{ overflow: 'auto', fontSize: '0.875rem' }}>
                {JSON.stringify(debugInfo, null, 2)}
              </pre>
            </Paper>
          </Box>

          {/* Missing Translations */}
          {missingKeys.length > 0 && (
            <Box>
              <Typography variant="h6" gutterBottom>Missing Translations:</Typography>
              <Paper variant="outlined" sx={{ p: 2, backgroundColor: 'error.50' }}>
                <ul>
                  {missingKeys.map((key, index) => (
                    <li key={index}>{key}</li>
                  ))}
                </ul>
              </Paper>
            </Box>
          )}

          {/* Console Instructions */}
          <Alert severity="info">
            <Typography variant="body2">
              Open your browser's Developer Console (F12) to see detailed i18n debug information.
              Check the Network tab to see if translation files are being loaded.
            </Typography>
          </Alert>
        </Stack>
      </Paper>
    </Box>
  );
};