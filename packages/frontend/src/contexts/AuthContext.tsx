import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
// Import jwt-decode, který je nyní nainstalován
import { jwtDecode } from 'jwt-decode';
import { useNavigate, NavigateFunction, useLocation } from "react-router-dom";
import { toast } from "sonner";
import apiClient from "@/lib/apiClient"; // Import apiClient
import axios from 'axios'; // Import axios for direct requests and error checking
import { Language } from "./LanguageContext"; // Import Language type
import httpClient from "@/utils/httpClient"; // Import centralized HTTP client
import logger from "@/utils/logger"; // Import centralized logger
import { safeAsync, NetworkErrorType, getErrorType, showEnhancedError } from "@/utils/enhancedErrorHandling"; // Import enhanced error handling
import { getAccessToken, getRefreshToken, setTokens, removeTokens, isAccessTokenExpired, refreshAccessToken, saveCurrentRoute, getLastRoute, clearLastRoute } from "@/services/authService"; // Import token services
import { API_PATHS, formatApiPath } from '@/lib/apiPaths'; // Import centralized API paths

// Define simplified User type
interface User {
  id: string;
  email: string;
  // Add other relevant fields if returned by /users/me or needed globally
}

// Define API response types (adjust based on actual backend responses)
interface AuthResponse {
  accessToken: string;
  refreshToken: string;
  user: User;
  message?: string;
  tokenType: string;
}

interface UserProfileResponse {
    user_id: string;
    email?: string; // email might be here or directly in User object
    // Add other profile fields
}

interface AuthContextType {
  // session: Session | null; // Removed
  user: User | null;
  token: string | null;
  // profile: any | null; // Removed profile from AuthContext
  loading: boolean;
  signIn: (email: string, password: string) => Promise<boolean>; // Return boolean success
  signUp: (email: string, password: string, name: string) => Promise<boolean>; // Add name parameter
  signOut: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(getAccessToken());
  const [loading, setLoading] = useState(true);

  // Make navigate optional for testing purposes
  const navigate = useNavigate(); // Call hook unconditionally
  const location = useLocation(); // Get current location and route

  // Save the current route whenever location changes (for restoration after refresh)
  useEffect(() => {
    if (token && location.pathname) {
      saveCurrentRoute(location.pathname);
    }
  }, [location.pathname, token]);

  // Check token validity and fetch user data on initial load or token change
  useEffect(() => {
    const initializeAuth = async () => {
      setLoading(true);
      const currentToken = getAccessToken();
      const currentRefreshToken = getRefreshToken();

      if (currentToken) {
        logger.info("Found tokens in localStorage, verifying...");

        // Check if access token is expired and refresh token is available
        if (isAccessTokenExpired() && currentRefreshToken) {
          logger.info("Access token expired, attempting refresh...");
          const refreshSuccess = await refreshAccessToken();

          if (!refreshSuccess) {
            logger.warn("Token refresh failed during initialization");
            removeTokens();
            setUser(null);
            setToken(null);
            setLoading(false);
            return;
          }

          // Update token state with newly refreshed token
          setToken(getAccessToken());
        }

        try {
          // Nastavíme timeout, aby se aplikace nezablokovala, pokud je API nedostupné
          const timeoutPromise = new Promise<null>((resolve) => {
            setTimeout(() => {
              logger.warn("Auth API verification timed out, continuing with stored token");
              resolve(null);
            }, 10000); // Sníženo na 10 sekund pro rychlejší odezvu v případě problémů
          });

          // Verify token by fetching user data using the centralized HTTP client
          const controller = new AbortController();
          const fetchUserPromise = httpClient.withRetry(
            async () => {
              try {
                return await axios.get<User>(API_PATHS.USERS.ME, {
                  signal: controller.signal,
                  timeout: 3000,
                  headers: {
                    'Authorization': `Bearer ${getAccessToken()}`,
                    'Content-Type': 'application/json'
                  }
                });
              } catch (error) {
                // Don't retry if token is invalid (401 Unauthorized)
                if (axios.isAxiosError(error) && error.response?.status === 401) {
                  logger.warn('Token is invalid, not retrying');
                  throw error;
                }

                logger.warn('User data fetch failed, will retry', { error });
                throw error;
              }
            },
            2, // Sníženo na 2 pokusy pro rychlejší selhání v případě problémů
            800 // Sníženo na 800ms mezi pokusy
          );

          // Použijeme Promise.race, abychom pokračovali, pokud nastane timeout
          const response = await Promise.race([fetchUserPromise, timeoutPromise]);

          if (response === null) {
            // Timeout nastal, nemůžeme pokračovat bez ověření
            logger.warn("API timeout - cannot verify user token");
            removeTokens(); // Remove potentially invalid tokens
            setUser(null);
            setToken(null);
            setLoading(false);

            // Show a toast to inform the user about API timeout
            toast.error("Could not connect to the server. Please try again later.", {
              id: "server-connection-error",
              duration: 5000,
            });

            // Redirect to login if there's a navigation function
            if (navigate) {
              // Save the current location before redirecting
              if (location.pathname && location.pathname !== '/signin') {
                saveCurrentRoute(location.pathname);
              }
              navigate("/signin");
            }
          } else {
            // API odpovědělo úspěšně
            logger.info("Token verification successful");
            setUser(response.data);
            setToken(currentToken); // Ensure token state matches localStorage

            // After successful verification, check if we should restore the previous route
            const savedRoute = getLastRoute();
            if (savedRoute && navigate && location.pathname === '/signin') {
              logger.info(`Restoring last route: ${savedRoute}`);
              setTimeout(() => navigate(savedRoute), 100);
            }
          }
        } catch (error) {
          logger.error("Token verification failed:", { error });
          removeTokens(); // Remove invalid tokens
          setUser(null);
          setToken(null);
        }
      } else {
        logger.info("No access token found in localStorage");
        setUser(null); // Ensure user is null if no token
        setToken(null); // Ensure token is null if no token
      }

      setLoading(false);
    };

    initializeAuth();

    // Add event listener for token expiration events
    const handleTokenExpired = () => {
      logger.warn("Token expired event received");
      setUser(null);
      setToken(null);

      // Show a message to the user
      toast.error("Your session has expired. Please sign in again.", {
        id: "session-expired",
        duration: 5000,
      });

      // Redirect to login
      navigate("/signin");
    };

    window.addEventListener('auth:expired', handleTokenExpired);

    // Clean up event listener
    return () => {
      window.removeEventListener('auth:expired', handleTokenExpired);
    };
  }, []); // Run only once on mount

  const handleAuthSuccess = (data: AuthResponse) => {
    // Store both access and refresh tokens
    setTokens(data.accessToken, data.refreshToken);
    setToken(data.accessToken);
    setUser(data.user);
    toast.success(data.message || "Success!");

    // Zachováme aktuální nastavení jazyka pro přihlášeného uživatele
    const currentLanguage = localStorage.getItem('language') as Language | null;
    if (currentLanguage) {
      logger.info(`Updating language preference to ${currentLanguage} for user ${data.user.id}`);

      // Aktualizujeme nastavení jazyka na serveru pro přihlášeného uživatele
      (async () => {
        try {
          await axios.put(API_PATHS.USERS.ME, { preferred_language: currentLanguage }, {
            timeout: 2000,
            headers: {
              'Authorization': `Bearer ${data.accessToken}`,
              'Content-Type': 'application/json'
            }
          });
          logger.info(`Language preference updated to ${currentLanguage} for user ${data.user.id}`);
        } catch (error) {
          logger.error("Error updating language preference:", { error, userId: data.user.id, language: currentLanguage });
        }
      })();
    }
  };

  const signIn = useCallback(async (email: string, password: string): Promise<boolean> => {
    setLoading(true);

    // Use safeAsync for better error handling
    const result = await safeAsync(
      async () => {
        // Log the attempt
        logger.info(`Attempting to sign in with email: ${email}`);

        // Set up timeout for the entire sign-in process
        const loginTimeoutPromise = new Promise<boolean>((_, reject) => {
          setTimeout(() => {
            logger.warn('[authContext] Sign-in operation timed out');
            reject(new Error('Sign-in timed out. Please try again.'));
          }, 8000); // Further reduced timeout for quicker failure
        });

        // In production mode, try real authentication
        try {
          // Create a promise for the login process with direct axios call
          const loginProcess = (async () => {
            // Set up abort controller for the login request
            const controller = new AbortController();
            const timeoutId = setTimeout(() => {
              logger.warn('[authContext] Login request timed out');
              controller.abort();
            }, 3000); // 3 second timeout for the request

            try {
              // Use axios directly to completely bypass httpClient and all interceptors
              // The vite proxy rewrites '/api' to '', so we need to use '/api/auth/login' directly
              const response = await axios.post(API_PATHS.AUTH.LOGIN,
                { email, password },
                {
                  signal: controller.signal,
                  timeout: 3000, // 3 second request timeout
                  headers: {
                    'Content-Type': 'application/json'
                  }
                }
              );

              logger.info('Login successful');
              handleAuthSuccess(response.data);

              if (navigate) {
                navigate("/dashboard");
              }
              return true;
            } catch (error) {
              if (error.name === 'AbortError') {
                logger.error('[authContext] Login request aborted due to timeout');
                throw new Error('Login request timed out. Please try again.');
              }

              if (axios.isAxiosError(error) && error.response?.status === 401) {
                logger.warn('Invalid credentials provided');
                throw error;
              }

              logger.error('Login attempt failed', { error });
              throw error;
            } finally {
              clearTimeout(timeoutId);
            }
          })();

          // Race the login process against the timeout
          return await Promise.race([loginProcess, loginTimeoutPromise]);
        } catch (error) {
          throw error;
        }
      },
      {
        // Custom error handler
        onError: (error) => {
          logger.error("Error signing in:", { error });

          // Use enhanced error handling
          const errorType = getErrorType(error);

          // Special handling for auth errors (bad credentials)
          if (errorType === NetworkErrorType.AUTH_ERROR) {
            toast.error("Invalid credentials", {
              duration: 5000,
              description: "Please check your email and password and try again."
            });
          } else {
            // Use enhanced error display for other errors
            showEnhancedError(error);
          }

          setUser(null);
          setToken(null);
          localStorage.removeItem("authToken");
        },
        showToast: false, // We're handling toasts manually
        defaultValue: false, // Return false on error
      }
    );

    setLoading(false);
    return result || false;
  }, [navigate, handleAuthSuccess]);

  const signUp = useCallback(async (email: string, password: string, name: string): Promise<boolean> => {
    setLoading(true);

    // Use safeAsync for better error handling
    const result = await safeAsync(
      async () => {
        // Uložíme aktuální nastavení jazyka před registrací
        const currentLanguage = localStorage.getItem('language');

        const userData = {
          email,
          password,
          name,
          language: currentLanguage || 'en' // Přidáme jazyk do registračních údajů
        };

        // Log the attempt
        logger.info(`Attempting to sign up with email: ${email}`);

        // Ensure user data contains the required fields
        if (!email || !password) {
          throw new Error('Email and password are required');
        }

        try {
          // Use the centralized HTTP client with retry for actual API calls
          const response = await httpClient.withRetry(
            async () => {
              try {
                // Use direct axios call to avoid any interceptor issues
                return await axios.post(API_PATHS.AUTH.REGISTER, userData, {
                  signal: new AbortController().signal,
                  timeout: 3000,
                  headers: {
                    'Content-Type': 'application/json'
                  }
                });
              } catch (error) {
                // Don't retry if user already exists (409 Conflict)
                if (axios.isAxiosError(error) && error.response?.status === 409) {
                  logger.warn('User already exists, not retrying', { email });
                  throw error;
                }

                logger.warn('Auth signup attempt failed, will retry', { error });
                throw error;
              }
            },
            2, // 2 retries
            1000 // 1 second delay between retries
          );

          logger.info('Signup successful');
          toast.success(response.data.message || "Registration successful!");
          if (navigate) {
            navigate('/signin?signupSuccess=true'); // Redirect to signin after signup
          }
          return true;
        } catch (error) {
          // Propagate all errors without mock workarounds

          // Otherwise, propagate the error
          throw error;
        }
      },
      {
        // Custom error handler
        onError: (error) => {
          logger.error("Error signing up:", { error });

          // Use enhanced error handling
          const errorType = getErrorType(error);

          // Special handling for specific error cases
          if (axios.isAxiosError(error) && error.response?.status === 409) {
            toast.error("User with this email already exists.", {
              duration: 5000,
              description: "Please use a different email address or try to sign in."
            });
          } else if (errorType === NetworkErrorType.NETWORK_ERROR) {
            toast.error("Cannot connect to server", {
              duration: 5000,
              description: "Please check your internet connection and try again."
            });
          } else if (errorType === NetworkErrorType.SERVER_ERROR) {
            toast.error("Server error during registration", {
              duration: 5000,
              description: "Our server is experiencing issues. Please try again later."
            });
          } else {
            // Use enhanced error display for other errors
            showEnhancedError(error);
          }
        },
        showToast: false, // We're handling toasts manually in onError
        defaultValue: false, // Return false on error
      }
    );

    setLoading(false);
    return result || false;
  }, [navigate]);

  const signOut = useCallback(async () => {
    logger.info("Signing out...");
    const refreshToken = getRefreshToken();

    // Clear tokens and user state
    removeTokens();
    setUser(null);
    setToken(null);

    // Call the backend logout endpoint to invalidate the refresh token
    if (refreshToken) {
      try {
        // Use direct axios call to avoid any interceptor issues
        await axios.post(API_PATHS.AUTH.LOGOUT, { refreshToken }, {
          timeout: 2000,
          headers: {
            'Content-Type': 'application/json'
          }
        });
        logger.info("Backend logout successful");
      } catch (error) {
        // Non-critical error, just log it
        logger.warn("Backend logout failed, but local session was cleared", { error });
      }
    }

    if (navigate) {
      navigate("/signin");
    }
    toast.success("Signed out successfully");
  }, [navigate]);

  // The context value that will be supplied to consuming components
  const value = {
    user,
    token,
    loading,
    signIn,
    signUp,
    signOut,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);

  if (context === undefined) {
    // Instead of throwing an error, provide a fallback context for development
    // This helps prevent crashes when components are tested in isolation
    if (process.env.NODE_ENV !== 'production') {
      console.warn("useAuth was called outside of AuthProvider. Using fallback context.");

      // Return a fallback context with dummy values
      return {
        user: { id: 'fallback-user-id', email: 'fallback@example.com' },
        token: 'fallback-token',
        loading: false,
        signIn: async () => false,
        signUp: async () => false,
        signOut: () => {},
      };
    }

    // In production, still throw the error to help identify issues
    throw new Error("useAuth must be used within an AuthProvider");
  }

  return context;
}
