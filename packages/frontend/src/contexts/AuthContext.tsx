import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
// Import jwt-decode, který je nyní nainstalován
import { jwtDecode } from 'jwt-decode';
import { useNavigate, NavigateFunction, useLocation } from 'react-router-dom';
import { toast } from 'sonner';
import apiClient from '@/lib/apiClient'; // Import apiClient
import axios from 'axios'; // Import axios for direct requests and error checking
import { Language } from './LanguageContext'; // Import Language type
import httpClient from '@/utils/httpClient'; // Import centralized HTTP client
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
    // Uložíme do localStorage
    localStorage.setItem('spheroseg_user', JSON.stringify(user));

    // Také uložíme do cookie pro větší odolnost
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
    // Vymažeme z localStorage i cookie
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
    // Nejdříve zkusit načíst z localStorage
    const userData = localStorage.getItem('spheroseg_user');
    if (userData) {
      return JSON.parse(userData);
    }

    // Pokud není v localStorage, zkusit cookie
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
    } catch (e) {
      console.error('Error reading persisted user from session storage:', e);
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
      } catch (e) {
        console.error('Error saving user to session storage:', e);
      }
      return loadedUser;
    } else if (persistedUser) {
      // Pokud nemáme uživatele, ale máme ho v session, použijeme ho jako fallback
      console.log('Using persisted user from session as fallback');
      return persistedUser;
    }

    // Jinak vrátíme null
    return null;
  };

  // Initialize user from localStorage with persistence protection
  const initialUser = ensureUserPersistence(loadUserFromStorage());
  console.log('Initial user from storage (with persistence):', initialUser);

  const [user, setUser] = useState<User | null>(initialUser);
  const [token, setToken] = useState<string | null>(
    getAccessToken() || document.cookie.match(/auth_token=([^;]+)/)?.[1] || null,
  );
  const [loading, setLoading] = useState(true);

  // Log auth state changes for debugging
  useEffect(() => {
    console.log('Auth state changed:', {
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
      } catch (e) {
        console.error('Error saving user to session storage:', e);
      }
    } else {
      // Only clear session storage if we're explicitly logging out
      // Pokud jsme došli sem voláním signOut funkce, vymažeme i z session
      const isLogout = new Error().stack?.includes('signOut');
      if (isLogout) {
        console.log('Clearing persisted user due to explicit logout');
        sessionStorage.removeItem('spheroseg_persisted_user');
      } else {
        console.log('Not clearing persisted user (not an explicit logout)');
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

      // Po 5 sekundách zrušíme blokaci (dáváme dost času pro obnovu tokenů)
      setTimeout(() => {
        isPageLoadRef.current = false;
        window.sessionStorage.removeItem('spheroseg_page_loading');
        logger.info('Page reload blocker disabled');
      }, 5000);
    }
  }, []);

  // Check token validity and fetch user data on initial load or token change
  useEffect(() => {
    const initializeAuth = async () => {
      setLoading(true);

      // KRITICKÁ OPTIMALIZACE: Pokud máme uživatele a jsme na chráněné stránce,
      // nebo pokud jsme na přihlašovací stránce, nemusíme inicializovat auth
      // Toto zabrání zbytečnému ověřování a ztrátě přihlášení při navigaci mezi stránkami
      if (location.pathname === '/sign-in' || location.pathname === '/sign-up') {
        console.log('Skipping auth initialization on auth page');
        setLoading(false);
        return;
      }

      // DŮLEŽITÉ: Pokud už máme platného uživatele, neresetujeme proces inicializace
      // Tím zabráníme ztrátě přihlášení při refreshi stránky
      if (user && !location.pathname.startsWith('/sign-')) {
        console.log('Skipping auth re-initialization on protected page with valid user');
        setLoading(false);
        return;
      }

      // Try to get tokens (will check both localStorage and cookies)
      const currentToken = getAccessToken();
      const currentRefreshToken = getRefreshToken();

      if (currentToken) {
        logger.info('Found authentication tokens, verifying...');

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
          setToken(getAccessToken());
        }

        try {
          // Nastavíme delší timeout, aby se aplikace nezablokovala, pokud je API pomalejší
          const timeoutPromise = new Promise<null>((resolve) => {
            setTimeout(() => {
              logger.warn('Auth API verification timed out, continuing with stored token and user data');
              resolve(null);
            }, 20000); // Zvýšeno na 20 sekund pro větší toleranci pomalejší sítě
          });

          // Try to load user from storage first
          const storedUser = loadUserFromStorage();
          if (storedUser) {
            // Pre-set user from storage to avoid UI flashing if verification is slow
            setUserWithStorage(storedUser);
          }

          // Verify token by fetching user data using the centralized HTTP client
          const controller = new AbortController();
          const fetchUserPromise = httpClient.withRetry(
            async () => {
              try {
                return await axios.get<User>(API_PATHS.USERS.ME, {
                  signal: controller.signal,
                  timeout: 10000, // Zvýšeno na 10 sekund pro větší toleranci
                  headers: {
                    Authorization: `Bearer ${getAccessToken()}`,
                    'Content-Type': 'application/json',
                  },
                  withCredentials: true, // Důležité pro přenos cookies
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
            4, // Zvýšeno na 4 pokusy
            2000, // Zvýšeno na 2s mezi pokusy
          );

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
        } catch (error) {
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
    (data: AuthResponse) => {
      // Store both access and refresh tokens
      setTokens(data.accessToken, data.refreshToken);
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
        } catch (error) {
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
            } catch (fallbackError) {
              logger.error('Fallback language update also failed:', fallbackError);
            }
          }
        }
      })();
    },
    [setUserWithStorage],
  );

  const signIn = useCallback(
    async (email: string, password: string): Promise<boolean> => {
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
                const response = await axios.post(
                  API_PATHS.AUTH.LOGIN,
                  { email, password },
                  {
                    signal: controller.signal,
                    timeout: 3000, // 3 second request timeout
                    headers: {
                      'Content-Type': 'application/json',
                    },
                  },
                );

                logger.info('Login successful');
                handleAuthSuccess(response.data);

                if (navigate) {
                  navigate('/dashboard');
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
            logger.error('Error signing in:', { error });

            // Use enhanced error handling
            const errorType = getErrorType(error);

            // Special handling for auth errors (bad credentials)
            if (errorType === NetworkErrorType.AUTH_ERROR) {
              toast.error('Invalid credentials', {
                duration: 5000,
                description: 'Please check your email and password and try again.',
              });
            } else {
              // Use enhanced error display for other errors
              showEnhancedError(error);
            }

            setUserWithStorage(null);
            setToken(null);
            localStorage.removeItem('authToken');
          },
          showToast: false, // We're handling toasts manually
          defaultValue: false, // Return false on error
        },
      );

      setLoading(false);
      return result || false;
    },
    [navigate],
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
            const response = await httpClient.withRetry(
              async () => {
                try {
                  // Use direct axios call to avoid any interceptor issues
                  return await axios.post(API_PATHS.AUTH.REGISTER, userData, {
                    signal: new AbortController().signal,
                    timeout: 3000,
                    headers: {
                      'Content-Type': 'application/json',
                    },
                  });
                } catch (error) {
                  // Don't retry if user already exists (409 Conflict)
                  if (axios.isAxiosError(error) && error.response?.status === 409) {
                    logger.warn('User already exists, not retrying', { email });
                    throw error;
                  }

                  logger.warn('Auth signup attempt failed, will retry', {
                    error,
                  });
                  throw error;
                }
              },
              2, // 2 retries
              1000, // 1 second delay between retries
            );

            logger.info('Signup successful');
            toast.success(response.data.message || 'Registration successful!');
            if (navigate) {
              navigate('/sign-in?signupSuccess=true'); // Redirect to sign-in after signup
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
            logger.error('Error signing up:', { error });

            // Use enhanced error handling
            const errorType = getErrorType(error);

            // Special handling for specific error cases
            if (axios.isAxiosError(error) && error.response?.status === 409) {
              toast.error('User with this email already exists.', {
                duration: 5000,
                description: 'Please use a different email address or try to sign in.',
              });
            } else if (errorType === NetworkErrorType.NETWORK_ERROR) {
              toast.error('Cannot connect to server', {
                duration: 5000,
                description: 'Please check your internet connection and try again.',
              });
            } else if (errorType === NetworkErrorType.SERVER_ERROR) {
              toast.error('Server error during registration', {
                duration: 5000,
                description: 'Our server is experiencing issues. Please try again later.',
              });
            } else {
              // Use enhanced error display for other errors
              showEnhancedError(error);
            }
          },
          showToast: false, // We're handling toasts manually in onError
          defaultValue: false, // Return false on error
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
      } catch (error) {
        // Non-critical error, just log it
        logger.warn('Backend logout failed, but local session was cleared', {
          error,
        });
      }
    }

    if (navigate) {
      navigate('/sign-in');
    }
    toast.success('Signed out successfully');
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

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);

  if (context === undefined) {
    // Instead of throwing an error, provide a fallback context for development
    // This helps prevent crashes when components are tested in isolation
    if (process.env.NODE_ENV !== 'production') {
      console.warn('useAuth was called outside of AuthProvider. Using fallback context.');

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
