import { useState, useCallback, useRef, useEffect } from 'react';
import apiClient from '@/services/api/client';

export interface EmailValidationResult {
  isValidating: boolean;
  exists: boolean;
  hasAccessRequest: boolean;
  error: string | null;
  message: string;
}

// Custom debounce hook
const useDebounce = <T extends (...args: unknown[]) => any>(callback: T, delay: number): T => {
  const debounceRef = useRef<NodeJS.Timeout>();

  const debouncedCallback = useCallback(
    (...args: Parameters<T>) => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
      debounceRef.current = setTimeout(() => {
        callback(...args);
      }, delay);
    },
    [callback, delay],
  ) as T;

  useEffect(() => {
    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, []);

  return debouncedCallback;
};

export const useEmailValidation = (debounceDelay: number = 500) => {
  const [validationState, setValidationState] = useState<EmailValidationResult>({
    isValidating: false,
    exists: false,
    hasAccessRequest: false,
    error: null,
    message: '',
  });

  const abortControllerRef = useRef<AbortController | null>(null);

  const validateEmail = useCallback(async (email: string) => {
    // Cancel any previous request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    // Reset state for empty email
    if (!email || !email.includes('@')) {
      setValidationState({
        isValidating: false,
        exists: false,
        hasAccessRequest: false,
        error: null,
        message: '',
      });
      return;
    }

    // Basic email format validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      setValidationState({
        isValidating: false,
        exists: false,
        hasAccessRequest: false,
        error: null,
        message: '',
      });
      return;
    }

    setValidationState((prev) => ({
      ...prev,
      isValidating: true,
      error: null,
    }));

    try {
      // Create new abort controller for this request
      abortControllerRef.current = new AbortController();

      const response = await apiClient.get('/api/auth/check-email', {
        params: { email },
        signal: abortControllerRef.current.signal,
      });

      const { exists, hasAccessRequest, message } = response.data;

      setValidationState({
        isValidating: false,
        exists,
        hasAccessRequest,
        error: null,
        message,
      });
    } catch (error: unknown) {
      // Don't update state if request was aborted
      if (error.name === 'AbortError' || error.name === 'CanceledError') {
        return;
      }

      console.warn('Email validation failed:', error);

      // If validation fails, don't block the user - just reset to neutral state
      // This allows the form to still be functional even if email validation is down
      setValidationState({
        isValidating: false,
        exists: false,
        hasAccessRequest: false,
        error: null, // Don't show error to user, just log it
        message: '',
      });
    }
  }, []);

  const debouncedValidateEmail = useDebounce(validateEmail, debounceDelay);

  const checkEmail = useCallback(
    (email: string) => {
      debouncedValidateEmail(email);
    },
    [debouncedValidateEmail],
  );

  return {
    ...validationState,
    checkEmail,
  };
};
