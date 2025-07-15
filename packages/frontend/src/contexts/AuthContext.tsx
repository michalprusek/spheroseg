import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
// Import jwt-decode, which is now installed
import { jwtDecode } from 'jwt-decode';
import { useNavigate, NavigateFunction, useLocation } from 'react-router-dom';
import { toast } from 'sonner';
import apiClient from '@/lib/apiClient'; // Import apiClient
import axios from 'axios'; // Import axios for direct requests and error checking
import { Language } from './LanguageContext'; // Import Language type
import logger from '@/utils/logger'; // Import centralized logger
import { safeAsync, NetworkErrorType, getErrorType, showEnhancedError } from '@/utils/enhancedErrorHandling'; // Import enhanced error handling
import {
  getAccessToken,
  getRefreshToken,
  setTokens,
  removeTokens,
  isAccessTokenExpired,
  refreshAccessToken,
  saveCurrentRoute,
  getLastRoute,
  clearLastRoute,
  shouldPersistSession,
} from '@/services/authService'; // Import token services
import { API_PATHS, formatApiPath } from '@/lib/apiPaths'; // Import centralized API paths
import userProfileService from '../services/userProfileService';

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

// Helper functions to persist user data
const saveUserToStorage = (user: User | null) => {
  if (user) {
    // Save to localStorage
    localStorage.setItem('spheroseg_user', JSON.stringify(user));

    // Also save to cookie for better resilience
    try {
      const userJson = JSON.stringify(user);
      const expirationDate = new Date();
      expirationDate.setDate(expirationDate.getDate() + 7); // 7 dní

      const domain = window.location.hostname === 'localhost' ? 'localhost' : window.location.hostname;
      const sameSiteValue = process.env.NODE_ENV === 'production' ? 'lax' : 'lax';
      const secure = window.location.protocol === 'https:' ? '; secure' : '';

      document.cookie = `spheroseg_user=${encodeURIComponent(userJson)}; path=/; expires=${expirationDate.toUTCString()}; domain=${domain}; samesite=${sameSiteValue}${secure}`;
    } catch (error) {
      logger.error('Error setting user cookie:', error);
    }
  } else {
    // Clear from both localStorage and cookie
    localStorage.removeItem('spheroseg_user');

    try {
      const domain = window.location.hostname === 'localhost' ? 'localhost' : window.location.hostname;
      const sameSiteValue = process.env.NODE_ENV === 'production' ? 'lax' : 'lax';
      const secure = window.location.protocol === 'https:' ? '; secure' : '';

      document.cookie = `spheroseg_user=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT; domain=${domain}; samesite=${sameSiteValue}${secure}`;
    } catch (error) {
      logger.error('Error removing user cookie:', error);
    }
  }
};

const loadUserFromStorage = (): User | null => {
  try {
    // First try to load from localStorage
    const userData = localStorage.getItem('spheroseg_user');
    if (userData) {
      return JSON.parse(userData);
    }

    // If not in localStorage, try cookie
    const cookieStr = document.cookie;
    const userCookieMatch = cookieStr.match(/spheroseg_user=([^;]+)/);
    if (userCookieMatch && userCookieMatch[1]) {
      try {
        const decodedUserJson = decodeURIComponent(userCookieMatch[1]);
        const user = JSON.parse(decodedUserJson);

        // Synchronizujeme do localStorage pro příští použití
        localStorage.setItem('spheroseg_user', decodedUserJson);

        return user;
      } catch (e) {
        logger.error('Error parsing user data from cookie:', e);
      }
    }
  } catch (error) {
    logger.error('Error loading user data:', error);
  }
  return null;
};

export function AuthProvider({ children }: { children: React.ReactNode }) {
  // Vytvoříme persistentní hodnotu v sessionStorage, aby se neztratila při re-renderingu
  const getPersistedUserFromSession = (): User | null => {
    try {
      const sessionUserData = sessionStorage.getItem('spheroseg_persisted_user');
      if (sessionUserData) {
        return JSON.parse(sessionUserData);
      }
    } catch (e: any) {
      // Cast e to any
      logger.error('Error reading persisted user from session storage:', e);
    }
    return null;
  };

  // KRITICKÉ: Zajistíme, že uživatel nebude nikdy null, pokud byl předtím přihlášen
  const ensureUserPersistence = (loadedUser: User | null): User | null => {
    const persistedUser = getPersistedUserFromSession();

    if (loadedUser) {
      // Pokud máme uživatele, uložíme ho do session pro případ ztráty
      try {
        sessionStorage.setItem('spheroseg_persisted_user', JSON.stringify(loadedUser));
      } catch (e: any) {
        // Cast e to any
        logger.error('Error saving user to session storage:', e);
      }
      return loadedUser;
    } else if (persistedUser) {
      // Pokud nemáme uživatele, ale máme ho v session, použijeme ho jako fallback
      logger.debug('Using persisted user from session as fallback');
      return persistedUser;
    }

    // Jinak vrátíme null
    return null;
  };

  // Initialize user from localStorage with persistence protection
  const initialUser = ensureUserPersistence(loadUserFromStorage());
  logger.debug('Initial user from storage (with persistence):', initialUser);

  const [user, setUser] = useState<User | null>(initialUser);
  // Initialize token from storage with better error handling and expiration check
  const getInitialToken = (): string | null => {
    try {
      // First try to get from authService (checks localStorage and cookies)
      const accessToken = getAccessToken();
      if (accessToken) {
        logger.debug('Found access token from authService:', { tokenLength: accessToken.length });

        // Check if token is expired
        if (isAccessTokenExpired()) {
          logger.warn('Found token but it is expired, will need to refresh');
          // Still return it so we can try to refresh it
          return accessToken;
        }

        return accessToken;
      }

      // Fallback to direct cookie check
      const cookieToken = document.cookie.match(/auth_token=([^;]+)/)?.[1];
      if (cookieToken) {
        logger.debug('Found access token from cookie:', { tokenLength: cookieToken.length });
        return cookieToken;
      }

      logger.debug('No access token found during initialization');
      return null;
    } catch (error) {
      logger.error('Error getting initial token:', error);
      return null;
    }
  };

  const [token, setToken] = useState<string | null>(getInitialToken());
  const [loading, setLoading] = useState(true);

  // Log auth state changes for debugging
  useEffect(() => {
    logger.debug('Auth state changed:', {
      user: !!user,
      token: !!token,
      loading,
    });
  }, [user, token, loading]);

  // Make navigate optional for testing purposes
  // Získáváme funkci pro navigaci a aktuální lokaci
  // Pozor: useNavigate musí být volán jen v komponentě, nemůže být v callbacku
  const navigate = useNavigate(); // Call hook unconditionally
  const location = useLocation(); // Get current location and route

  // Pro detekci, zda jsme právě načetli stránku
  const isPageLoadRef = useRef(true);

  // Custom setter for user that also updates localStorage and sessionStorage
  const setUserWithStorage = (newUser: User | null) => {
    setUser(newUser);
    saveUserToStorage(newUser);

    // Update persisted user in sessionStorage
    if (newUser) {
      try {
        sessionStorage.setItem('spheroseg_persisted_user', JSON.stringify(newUser));
      } catch (e: any) {
        // Cast e to any
        logger.error('Error saving user to session storage:', e);
      }
    } else {
      // Only clear session storage if we're explicitly logging out
      // Pokud jsme došli sem voláním signOut funkce, vymažeme i z session
      const isLogout = new Error().stack?.includes('signOut');
      if (isLogout) {
        logger.debug('Clearing persisted user due to explicit logout');
        sessionStorage.removeItem('spheroseg_persisted_user');
      } else {
        logger.debug('Not clearing persisted user (not an explicit logout)');
      }
    }
  };

  // Save the current route whenever location changes (for restoration after refresh)
  useEffect(() => {
    if (token && location.pathname) {
      saveCurrentRoute(location.pathname);
    }
  }, [location.pathname, token]);

  // KRITICKÉ: Při PRVNÍM načtení stránky zabráníme redirectu
  useEffect(() => {
    // Toto bude provedeno pouze jednou při načtení stránky
    if (isPageLoadRef.current) {
      logger.info('Setting up page reload blocker...');
      // Nastavení příznaku, že jsme v procesu načítání stránky
      // Blokujeme veškeré navigační operace po dobu načítání
      window.sessionStorage.setItem('spheroseg_page_loading', 'true');

      // Po 2 sekundách zrušíme blokaci (sníženo z 5 sekund pro rychlejší načítání)
      setTimeout(() => {
        isPageLoadRef.current = false;
        window.sessionStorage.removeItem('spheroseg_page_loading');
        logger.info('Page reload blocker disabled');
      }, 2000);
    }
  }, []);

  // Check token validity and fetch user data on initial load or token change
  useEffect(() => {
    const initializeAuth = async () => {
      setLoading(true);

      // Skip auth initialization only on sign-in/sign-up pages
      if (location.pathname === '/sign-in' || location.pathname === '/sign-up') {
        logger.debug('Skipping auth initialization on auth page');
        setLoading(false);
        return;
      }

      // Try to get tokens (will check both localStorage and cookies)
      const currentToken = getAccessToken();
      const currentRefreshToken = getRefreshToken();

      logger.info('[AuthContext] Auth initialization check:', {
        hasToken: !!currentToken,
        hasRefreshToken: !!currentRefreshToken,
        tokenLength: currentToken?.length || 0,
        pathname: location.pathname,
      });

      if (currentToken) {
        logger.info('Found authentication tokens, verifying...');

        // IMPORTANT: Set the token state immediately to ensure it's available for API calls
        setToken(currentToken);

        // Check if access token is expired and refresh token is available
        if (isAccessTokenExpired() && currentRefreshToken) {
          logger.info('Access token expired, attempting refresh...');
          const refreshSuccess = await refreshAccessToken();

          if (!refreshSuccess) {
            logger.warn('Token refresh failed during initialization');
            removeTokens();
            setUserWithStorage(null);
            setToken(null);
            setLoading(false);
            return;
          }

          // Update token state with newly refreshed token
          const newToken = getAccessToken();
          setToken(newToken);
        }

        try {
          // Nastavíme delší timeout, aby se aplikace nezablokovala, pokud je API pomalejší
          const timeoutPromise = new Promise<null>((resolve) => {
            setTimeout(() => {
              logger.warn('Auth API verification timed out, continuing with stored token and user data');
              resolve(null);
            }, 5000); // Sníženo na 5 sekund pro rychlejší načítání
          });

          // Try to load user from storage first
          const storedUser = loadUserFromStorage();
          if (storedUser) {
            // Pre-set user from storage to avoid UI flashing if verification is slow
            setUserWithStorage(storedUser);
          }

          // Verify token by fetching user data using the centralized HTTP client
          const controller = new AbortController();
          const fetchUserPromise = (async () => {
            let retries = 4; // Zvýšeno na 4 pokusy
            const retryDelay = 2000; // Zvýšeno na 2s mezi pokusy

            while (retries > 0) {
              try {
                return await apiClient.get<User>(API_PATHS.USERS.ME, {
                  signal: controller.signal,
                  timeout: 10000, // Zvýšeno na 10 sekund pro větší toleranci
                  withCredentials: true, // Důležité pro přenos cookies
                });
              } catch (error) {
                // Don't retry if token is invalid (401 Unauthorized)
                if (axios.isAxiosError(error) && error.response?.status === 401) {
                  logger.warn('Token is invalid, not retrying');
                  throw error;
                }

                retries--;
                if (retries === 0) {
                  logger.warn('User data fetch failed after all retries', { error });
                  throw error;
                }

                logger.warn(`User data fetch failed, will retry. Retries left: ${retries}`, { error });
                await new Promise((resolve) => setTimeout(resolve, retryDelay));
              }
            }
          })();

          // Použijeme Promise.race, abychom pokračovali, pokud nastane timeout
          const response = await Promise.race([fetchUserPromise, timeoutPromise]);

          if (response === null) {
            // Timeout nastal, ale pokračujeme s uloženým tokenem a uživatelem, pokud je k dispozici
            logger.warn('API verification timed out - continuing with cached user data');

            // Use stored user data if available, otherwise clear auth
            if (storedUser) {
              logger.info('Using cached user data from storage');
              setUserWithStorage(storedUser);
              setToken(currentToken);
            } else {
              logger.warn('No cached user data available - clearing auth state');
              removeTokens();
              setUserWithStorage(null);
              setToken(null);

              // Show a toast to inform the user about API timeout
              toast.error('Could not connect to the server. Please try again later.', {
                id: 'server-connection-error',
                duration: 5000,
              });

              // Redirect to login if there's a navigation function
              if (navigate) {
                // Save the current location before redirecting
                if (location.pathname && location.pathname !== '/sign-in') {
                  saveCurrentRoute(location.pathname);
                }
                navigate('/sign-in');
              }
            }
          } else {
            // API odpovědělo úspěšně
            logger.info('Token verification successful');
            setUserWithStorage(response.data);
            setToken(currentToken); // Ensure token state matches localStorage/cookie

            // After successful verification, check if we should restore the previous route
            const savedRoute = getLastRoute();
            if (savedRoute && navigate && location.pathname === '/sign-in') {
              logger.info(`Restoring last route: ${savedRoute}`);
              setTimeout(() => navigate(savedRoute), 100);
            }
          }
        } catch (error: any) {
          // Cast error to any
          logger.error('Token verification failed:', { error });

          // Try to use stored user data as fallback
          const storedUser = loadUserFromStorage();
          if (storedUser && !isAccessTokenExpired()) {
            logger.info('Using cached user data despite verification failure');
            setUserWithStorage(storedUser);
            setToken(currentToken);
          } else {
            removeTokens(); // Remove invalid tokens
            setUserWithStorage(null);
            setToken(null);
          }
        }
      } else {
        logger.info('No access token found in localStorage or cookies');
        setUserWithStorage(null); // Ensure user is null if no token
        setToken(null); // Ensure token is null if no token
      }

      setLoading(false);
    };

    initializeAuth();

    // Add event listener for token expiration events
    const handleTokenExpired = () => {
      logger.warn('Token expired event received');

      // Pokud je uživatel stále přihlášen, pokusíme se o refresh tokenu
      if (user) {
        // Zkusíme znovu získat platný token
        // a pokud se podaří, nebudeme odhlašovat
        logger.info('Trying to refresh token after expiration');
        refreshAccessToken()
          .then((refreshSuccess) => {
            if (refreshSuccess) {
              logger.info('Successfully refreshed token after expiration');
              return; // Pokud se úspěšně obnovil token, nebude se pokračovat v odhlášení
            }

            // Pokud se refresh nezdařil, pokračuj v odhlášení
            logger.warn('Token refresh failed after expiration');
            completeExpiration();
          })
          .catch(() => {
            completeExpiration();
          });
      } else {
        completeExpiration();
      }
    };

    // Funkce pro dokončení procesu expirace, když refresh selže
    const completeExpiration = () => {
      setUserWithStorage(null);
      setToken(null);

      // Show a message to the user
      toast.error('Your session has expired. Please sign in again.', {
        id: 'session-expired',
        duration: 5000,
      });

      // Redirect to login page only if we're not already on login page
      if (location.pathname !== '/sign-in') {
        // Save current location before redirecting
        if (location.pathname) {
          saveCurrentRoute(location.pathname);
        }
        navigate('/sign-in');
      }
    };

    window.addEventListener('auth:expired', handleTokenExpired);

    // Clean up event listener
    return () => {
      window.removeEventListener('auth:expired', handleTokenExpired);
    };
  }, []); // Run only once on mount

  const handleAuthSuccess = useCallback(
    (data: AuthResponse, rememberMe: boolean = false) => {
      // Store both access and refresh tokens with remember me preference
      setTokens(data.accessToken, data.refreshToken, rememberMe);
      setToken(data.accessToken);
      setUserWithStorage(data.user);
      toast.success(data.message || 'Success!');

      // Migrate localStorage data to database for authenticated user
      (async () => {
        try {
          logger.info(`Migrating localStorage data to database for user ${data.user.id}`);
          await userProfileService.migrateLocalStorageToDatabase();

          // Also initialize user settings from database
          await userProfileService.initializeUserSettings();

          logger.info(`Data migration completed for user ${data.user.id}`);
        } catch (error: any) {
          // Cast error to any
          logger.error('Error during data migration:', {
            error,
            userId: data.user.id,
          });

          // Fallback to legacy language update
          const currentLanguage = localStorage.getItem('language') as Language | null;
          if (currentLanguage) {
            try {
              await axios.put(
                API_PATHS.USERS.ME,
                { preferred_language: currentLanguage },
                {
                  timeout: 2000,
                  headers: {
                    Authorization: `Bearer ${data.accessToken}`,
                    'Content-Type': 'application/json',
                  },
                },
              );
              logger.info(`Language preference updated via fallback for user ${data.user.id}`);
            } catch (fallbackErr: any) {
              // Cast fallbackErr to any
              logger.error('Fallback language update also failed:', fallbackErr);
            }
          }
        }
      })();
    },
    [setUserWithStorage],
  );

  const signIn = useCallback(
    async (email: string, password: string, rememberMe: boolean = false): Promise<boolean> => {
      setLoading(true);

      try {
        // Log the attempt
        logger.info(`Attempting to sign in with email: ${email}, rememberMe: ${rememberMe}`);

        // Set up timeout for the entire sign-in process
        const loginTimeoutPromise = new Promise<boolean>((_, reject) => {
          setTimeout(() => {
            logger.warn('[authContext] Sign-in operation timed out');
            reject(new Error('Sign-in timed out. Please try again.'));
          }, 8000); // Further reduced timeout for quicker failure
        });

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
            const response = await axios.post(
              API_PATHS.AUTH.LOGIN,
              { email, password, remember_me: rememberMe },
              {
                signal: controller.signal,
                timeout: 3000, // 3 second request timeout
                headers: {
                  'Content-Type': 'application/json',
                },
              },
            );

            logger.info('Login successful');
            handleAuthSuccess(response.data, rememberMe);

            if (navigate) {
              navigate('/dashboard');
            }
            return true;
          } catch (error: any) {
            // Cast error to any
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
        const success = await Promise.race([loginProcess, loginTimeoutPromise]);
        setLoading(false);
        return success;
      } catch (error: any) {
        logger.error('Error signing in:', { error });

        // Special handling for auth errors
        if (axios.isAxiosError(error)) {
          const status = error.response?.status;
          const errorMessage = error.response?.data?.message || error.message;

          if (status === 401) {
            // Invalid credentials (wrong password)
            toast.error('Invalid password', {
              duration: 5000,
              description: 'Please check your password and try again.',
            });
          } else if (status === 404) {
            // Email not found
            toast.error('Invalid email/username', {
              duration: 5000,
              description:
                errorMessage ||
                'This email address is not registered. Please check your email or sign up for a new account.',
            });
          } else if (status === 400) {
            // Bad request - usually invalid email format or missing credentials
            toast.error('Invalid email/username', {
              duration: 5000,
              description: errorMessage || 'Please check your email address and try again.',
            });
          } else {
            // Other errors
            toast.error('Login failed', {
              duration: 5000,
              description: errorMessage || 'An error occurred during login. Please try again.',
            });
          }
        } else {
          // Non-axios errors
          toast.error('Connection error', {
            duration: 5000,
            description: error.message || 'Unable to connect to the server. Please try again.',
          });
        }

        setUserWithStorage(null);
        setToken(null);
        localStorage.removeItem('authToken');
        setLoading(false);
        return false;
      }
    },
    [navigate, handleAuthSuccess],
  );

  const signUp = useCallback(
    async (email: string, password: string, name: string): Promise<boolean> => {
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
            language: currentLanguage || 'en', // Přidáme jazyk do registračních údajů
          };

          // Log the attempt
          logger.info(`Attempting to sign up with email: ${email}`);

          // Ensure user data contains the required fields
          if (!email || !password) {
            throw new Error('Email and password are required');
          }

          try {
            // Use the centralized HTTP client with retry for actual API calls
            const response = await (async () => {
              let retries = 2; // 2 retries
              const retryDelay = 1000; // 1 second delay between retries

              while (retries >= 0) {
                try {
                  // Use apiClient for consistent handling
                  return await apiClient.post(API_PATHS.AUTH.REGISTER, userData, {
                    signal: new AbortController().signal,
                    timeout: 3000,
                  });
                } catch (error: any) {
                  // Cast error to any
                  // Don't retry if user already exists (409 Conflict)
                  if (axios.isAxiosError(error) && error.response?.status === 409) {
                    logger.warn('User already exists, not retrying', { email });
                    throw error;
                  }

                  retries--;
                  if (retries < 0) {
                    logger.warn('Auth signup attempt failed after all retries', { error });
                    throw error;
                  }

                  logger.warn(`Auth signup attempt failed, will retry. Retries left: ${retries}`, { error });
                  await new Promise((resolve) => setTimeout(resolve, retryDelay));
                }
              }
            })();

            logger.info('Signup successful');
            // Don't show toast here - let the signup component handle success messages
            return true;
          } catch (error: any) {
            // Cast error to any
            // Propagate all errors without mock workarounds

            // Otherwise, propagate the error
            throw error;
          }
        },
        {
          // Don't use custom error handler - let errors bubble up to SignUp component
          showToast: false, // Let SignUp component handle toasts
          // rethrow: true, // Removed, as it's not a valid property for safeAsync
        },
      );

      setLoading(false);
      return result || false;
    },
    [navigate],
  );

  const signOut = useCallback(async () => {
    logger.info('Signing out...');
    const refreshToken = getRefreshToken();

    // Clear tokens and user state
    removeTokens();
    setUserWithStorage(null);
    setToken(null);

    // Clear ALL user-related localStorage data
    localStorage.removeItem('userProfile');
    localStorage.removeItem('userAvatar');
    localStorage.removeItem('userAvatarUrl');
    sessionStorage.removeItem('spheroseg_persisted_user');

    // Clear context initialization markers to allow fresh initialization on next login
    sessionStorage.removeItem('spheroseg_language_last_user');
    sessionStorage.removeItem('spheroseg_theme_last_user');
    sessionStorage.removeItem('spheroseg_profile_last_user');
    sessionStorage.removeItem('spheroseg_last_auth_error');

    // Call the backend logout endpoint to invalidate the refresh token
    if (refreshToken) {
      try {
        // Use direct axios call to avoid any interceptor issues
        await axios.post(
          API_PATHS.AUTH.LOGOUT,
          { refreshToken },
          {
            timeout: 2000,
            headers: {
              'Content-Type': 'application/json',
            },
          },
        );
        logger.info('Backend logout successful');
      } catch (error: any) {
        // Cast error to any
        // Non-critical error, just log it
        logger.warn('Backend logout failed, but local session was cleared', {
          error,
        });
      }
    }

    if (navigate) {
      navigate('/');
    }
    toast.success('Signed out successfully');
  }, [navigate]);

  // Handle window events for session persistence
  useEffect(() => {
    const handleWindowFocus = () => {
      // DISABLED: This was causing users to be logged out when opening file dialogs
      // File dialogs cause the window to lose and regain focus, which shouldn't log users out
      // if (!shouldPersistSession() && user) {
      //   logger.info('Session should not persist and window gained focus, logging out');
      //   signOut();
      // }
    };

    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      // IMPORTANT: We need to distinguish between page refresh and actual window/tab close
      // Unfortunately, there's no reliable way to detect this in modern browsers
      // So we'll use a different approach:

      // Don't clear tokens on page refresh - only clear them when:
      // 1. User explicitly logs out
      // 2. Tokens expire
      // 3. Server returns 401 unauthorized

      // For now, we'll disable automatic token clearing on beforeunload
      // This prevents the issue where tokens are cleared on page refresh

      // OLD LOGIC (disabled to fix refresh issue):
      // if (!shouldPersistSession()) {
      //   logger.info('Remember me not checked, clearing session on window close');
      //   removeTokens();
      //   sessionStorage.removeItem('spheroseg_persisted_user');
      // }

      // NEW LOGIC: Mark that we're unloading, but don't clear tokens
      if (!shouldPersistSession()) {
        // Just log that we're in non-persistent mode, but don't clear tokens
        logger.debug('Page unloading in non-persistent session mode');
        // We'll rely on token expiration and server validation instead
      }
    };

    const handleVisibilityChange = () => {
      // When tab becomes visible again
      if (document.visibilityState === 'visible' && user) {
        // Only check token validity if we're in non-persistent mode
        if (!shouldPersistSession()) {
          const token = getAccessToken();
          if (!token) {
            logger.info('No token found when tab became visible, logging out');
            setUserWithStorage(null);
            setToken(null);
          } else if (isAccessTokenExpired()) {
            // Token expired while tab was hidden
            logger.info('Token expired while tab was hidden, attempting refresh');
            refreshAccessToken().then((success) => {
              if (!success) {
                logger.info('Token refresh failed, logging out');
                setUserWithStorage(null);
                setToken(null);
              }
            });
          }
        }
      }
    };

    // Add event listeners
    // Removed focus event listener - it was causing logout when opening file dialogs
    window.addEventListener('beforeunload', handleBeforeUnload);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    // Cleanup
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [user, signOut]);

  // The context value that will be supplied to consuming components
  const value = {
    user,
    token,
    loading,
    signIn,
    signUp,
    signOut,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);

  if (context === undefined) {
    // Instead of throwing an error, provide a fallback context for development
    // This helps prevent crashes when components are tested in isolation
    if (process.env.NODE_ENV !== 'production') {
      logger.warn('useAuth was called outside of AuthProvider. Using fallback context.');

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
    throw new Error('useAuth must be used within an AuthProvider');
  }

  return context;
}
