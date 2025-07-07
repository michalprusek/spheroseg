import React from 'react';
import { useTranslation } from 'react-i18next';
import { Box, Paper, Typography, Button, Stack, Alert, Divider } from '@mui/material';
import { LanguageSelector } from '@/components/localization/LanguageSelector';
import { useLocalization } from '@/hooks/useLocalization';

/**
 * Component for testing i18n functionality
 */
export const I18nTest: React.FC = () => {
  const { t, i18n, ready } = useTranslation();
  const { language, formatDate, formatNumber, formatCurrency } = useLocalization();

  if (!ready) {
    return (
      <Box sx={{ p: 3 }}>
        <Alert severity="info">Loading translations...</Alert>
      </Box>
    );
  }

  const testDate = new Date();
  const testNumber = 1234567.89;
  const testCurrency = 999.99;

  return (
    <Box sx={{ p: 3 }}>
      <Paper sx={{ p: 3 }}>
        <Typography variant="h4" gutterBottom>
          i18n Test Page
        </Typography>

        <Stack spacing={3}>
          {/* Language Selector */}
          <Box>
            <Typography variant="h6" gutterBottom>
              Language Selector
            </Typography>
            <LanguageSelector variant="dropdown" />
            <Typography variant="body2" sx={{ mt: 1 }}>
              Current language: <strong>{language}</strong>
            </Typography>
          </Box>

          <Divider />

          {/* Basic Translations */}
          <Box>
            <Typography variant="h6" gutterBottom>
              Basic Translations
            </Typography>
            <Stack spacing={1}>
              <Typography>
                <strong>Welcome:</strong> {t('common.welcome', 'Welcome')}
              </Typography>
              <Typography>
                <strong>Login:</strong> {t('auth.login', 'Login')}
              </Typography>
              <Typography>
                <strong>Logout:</strong> {t('auth.logout', 'Logout')}
              </Typography>
              <Typography>
                <strong>Save:</strong> {t('common.save', 'Save')}
              </Typography>
              <Typography>
                <strong>Cancel:</strong> {t('common.cancel', 'Cancel')}
              </Typography>
            </Stack>
          </Box>

          <Divider />

          {/* Formatting Examples */}
          <Box>
            <Typography variant="h6" gutterBottom>
              Formatting Examples
            </Typography>
            <Stack spacing={1}>
              <Typography>
                <strong>Date:</strong> {formatDate(testDate)}
              </Typography>
              <Typography>
                <strong>Number:</strong> {formatNumber(testNumber)}
              </Typography>
              <Typography>
                <strong>Currency:</strong> {formatCurrency(testCurrency)}
              </Typography>
            </Stack>
          </Box>

          <Divider />

          {/* Debug Information */}
          <Box>
            <Typography variant="h6" gutterBottom>
              Debug Information
            </Typography>
            <Paper variant="outlined" sx={{ p: 2, backgroundColor: 'grey.100' }}>
              <Typography variant="body2" component="pre" sx={{ fontFamily: 'monospace' }}>
                {JSON.stringify({
                  currentLanguage: i18n.language,
                  supportedLanguages: i18n.languages,
                  namespaces: Object.keys(i18n.store.data[i18n.language] || {}),
                  hasTranslations: Object.keys(i18n.store.data).length > 0
                }, null, 2)}
              </Typography>
            </Paper>
          </Box>

          <Divider />

          {/* Instructions */}
          <Alert severity="info">
            <Typography variant="body2">
              Use the language selector above to switch between languages. 
              Check the browser console (F12) for detailed i18n debug information.
              Translations should update immediately after language selection.
            </Typography>
          </Alert>
        </Stack>
      </Paper>
    </Box>
  );
};

export default I18nTest;