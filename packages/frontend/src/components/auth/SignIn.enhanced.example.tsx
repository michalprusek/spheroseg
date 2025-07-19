/**
 * Example Sign In Component with Enhanced Error Handling
 * 
 * Demonstrates how to handle structured errors in React components
 */

import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { 
  Box, 
  TextField, 
  Button, 
  Alert, 
  CircularProgress,
  Link,
  Typography 
} from '@mui/material';
import { useAuth } from '@/contexts/AuthContext';
import { 
  ERROR_CODES, 
  isErrorCode, 
  getErrorMessage,
  getValidationErrors 
} from '@/utils/error/structuredErrors';
import logger from '@/utils/logger';

interface FormData {
  email: string;
  password: string;
}

interface FormErrors {
  email?: string;
  password?: string;
  general?: string;
}

export const SignInEnhanced: React.FC = () => {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { signIn } = useAuth();
  
  const [formData, setFormData] = useState<FormData>({
    email: '',
    password: '',
  });
  
  const [errors, setErrors] = useState<FormErrors>({});
  const [isLoading, setIsLoading] = useState(false);
  const [showResendVerification, setShowResendVerification] = useState(false);
  const [rateLimitedUntil, setRateLimitedUntil] = useState<Date | null>(null);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    
    // Clear field error when user types
    if (errors[name as keyof FormErrors]) {
      setErrors(prev => ({ ...prev, [name]: undefined }));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Clear previous errors
    setErrors({});
    setShowResendVerification(false);
    
    // Client-side validation
    const validationErrors: FormErrors = {};
    
    if (!formData.email) {
      validationErrors.email = t('validation.required', { field: t('auth.email') });
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      validationErrors.email = t('validation.invalidEmail');
    }
    
    if (!formData.password) {
      validationErrors.password = t('validation.required', { field: t('auth.password') });
    }
    
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      return;
    }
    
    setIsLoading(true);
    
    try {
      await signIn(formData.email, formData.password);
      
      logger.info('Sign in successful', { email: formData.email });
      
      // Redirect to dashboard or return URL
      const returnUrl = new URLSearchParams(window.location.search).get('returnUrl');
      navigate(returnUrl || '/dashboard');
    } catch (error: any) {
      logger.error('Sign in failed', { error });
      
      // Handle specific error codes
      if (isErrorCode(error, ERROR_CODES.AUTH_INVALID_CREDENTIALS)) {
        setErrors({
          general: t('auth.errors.invalidCredentials'),
        });
      } else if (isErrorCode(error, ERROR_CODES.AUTH_ACCOUNT_DISABLED)) {
        setErrors({
          general: t('auth.errors.accountDisabled'),
        });
        // Could show a contact support link here
      } else if (isErrorCode(error, ERROR_CODES.AUTH_EMAIL_NOT_VERIFIED)) {
        setErrors({
          general: t('auth.errors.emailNotVerified'),
        });
        setShowResendVerification(true);
      } else if (isErrorCode(error, ERROR_CODES.AUTH_TOO_MANY_ATTEMPTS)) {
        const retryAfter = error.error?.context?.retryAfter || 60;
        const lockedUntil = new Date(Date.now() + retryAfter * 1000);
        setRateLimitedUntil(lockedUntil);
        setErrors({
          general: t('auth.errors.tooManyAttempts', { 
            minutes: Math.ceil(retryAfter / 60) 
          }),
        });
      } else if (isErrorCode(error, ERROR_CODES.VALIDATION_INVALID_FORMAT)) {
        // Handle validation errors from server
        const validationErrors = getValidationErrors(error);
        setErrors(validationErrors);
      } else {
        // Generic error fallback
        const { i18nKey } = getErrorMessage(error?.error?.code || '');
        setErrors({
          general: t(i18nKey),
        });
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleResendVerification = async () => {
    try {
      // Call resend verification API
      await authService.resendVerificationEmail(formData.email);
      
      // Show success message
      ToastService.success(t('auth.verificationEmailSent'));
      setShowResendVerification(false);
    } catch (error) {
      logger.error('Resend verification failed', { error });
      ToastService.error(t('errors.generic'));
    }
  };

  // Check if form should be disabled due to rate limiting
  const isRateLimited = rateLimitedUntil && rateLimitedUntil > new Date();

  return (
    <Box component="form" onSubmit={handleSubmit} sx={{ mt: 1 }}>
      {errors.general && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {errors.general}
        </Alert>
      )}
      
      {showResendVerification && (
        <Alert 
          severity="info" 
          sx={{ mb: 2 }}
          action={
            <Button 
              color="inherit" 
              size="small" 
              onClick={handleResendVerification}
            >
              {t('auth.resendVerification')}
            </Button>
          }
        >
          {t('auth.checkEmailForVerification')}
        </Alert>
      )}
      
      {isRateLimited && (
        <Alert severity="warning" sx={{ mb: 2 }}>
          {t('auth.rateLimitedMessage', {
            time: rateLimitedUntil.toLocaleTimeString(),
          })}
        </Alert>
      )}
      
      <TextField
        margin="normal"
        required
        fullWidth
        id="email"
        label={t('auth.email')}
        name="email"
        autoComplete="email"
        autoFocus
        value={formData.email}
        onChange={handleChange}
        error={!!errors.email}
        helperText={errors.email}
        disabled={isLoading || isRateLimited}
      />
      
      <TextField
        margin="normal"
        required
        fullWidth
        name="password"
        label={t('auth.password')}
        type="password"
        id="password"
        autoComplete="current-password"
        value={formData.password}
        onChange={handleChange}
        error={!!errors.password}
        helperText={errors.password}
        disabled={isLoading || isRateLimited}
      />
      
      <Button
        type="submit"
        fullWidth
        variant="contained"
        sx={{ mt: 3, mb: 2 }}
        disabled={isLoading || isRateLimited}
      >
        {isLoading ? (
          <CircularProgress size={24} />
        ) : (
          t('auth.signIn')
        )}
      </Button>
      
      <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
        <Link href="/forgot-password" variant="body2">
          {t('auth.forgotPassword')}
        </Link>
        <Link href="/signup" variant="body2">
          {t('auth.noAccount')}
        </Link>
      </Box>
      
      {/* Error help link */}
      {errors.general && error?.error?.help && (
        <Typography variant="caption" sx={{ mt: 2, display: 'block' }}>
          <Link href={error.error.help} target="_blank">
            {t('errors.needHelp')}
          </Link>
        </Typography>
      )}
    </Box>
  );
};